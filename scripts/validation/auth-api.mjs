import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';

const require = createRequire(
  new URL('../../packages/cloud-repository/package.json', import.meta.url),
);
const { createClient } = require('@supabase/supabase-js');
const { stdout } = await promisify(execFile)(process.execPath, [
  fileURLToPath(new URL('../../node_modules/supabase/dist/supabase.js', import.meta.url)),
  'status',
  '-o',
  'json',
]);
const status = JSON.parse(stdout);
assert.equal(
  status.API_URL,
  'http://127.0.0.1:55321',
  'Auth acceptance must use this isolated local backend.',
);
const options = { auth: { persistSession: false, autoRefreshToken: false } };
// Runtime-only local test privilege. Never write these keys to files or expose them to an app.
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, options);
const client = createClient(status.API_URL, status.PUBLISHABLE_KEY, options);
const anonymous = createClient(status.API_URL, status.PUBLISHABLE_KEY, options);
const users = [];
const check = (condition, label) => {
  assert.ok(condition, label);
  console.log(`PASS: ${label}`);
};
try {
  const password = `${randomUUID()}Aa1!`;
  const email = `sample-api-${randomUUID()}@example.invalid`;
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: 'Owner' },
  });
  assert.equal(created.error, null, 'Local fictional verified identity creation failed.');
  users.push(created.data.user.id);
  const login = await client.auth.signInWithPassword({ email, password });
  check(
    !login.error && Boolean(login.data.session),
    'Actual Auth password session issued to verified identity',
  );
  const identity = await client.auth.getUser();
  check(identity.data.user?.id === users[0], 'Auth server verifies current identity');
  const workspaces = await client.rpc('list_workspaces');
  check(
    !workspaces.error && Array.isArray(workspaces.data) && workspaces.data.length === 0,
    'Editable Owner metadata creates no company membership',
  );
  const tenant = await client.rpc('workspace_snapshot', {
    authority: { kind: 'team', companyId: randomUUID() },
  });
  check(Boolean(tenant.error), 'Signed nonmember cannot read a forged tenant');
  const mutation = await client
    .from('records')
    .insert({
      company_id: randomUUID(),
      plant_id: randomUUID(),
      kind: 'item',
      code: 'SAMPLE-FORGED',
      name: 'SAMPLE unauthorized',
      fields: { unit: 'pcs' },
    });
  check(Boolean(mutation.error), 'Actual Data API rejects direct business-table mutation');
  const anonRead = await anonymous.rpc('list_workspaces');
  check(Boolean(anonRead.error), 'Anonymous RPC access is denied');
  const unverifiedEmail = `sample-unverified-api-${randomUUID()}@example.invalid`;
  const unverified = await admin.auth.admin.createUser({
    email: unverifiedEmail,
    password,
    email_confirm: false,
  });
  assert.equal(unverified.error, null, 'Local fictional unverified identity creation failed.');
  users.push(unverified.data.user.id);
  const deniedLogin = await anonymous.auth.signInWithPassword({ email: unverifiedEmail, password });
  check(
    Boolean(deniedLogin.error) && !deniedLogin.data.session,
    'Unverified email cannot obtain a password session',
  );
  assert.equal((await client.auth.signOut()).error, null);
  check(!(await client.auth.getSession()).data.session, 'Logout removes this client session');
} finally {
  await client.auth.signOut();
  for (const id of users) {
    const result = await admin.auth.admin.deleteUser(id);
    assert.equal(result.error, null, 'Fictional Auth acceptance cleanup failed.');
  }
}
console.log(
  'Local Auth/HTTP acceptance passed; fictional identities removed. No company or tenant data was created.',
);
