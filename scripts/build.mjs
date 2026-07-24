import { cp, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = join(root, 'dist');
const maplibreDistribution = join(root, 'node_modules', 'maplibre-gl', 'dist');
const browserDependencies = [
  'maplibre-gl.css',
  'maplibre-gl.mjs',
  'maplibre-gl-shared.mjs',
  'maplibre-gl-worker.mjs'
];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(join(root, 'public'), output, { recursive: true });
await cp(join(root, 'src'), join(output, 'src'), { recursive: true });
await cp(join(root, 'vendor'), join(output, 'vendor'), { recursive: true });
for (const dependency of browserDependencies) {
  await cp(join(maplibreDistribution, dependency), join(output, 'vendor', dependency));
}

console.log('Build completed in dist/.');
