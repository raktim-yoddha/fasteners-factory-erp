import { randomBytes, randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { container, docker, literal, query, PostgresSession } from './postgres-session.mjs';

const database = `fasteners_acceptance_${randomBytes(8).toString('hex')}`;
const marker = `fasteners-concurrency:${randomUUID()}`;
if (!/^fasteners_acceptance_[0-9a-f]{16}$/.test(database))
  throw new Error('Unsafe acceptance database name.');
let created = false,
  assertions = 0;
const sessions = [];
function check(condition, label) {
  if (!condition) throw new Error(`FAIL: ${label}`);
  assertions++;
  console.log(`PASS: ${label}`);
}
async function session(name, actor) {
  const value = new PostgresSession(database, name);
  sessions.push(value);
  return value.ready(actor);
}
async function blocked(monitor, names, operation) {
  let finished = false;
  operation
    .finally(() => {
      finished = true;
    })
    .catch(() => undefined);
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const count = Number(
      await monitor.run(
        `SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND application_name IN (${names.map(literal).join(',')}) AND wait_event_type='Lock';`,
      ),
    );
    if (count === names.length) return;
    if (finished)
      throw new Error(
        'FAIL: command completed before a pending authority/stock update released its lock',
      );
    await delay(25);
  }
  throw new Error('FAIL: expected concurrent database lock was not observed');
}
try {
  await query(
    'postgres',
    `CREATE DATABASE ${database}; COMMENT ON DATABASE ${database} IS ${literal(marker)};`,
  );
  created = true;
  const authSchema = await docker([
    'exec',
    container,
    'pg_dump',
    '-U',
    'postgres',
    '-d',
    'postgres',
    '--schema-only',
    '--no-owner',
    '--no-privileges',
    '--schema=auth',
  ]);
  await query(database, authSchema);
  await query(database, 'CREATE SCHEMA extensions; GRANT USAGE ON SCHEMA auth TO authenticated;');
  const migrations = new URL('../../supabase/migrations/', import.meta.url);
  for (const filename of (await readdir(migrations))
    .filter((value) => value.endsWith('.sql'))
    .sort())
    await query(database, await readFile(new URL(filename, migrations), 'utf8'));
  await query(
    database,
    await readFile(new URL('../../supabase/tests/concurrency-setup.sql', import.meta.url), 'utf8'),
  );
  const owner = '20000000-0000-4000-8000-000000000001',
    stores = '20000000-0000-4000-8000-000000000002';
  const monitor = await session('FF-monitor'),
    control = await session('FF-control');
  const a = await session('FF-owner-a', owner),
    b = await session('FF-stores-b', stores),
    retry = await session('FF-owner-retry', owner);
  const fixture = JSON.parse(
    await monitor.run('SELECT json_object_agg(key,value) FROM acceptance.fixture;'),
  );
  const payload = (quantity) => ({ lotId: fixture.lot, orderId: fixture.order, quantity });
  const command = (quantity, key = randomUUID(), revision) =>
    `SELECT acceptance.command('reserve_stock',${literal(JSON.stringify(payload(quantity)))}::jsonb,${literal(key)}::uuid,${revision ? literal(revision) : 'NULL'});`;
  const lock = `SELECT pg_advisory_xact_lock(hashtextextended(${literal(fixture.company + fixture.plant)},0));`;
  const concurrent = async (first, second, sqlA, sqlB) => {
    await control.run(`BEGIN; ${lock}`);
    const left = first.run(sqlA),
      right = second.run(sqlB);
    try {
      await blocked(monitor, [first.name, second.name], Promise.all([left, right]));
    } finally {
      await control.run('COMMIT;');
    }
    return (await Promise.all([left, right])).map((value) => JSON.parse(value));
  };
  let results = await concurrent(a, b, command('6.000001'), command('6.000001'));
  check(
    results.filter((result) => result.ok).length === 1 &&
      results.some((result) => result.error?.code === 'INSUFFICIENT_AVAILABLE_STOCK'),
    'two actors cannot oversell the final exact stock',
  );
  check(
    (await monitor.run(
      `SELECT sum(quantity)::text FROM public.stock_reservations WHERE lot_id=${literal(fixture.lot)} AND state='active';`,
    )) === '6.000001',
    'competing reservation commits one exact allocation',
  );
  const requestKey = randomUUID();
  results = await concurrent(a, retry, command('1', requestKey), command('1', requestKey));
  check(
    results.every((result) => result.ok) &&
      JSON.stringify(results[0]) === JSON.stringify(results[1]),
    'concurrent duplicate retries return the same committed result',
  );
  check(
    (await monitor.run(`SELECT count(*) FROM public.audit_log WHERE command='reserve_stock';`)) ===
      '2',
    'duplicate retries append only one audit event',
  );
  const revision = await monitor.run(
    `SELECT revision::text FROM public.stock_lots WHERE id=${literal(fixture.lot)};`,
  );
  results = await concurrent(
    a,
    b,
    command('1', randomUUID(), revision),
    command('1', randomUUID(), revision),
  );
  check(
    results.filter((result) => result.ok).length === 1 &&
      results.some((result) => result.error?.code === 'REVISION_CONFLICT'),
    'concurrent stale revisions commit one request and reject the other',
  );
  check(
    (await monitor.run(`SELECT count(*) FROM public.audit_log WHERE command='reserve_stock';`)) ===
      '3',
    'stale rejection leaves no partial audit',
  );

  const authorityWriter = await session('FF-authority-writer');
  await control.run(`BEGIN; ${lock}`);
  const queued = b.run(command('0.5'));
  await blocked(monitor, [b.name], queued);
  const revokeQueued = authorityWriter.run(
    `UPDATE public.memberships SET active=false WHERE company_id=${literal(fixture.company)} AND user_id=${literal(stores)};`,
  );
  try {
    await blocked(monitor, [authorityWriter.name], revokeQueued);
  } catch (error) {
    await control.run('COMMIT;');
    const outcome = JSON.parse(await queued);
    if (outcome.ok)
      throw new Error(
        'FAIL: a queued business command committed after membership revocation had already committed',
      );
    throw error;
  }
  await control.run('COMMIT;');
  check(
    JSON.parse(await queued).ok,
    'an already authorized queued command completes before membership revocation can commit',
  );
  await revokeQueued;
  check(
    (await monitor.run(
      `SELECT active::text FROM public.memberships WHERE company_id=${literal(fixture.company)} AND user_id=${literal(stores)};`,
    )) === 'false',
    'membership revocation commits after the authorized transaction finishes',
  );
  await control.run(
    `UPDATE public.memberships SET active=true WHERE company_id=${literal(fixture.company)} AND user_id=${literal(stores)};`,
  );
  const before = await monitor.run(`SELECT count(*) FROM public.audit_log;`);
  await control.run(
    `BEGIN; UPDATE public.memberships SET active=false WHERE company_id=${literal(fixture.company)} AND user_id=${literal(stores)};`,
  );
  const revoked = b.run(command('0.5'));
  try {
    await blocked(monitor, [b.name], revoked);
  } finally {
    await control.run('COMMIT;');
  }
  const revokedResult = JSON.parse(await revoked);
  check(
    revokedResult.error?.code === 'PERMISSION_DENIED',
    'command waiting for membership revocation rejects after commit',
  );
  check(
    (await monitor.run('SELECT count(*) FROM public.audit_log;')) === before,
    'revoked command leaves no audit or reservation mutation',
  );
  await control.run(
    `UPDATE public.memberships SET active=true WHERE company_id=${literal(fixture.company)} AND user_id=${literal(stores)};`,
  );
  await control.run(
    `BEGIN; SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claims=${literal(JSON.stringify({ sub: owner, role: 'authenticated', aal: 'aal1' }))}; SELECT public.update_member_access(${literal(fixture.company)}::uuid,${literal(stores)}::uuid,ARRAY['Operator']::text[],ARRAY[${literal(fixture.plant)}::uuid],false,true,ARRAY[]::text[],${literal(randomUUID())}::uuid);`,
  );
  const removed = b.run(command('0.5'));
  try {
    await blocked(monitor, [b.name], removed);
  } finally {
    await control.run('COMMIT;');
  }
  check(
    JSON.parse(await removed).error?.code === 'PERMISSION_DENIED',
    'command waiting for real role administration rejects removed stock permission',
  );
  check(
    (await monitor.run(`SELECT count(*) FROM public.stock_reservations;`)) === '4',
    'revoked membership and role requests create no stock allocations',
  );
  await a.run(
    `SELECT public.update_member_access(${literal(fixture.company)}::uuid,${literal(stores)}::uuid,ARRAY['Stores']::text[],ARRAY[${literal(fixture.plant)}::uuid],false,true,ARRAY[]::text[],${literal(randomUUID())}::uuid);`,
  );
  await a.run(
    `SET request.jwt.claims=${literal(JSON.stringify({ sub: owner, role: 'authenticated', aal: 'aal2' }))}; BEGIN; SELECT public.manage_company(${literal(fixture.company)}::uuid,'require_mfa',null,true);`,
  );
  const mfa = b.run(command('0.5'));
  try {
    await blocked(monitor, [b.name], mfa);
  } finally {
    await a.run('COMMIT;');
  }
  check(
    JSON.parse(await mfa).error?.code === 'AUTH_REQUIRED',
    'queued command observes the committed company MFA policy',
  );
  check(
    (await monitor.run(
      "SELECT has_function_privilege('authenticated','private.execute_command_unlocked(jsonb)','EXECUTE')::text;",
    )) === 'false',
    'clients cannot bypass authority locks through the private delegate',
  );
  check(
    (await monitor.run(
      "SELECT has_function_privilege('anon','public.execute_command(jsonb)','EXECUTE')::text;",
    )) === 'false',
    'anonymous role cannot call the business facade',
  );
  console.log(
    `PostgreSQL concurrency suite passed: ${assertions} assertions in a disposable migration-replayed database.`,
  );
} finally {
  await Promise.allSettled(sessions.map((value) => value.close()));
  if (created) {
    const identity = (
      await query(
        'postgres',
        `SELECT shobj_description(oid,'pg_database') FROM pg_database WHERE datname=${literal(database)};`,
      )
    ).trim();
    if (identity !== marker)
      throw new Error('Disposable database ownership marker changed; refusing cleanup.');
    await query('postgres', `DROP DATABASE ${database} WITH (FORCE);`);
    console.log('Owned disposable database removed; source and sibling databases unchanged.');
  }
}
