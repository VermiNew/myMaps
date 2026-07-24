import { cp, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const output = join(root, 'dist');

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(join(root, 'public'), output, { recursive: true });
await cp(join(root, 'src'), join(output, 'src'), { recursive: true });
await cp(join(root, 'vendor'), join(output, 'vendor'), { recursive: true });

console.log('Build completed in dist/.');
