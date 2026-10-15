import { spawn } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { prepareConfig } from './config.mjs';
const children = new Set();
let stopping = false;
function launch(args, env, capture = false) {
  const child = spawn(process.execPath, args, {
    env,
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });
  children.add(child);
  child.once('exit', () => children.delete(child));
  return child;
}
async function shutdown(code) {
  if (stopping) return;
  stopping = true;
  const pending = [...children].map(
    (child) =>
      new Promise((resolve) => {
        if (child.exitCode !== null) return resolve();
        const timer = setTimeout(() => child.kill('SIGKILL'), 8000);
        child.once('exit', () => {
          clearTimeout(timer);
          resolve();
        });
        child.kill('SIGTERM');
      }),
  );
  await Promise.all(pending);
  process.exit(code);
}
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => void shutdown(0));
try {
  const env = await prepareConfig();
  const migration = launch(['node_modules/prisma/build/index.js', 'migrate', 'deploy'], env, true);
  let diagnostic = '';
  const capture = (data) => {
    diagnostic = (diagnostic + String(data)).slice(-8192);
  };
  migration.stdout.on('data', capture);
  migration.stderr.on('data', capture);
  await new Promise((resolve, reject) => {
    migration.once('error', () => reject(new Error('MIGRATION_FAILED')));
    migration.once('exit', (code) =>
      code === 0
        ? resolve()
        : reject(new Error(diagnostic.match(/\bP\d{4}\b/)?.[0] || 'MIGRATION_FAILED')),
    );
  });
  const db = new PrismaClient({ datasourceUrl: env.DATABASE_URL });
  try {
    await db.$queryRawUnsafe('PRAGMA journal_mode = WAL');
    await db.$queryRawUnsafe('PRAGMA busy_timeout = 15000');
  } finally {
    await db.$disconnect();
  }
  console.log(
    JSON.stringify({ event: 'local_database_ready', engine: 'sqlite', version: '2.0.0' }),
  );
  for (const args of [
    ['--import', 'tsx', 'worker/bootstrap.ts'],
    [
      'node_modules/next/dist/bin/next',
      process.argv.includes('--dev') ? 'dev' : 'start',
      '--hostname',
      '0.0.0.0',
      '--port',
      env.PORT,
    ],
  ]) {
    const child = launch(args, env);
    child.once('error', () => {
      console.error('SERVICE_FAILED');
      void shutdown(1);
    });
    child.once('exit', () => {
      if (!stopping) {
        console.error(
          'SERVICE_EXITED: seluruh service dihentikan agar tidak berjalan setengah siap.',
        );
        void shutdown(1);
      }
    });
  }
} catch (error) {
  const allowed = [
    'DATA_VOLUME_REQUIRED',
    'KEY_FILE_MISSING',
    'KEY_FILE_INVALID',
    'KEY_CONFIG_MISMATCH',
    'INVALID_APP_ORIGIN',
    'INVALID_PUBLIC_DOMAIN',
    'INVALID_PORT',
    'MIGRATION_FAILED',
  ];
  const code =
    allowed.includes(error?.message) || /^P\d{4}$/.test(error?.message || '')
      ? error.message
      : 'LOCAL_SETUP_FAILED';
  console.error(JSON.stringify({ event: 'local_setup_failed', code }));
  console.error(
    'Periksa volume /data, izin tulis, dan konfigurasi. Jangan hapus database atau file server-secrets.json.',
  );
  await shutdown(1);
}
