import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
const release = fileURLToPath(new URL('../../apps/desktop/release', import.meta.url));
const filenames = (await readdir(release))
  .filter((name) => /^Fasteners Factory ERP Setup [\d.]+\.exe(?:\.blockmap)?$/.test(name))
  .sort();
if (!filenames.some((name) => name.endsWith('.exe')))
  throw new Error('Build the Windows installer first.');
const lines = [];
for (const name of filenames) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(join(release, name))) hash.update(chunk);
  lines.push(`${hash.digest('hex')}  ${name}`);
}
await writeFile(join(release, 'SHA256SUMS.txt'), `${lines.join('\n')}\n`);
console.log(
  `Recorded SHA-256 for ${filenames.length} Windows artifacts. Signing and clean-machine acceptance remain separate gates.`,
);
