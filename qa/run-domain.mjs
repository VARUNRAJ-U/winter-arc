/** Bundles the TypeScript domain test (resolving the @ alias) and runs it. */
import { build } from 'esbuild';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { mkdir, rm } from 'node:fs/promises';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const outDir = path.join(root, 'qa', '.tmp');
const outFile = path.join(outDir, 'domain.test.mjs');

await mkdir(outDir, { recursive: true });
await build({
  entryPoints: [path.join(root, 'qa', 'domain.test.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  outfile: outFile,
  alias: { '@': path.join(root, 'src') },
  logLevel: 'error',
});

await import(pathToFileURL(outFile).href);
await rm(outDir, { recursive: true, force: true });
