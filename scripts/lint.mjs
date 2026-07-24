import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = new URL('..', import.meta.url).pathname;
const sourceDirectories = ['src', 'scripts'];
const checkedExtensions = new Set(['.js', '.mjs']);
const errors = [];

async function collectFiles(directory) {
  const absoluteDirectory = join(root, directory);
  const entries = await readdir(absoluteDirectory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(absoluteDirectory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(relative(root, path)));
    } else if (checkedExtensions.has(extname(entry.name))) {
      files.push(path);
    }
  }

  return files;
}

for (const directory of sourceDirectories) {
  for (const file of await collectFiles(directory)) {
    const check = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    if (check.status !== 0) {
      errors.push(check.stderr.trim());
    }

    const content = await readFile(file, 'utf8');
    if (/[ \t]+$/m.test(content)) {
      errors.push(`${relative(root, file)} contains trailing whitespace.`);
    }
  }
}

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log('Lint passed.');
