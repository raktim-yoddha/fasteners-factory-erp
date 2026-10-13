import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import { resolve, relative, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};
const read = (path) => readFile(join(root, path), 'utf8');
const rules = await read('AGENTS.md');
check(rules === (await read('CLAUDE.md')), 'AGENTS.md and CLAUDE.md must be byte-identical.');
check(
  createHash('sha256')
    .update(await readFile(join(root, 'docs/handoff.md')))
    .digest('hex') === '339e0548b9481ddf8b900220129173a408b92d881cbf9ffcbe874257e7cddaab',
  'The preserved handoff checksum changed.',
);
for (const path of [
  'PID.md',
  'PRD.md',
  'architecture.md',
  'design.md',
  'features.md',
  'cloud.md',
  'pnpm-lock.yaml',
]) {
  check((await stat(join(root, path))).size > 0, `${path} is missing or empty.`);
}
const manifests = [join(root, 'package.json')];
for (const folder of ['apps', 'packages']) {
  for (const entry of await readdir(join(root, folder), { withFileTypes: true })) {
    if (entry.isDirectory()) manifests.push(join(root, folder, entry.name, 'package.json'));
  }
}
const packageNames = new Set();
for (const filename of manifests) {
  const manifest = JSON.parse(await readFile(filename, 'utf8'));
  check(!packageNames.has(manifest.name), `Duplicate package name: ${manifest.name}`);
  packageNames.add(manifest.name);
  for (const kind of ['dependencies', 'devDependencies']) {
    for (const [name, version] of Object.entries(manifest[kind] ?? {})) {
      check(
        version === 'workspace:*' || /^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(version),
        `${relative(root, filename)}: ${name} must use an exact version.`,
      );
    }
  }
}
const boundaries = {
  domain: new Set(['@fasteners/contracts']),
  contracts: new Set(['zod']),
  application: new Set(['@fasteners/contracts', '@fasteners/domain']),
  'ui-web': new Set([
    '@fasteners/contracts',
    '@fasteners/application',
    '@fasteners/domain',
    '@fasteners/tokens',
    '@fasteners/test-fixtures',
  ]),
};
async function sources(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await sources(filename)));
    else if (/\.[cm]?[jt]sx?$/.test(filename)) files.push(filename);
  }
  return files;
}
for (const [name, allowed] of Object.entries(boundaries)) {
  for (const filename of await sources(join(root, 'packages', name, 'src'))) {
    const source = await readFile(filename, 'utf8');
    for (const match of source.matchAll(/(?:from\s*|import\s*\(|require\s*\()(['"])([^'"]+)\1/g)) {
      const dependency = match[2];
      if (dependency.startsWith('.')) {
        check(
          !dependency.includes('../..'),
          `${relative(root, filename)} crosses a package through a relative import.`,
        );
      } else if (
        dependency.startsWith('@fasteners/') ||
        ['domain', 'contracts', 'application'].includes(name) ||
        dependency.startsWith('node:') ||
        /sqlite|supabase|electron/.test(dependency)
      ) {
        check(
          allowed.has(dependency),
          `${relative(root, filename)} violates its boundary: ${dependency}`,
        );
      }
    }
    if (name === 'domain')
      check(
        !/\b(fetch|window|document|localStorage)\b/.test(source),
        `${relative(root, filename)} uses a runtime API in domain code.`,
      );
  }
}
const workspace = await read('pnpm-workspace.yaml');
for (const folder of [
  'apps/web/src',
  'apps/desktop/src/renderer',
  'packages/ui-web/src',
  'packages/cloud-repository/src',
]) {
  for (const filename of await sources(join(root, folder))) {
    const source = await readFile(filename, 'utf8');
    check(
      !/\b(?:VITE|EXPO_PUBLIC)_[A-Z_]*(?:SECRET|SERVICE_ROLE|PRIVATE_KEY|PASSWORD)\b|\bsb_secret_[\w-]+|\bSERVICE_ROLE_KEY\b|\.auth\.admin\b/.test(
        source,
      ),
      `${relative(root, filename)} contains a server-only credential or Auth admin boundary.`,
    );
  }
}
for (const folder of ['apps/mobile', 'packages/sqlite-mobile', 'packages/ui-native'])
  check(workspace.includes(`'!${folder}'`), `${folder} must remain deferred.`);
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else
  console.log(
    'Engineering equality, source checksum, exact pins, boundaries, and mobile deferral passed.',
  );
