import { build as bundle } from 'esbuild';
import { build as renderer } from 'vite';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
await renderer({ configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)) });
const common = {
  absWorkingDir: root,
  outdir: 'dist',
  outExtension: { '.js': '.cjs' },
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'cjs',
  external: ['electron', 'better-sqlite3'],
};
await bundle({
  ...common,
  entryPoints: { main: 'src/main/index.ts', database: 'src/database/entry.ts' },
  banner: { js: "const __factoryModuleUrl = require('node:url').pathToFileURL(__filename).href;" },
  define: { 'import.meta.url': '__factoryModuleUrl' },
});
// A sandboxed preload has a restricted require implementation; it must not inherit Node-only bootstrap code.
await bundle({ ...common, entryPoints: { preload: 'src/preload/index.ts' } });
