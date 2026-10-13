import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const command = process.argv[2];
if (!['start', 'stop'].includes(command))
  throw new Error('Supported local operation: start or stop.');
const cli = fileURLToPath(new URL('../../node_modules/supabase/dist/supabase.js', import.meta.url));
const child = spawn(process.execPath, [cli, command], { stdio: ['ignore', 'pipe', 'pipe'] });
child.stdout.resume();
child.stderr.on('data', (chunk) => {
  const text = String(chunk);
  if (!/SECRET|TOKEN|KEY|PASSWORD|postgresql:\/\//i.test(text)) process.stderr.write(text);
});
child.on('error', (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on('close', (code) => {
  if (code !== 0) {
    console.error(
      `Local Supabase ${command} failed. Inspect this project's Docker containers; runtime credential output is withheld.`,
    );
    process.exitCode = 1;
  } else
    console.log(
      `Local Supabase ${command} complete. API: http://127.0.0.1:55321; mail capture: http://127.0.0.1:55324. Runtime credentials are intentionally not printed.`,
    );
});
