import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
const sql = await readFile(new URL('../../supabase/tests/authority.sql', import.meta.url), 'utf8');
const container = 'supabase_db_fasteners-factory-erp-desktop';
const child = spawn(
  'docker',
  ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'],
  { stdio: ['pipe', 'pipe', 'pipe'] },
);
let stderr = '';
child.stdout.resume();
child.stderr.on('data', (data) => {
  stderr += data;
});
child.on('error', (error) => {
  console.error(`PostgreSQL gate unavailable: ${error.message}`);
  process.exitCode = 1;
});
child.stdin.end(sql);
child.on('close', (code) => {
  for (const line of stderr
    .split('\n')
    .filter((line) => line.includes('PASS:') || line.includes('FAIL:') || line.includes('ERROR:')))
    console.log(line.trim());
  if (code !== 0) {
    console.error(
      'Real PostgreSQL authority tests failed. Start this project with pnpm db:start; no remote database is used.',
    );
    console.error(stderr.slice(-1600));
    process.exitCode = 1;
  } else
    console.log(
      `PostgreSQL authority suite passed: ${(stderr.match(/PASS:/g) ?? []).length} assertions; fictional test records rolled back.`,
    );
});
