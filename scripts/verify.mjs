import 'dotenv/config';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { mkdir } from 'node:fs/promises';
await mkdir('runtime', { recursive: true });
const url = `file:${resolve('runtime/verification_test.sqlite')}?connection_limit=1&socket_timeout=15`;
process.env.TEST_DATABASE_URL = url;
function run(command, args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', env });
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} ${args.join(' ')} failed (${code})`)),
    );
  });
}
const services = [];
function start(args, env, marker) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { env, stdio: ['ignore', 'pipe', 'pipe'] });
    services.push(child);
    const timer = setTimeout(() => reject(new Error('Test service startup timeout')), 30000);
    let output = '';
    child.stdout.on('data', (data) => {
      process.stdout.write(data);
      output += data;
      if (output.includes(marker)) {
        clearTimeout(timer);
        resolve(child);
      }
    });
    child.stderr.on('data', (data) => process.stderr.write(data));
    child.on('error', reject);
    child.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Test service exited (${code})`));
    });
  });
}
const env = {
  ...process.env,
  DATABASE_URL: url,
  APP_ORIGIN: 'http://localhost:3300',
  ADMIN_PASSWORD: 'Browser-admin-password-2026!',
  ENCRYPTION_KEY: 'b'.repeat(64),
  WORKER_SECRET: 'browser-worker-secret-not-production-2026',
  WORKER_URL: 'http://127.0.0.1:3213',
  WORKER_PORT: '3213',
  MEDIA_ROOT: './runtime/browser-media',
  ENABLE_WHATSAPP: 'true',
  COOKIE_SECURE: 'true',
  PORT: '3300',
};
try {
  await run('npm', ['run', 'db:generate']);
  await run('npm', ['run', 'format:check']);
  await run('npm', ['run', 'typecheck']);
  await run('npm', ['run', 'lint']);
  await run('npm', ['test']);
  await run('npm', ['run', 'db:migrate'], env);
  await run('npm', ['run', 'test:integration']);
  await run('npm', ['run', 'build']);
  await run(process.execPath, ['tests/startup.mjs'], env);
  await start(['--import', 'tsx', 'tests/browser-worker.ts'], env, 'TEST_ONLY_WORKER_READY');
  await start(
    ['node_modules/next/dist/bin/next', 'start', '--hostname', '0.0.0.0', '--port', '3300'],
    env,
    'Ready in',
  );
  await run('npm', ['run', 'test:browser'], env);
  await run('npm', ['audit', '--audit-level=moderate']);
  console.log('Verification completed; no live WhatsApp account was used.');
} finally {
  for (const child of services) child.kill('SIGTERM');
  await Promise.all(
    services.map(
      (child) =>
        new Promise((resolve) => {
          if (child.exitCode !== null) return resolve();
          const timer = setTimeout(() => {
            child.kill('SIGKILL');
            resolve();
          }, 5000);
          child.once('exit', () => {
            clearTimeout(timer);
            resolve();
          });
        }),
    ),
  );
}
