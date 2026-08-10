/**
 * Production bundle: one file for VPS deploy.
 * Usage: node scripts/build.mjs
 *
 * Express uses CommonJS require() for built-ins. When bundling for ESM we must
 * inject createRequire or the process dies with:
 *   Dynamic require of "path" is not supported
 */
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outdir = path.join(root, 'dist');
const outfile = path.join(outdir, 'server.js');

fs.mkdirSync(outdir, { recursive: true });

await esbuild.build({
  entryPoints: [path.join(root, 'src', 'index.js')],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  outfile,
  packages: 'bundle',
  // pg is optional (only when DATABASE_URL set); keep external for native-safe deploys
  external: ['pg', 'pg-native'],
  logLevel: 'info',
  banner: {
    js: `
import { createRequire as __acrCreateRequire } from 'module';
import { fileURLToPath as __acrFileURLToPath } from 'url';
import { dirname as __acrDirname } from 'path';
const require = __acrCreateRequire(import.meta.url);
const __filename = __acrFileURLToPath(import.meta.url);
const __dirname = __acrDirname(__filename);
`.trimStart(),
  },
});

fs.writeFileSync(
  path.join(outdir, 'package.json'),
  JSON.stringify({ type: 'module', private: true }, null, 2) + '\n',
);

console.log('Built', outfile);
console.log('Next: npm run package  →  scp release tarball to VPS');
