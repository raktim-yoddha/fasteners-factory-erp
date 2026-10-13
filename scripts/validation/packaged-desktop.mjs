import { access } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const executable = fileURLToPath(
  new URL('../../apps/desktop/release/win-unpacked/Fasteners Factory ERP.exe', import.meta.url),
);
await access(executable);
const child = spawn(
  process.execPath,
  [require.resolve('@playwright/test/cli'), 'test', '--project=desktop'],
  {
    stdio: 'inherit',
    env: { ...process.env, FASTENERS_PACKAGED_EXECUTABLE: executable },
  },
);
child.on('error', () => {
  console.error('Packaged desktop acceptance could not launch.');
  process.exitCode = 1;
});
child.on('close', (code) => {
  process.exitCode = code ?? 1;
});
