import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
await mkdir('runtime', { recursive: true });
const root = await mkdtemp(resolve('runtime/startup_test_'));
const base = 'http://localhost:3301';
const env = {
  ...process.env,
  DATA_DIR: root,
  PORT: '3301',
  APP_ORIGIN: base,
  ADMIN_PASSWORD: 'Startup-test-admin-password!',
  ENCRYPTION_KEY: '',
  WORKER_SECRET: '',
  // Deliberately broken v1 configuration must never be used by the local version.
  DATABASE_URL: 'postgresql://private-old-user:private-old-password@unreachable.invalid:1/unused',
  SERVICE_ROLE: 'worker',
  WORKER_URL: 'http://unreachable.invalid:1',
  COOKIE_SECURE: 'false',
  ENABLE_WHATSAPP: 'false',
};
delete env.RAILWAY_PROJECT_ID;
delete env.RAILWAY_ENVIRONMENT_ID;
delete env.RAILWAY_PUBLIC_DOMAIN;
let child, db;
const allChildren = new Set();
let allLogs = '';
async function stop(proc = child) {
  if (!proc || proc.exitCode !== null) return;
  await new Promise((resolve) => {
    const timer = setTimeout(() => proc.kill('SIGKILL'), 15000);
    proc.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
    proc.kill('SIGTERM');
  });
}
function start(config = env, expectedFailure = false) {
  const proc = spawn(process.execPath, ['scripts/start.mjs'], {
    env: config,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  allChildren.add(proc);
  let logs = '';
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Local service startup timeout')), 45000);
    const capture = (data) => {
      logs += String(data);
      allLogs += String(data);
      if (!expectedFailure && logs.includes('Ready in') && logs.includes('worker_started')) {
        clearTimeout(timer);
        resolve(logs);
      }
    };
    proc.stdout.on('data', capture);
    proc.stderr.on('data', capture);
    proc.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    proc.once('exit', (code) => {
      clearTimeout(timer);
      if (expectedFailure && code !== 0) resolve(logs);
      else reject(new Error('Unexpected local service exit: ' + logs));
    });
  });
  return { proc, ready };
}
async function login() {
  const response = await fetch(base + '/api/auth/login', {
    method: 'POST',
    headers: { Origin: base, 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: env.ADMIN_PASSWORD }),
  });
  assert.equal(response.status, 200);
  return response.headers.get('set-cookie').split(';')[0];
}
try {
  let started = start({ ...env, ADMIN_PASSWORD: '' });
  child = started.proc;
  await started.ready;
  assert.equal((await fetch(base + '/api/health')).status, 200);
  assert.equal((await fetch(base + '/api/auth/config')).status, 503, 'no default admin password');
  await stop();
  started = start();
  child = started.proc;
  await started.ready;
  const cookie = await login();
  db = new PrismaClient({
    datasourceUrl: `file:${join(root, 'hub.sqlite')}?connection_limit=1&socket_timeout=15`,
  });
  const journal = await db.$queryRawUnsafe('PRAGMA journal_mode');
  assert.equal(journal[0].journal_mode, 'wal');
  const owner = await db.adminAccess.findUniqueOrThrow({ where: { id: 'owner' } });
  const keysBefore = createHash('sha256')
    .update(await readFile(join(root, 'server-secrets.json')))
    .digest('hex');
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6t1sAAAAASUVORK5CYII=',
    'base64',
  );
  const mediaId = randomUUID(),
    storageKey = `${owner.userId}/${mediaId}.png`;
  await mkdir(join(root, 'media', owner.userId), { recursive: true });
  await writeFile(join(root, 'media', storageKey), png);
  await db.media.create({
    data: {
      id: mediaId,
      userId: owner.userId,
      filename: 'TEST-persistence.png',
      contactName: 'TEST PERSISTENCE',
      kind: 'PHOTO',
      mime: 'image/png',
      bytes: png.length,
      sha256: createHash('sha256').update(png).digest('hex'),
      storageKey,
    },
  });
  const download = await fetch(`${base}/api/media/${mediaId}/file`, {
    headers: { Cookie: cookie },
  });
  assert.equal(download.status, 200);
  assert.deepEqual(Buffer.from(await download.arrayBuffer()), png);
  const duplicate = start(env, true);
  const denied = await duplicate.ready;
  assert.ok(denied.includes('INSTANCE_BUSY'));
  assert.equal((await fetch(base + '/api/health')).status, 200);
  await db.$disconnect();
  await stop();
  started = start();
  child = started.proc;
  await started.ready;
  assert.equal((await fetch(base + '/api/auth/me', { headers: { Cookie: cookie } })).status, 200);
  assert.equal(
    (await db.adminAccess.findUniqueOrThrow({ where: { id: 'owner' } })).userId,
    owner.userId,
  );
  assert.equal(
    createHash('sha256')
      .update(await readFile(join(root, 'server-secrets.json')))
      .digest('hex'),
    keysBefore,
  );
  const restored = await fetch(`${base}/api/media/${mediaId}/file`, {
    headers: { Cookie: cookie },
  });
  assert.equal(restored.status, 200);
  assert.deepEqual(Buffer.from(await restored.arrayBuffer()), png);
  // Kill the actual production worker and verify the supervisor stops the web too.
  const output = (await promisify(execFile)('ps', ['-eo', 'pid=,ppid=,args='])).stdout;
  const processes = output
    .trim()
    .split('\n')
    .map((line) => {
      const match = line.trim().match(/^(\d+)\s+(\d+)\s+(.+)$/);
      return match ? { pid: +match[1], parent: +match[2], args: match[3] } : null;
    })
    .filter(Boolean);
  const descendant = (p) => {
    let id = p.parent;
    for (let i = 0; i < 10; i++) {
      if (id === child.pid) return true;
      id = processes.find((x) => x.pid === id)?.parent || 0;
    }
    return false;
  };
  const worker = processes.find((p) => p.args.includes('worker/bootstrap.ts') && descendant(p));
  assert.ok(worker);
  const exited = new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Supervisor did not stop after worker crash')),
      15000,
    );
    child.once('exit', (code) => {
      clearTimeout(timer);
      resolve(code);
    });
  });
  process.kill(worker.pid, 'SIGKILL');
  assert.notEqual(await exited, 0);
  await assert.rejects(fetch(base + '/api/health'));
  const mismatch = start({ ...env, ENCRYPTION_KEY: 'd'.repeat(64) }, true);
  assert.ok((await mismatch.ready).includes('KEY_CONFIG_MISMATCH'));
  await db.$disconnect();
  db = undefined;
  await rm(join(root, 'server-secrets.json'));
  const missing = start(env, true);
  assert.ok((await missing.ready).includes('KEY_FILE_MISSING'));
  assert.ok(
    !allLogs.includes('private-old-password') &&
      !allLogs.includes('private-old-user') &&
      !allLogs.includes(env.ADMIN_PASSWORD),
  );
  await writeFile(
    'docs/startup-result.json',
    JSON.stringify(
      {
        database: 'SQLite WAL on isolated local directory',
        automaticMigration: 'passed',
        noPostgresConnection: 'passed',
        noDefaultAdminPassword: 'passed',
        realUnpairedWorkerAndWebStart: 'passed',
        secondInstanceRejected: 'passed',
        restartPreservesOwnerCookieKeysAndMediaBytes: 'passed',
        workerCrashStopsWeb: 'passed',
        mismatchedOrMissingKeysFailClosed: 'passed',
        liveWhatsApp: 'not tested',
        railwayVolume: 'not tested',
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    'PASS local startup: SQLite WAL, automatic migration, private stable keys, one-instance lock, real unpaired worker + web, restart persistence, crash supervision, safe failure',
  );
} finally {
  for (const proc of allChildren) await stop(proc);
  if (db) await db.$disconnect();
  await rm(root, { recursive: true, force: true });
}
