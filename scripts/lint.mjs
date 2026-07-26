import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const sourceDirectories = ['src', 'scripts', 'public'];
const jsExtensions = new Set(['.js', '.mjs']);
const allExtensions = new Set(['.js', '.mjs', '.ts', '.tsx']);
const errors = [];

async function collectFiles(directory) {
  const absoluteDirectory = join(root, directory);
  const entries = await readdir(absoluteDirectory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(absoluteDirectory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(relative(root, path)));
    } else if (allExtensions.has(extname(entry.name))) {
      files.push(path);
    }
  }

  return files;
}

for (const directory of sourceDirectories) {
  for (const file of await collectFiles(directory)) {
    const ext = extname(file);
    if (jsExtensions.has(ext)) {
      const check = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
      if (check.error) {
        errors.push(`${relative(root, file)} could not be checked: ${check.error.message}`);
      } else if (check.status !== 0) {
        errors.push((check.stderr || check.stdout || `${relative(root, file)} failed syntax validation.`).trim());
      }
    }
    if (allExtensions.has(ext)) {
      const content = await readFile(file, 'utf8');
      if (/[ \t]+$/m.test(content)) {
        errors.push(`${relative(root, file)} contains trailing whitespace.`);
      }
    }
  }
}

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log('Lint passed.');
