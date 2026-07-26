import { spawn } from 'node:child_process';

const apiServer = spawn('node', ['scripts/serve.mjs', 'public', '4174'], {
  stdio: 'inherit',
  shell: true
});

const vite = spawn('npx', ['vite', '--host', '127.0.0.1'], {
  stdio: 'inherit',
  shell: true
});

process.on('SIGINT', () => {
  apiServer.kill();
  vite.kill();
  process.exit();
});

process.on('SIGTERM', () => {
  apiServer.kill();
  vite.kill();
  process.exit();
});
