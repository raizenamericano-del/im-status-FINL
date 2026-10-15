import 'dotenv/config';
import { createWorkerServer } from './http';
import { db } from '../lib/db/client';
import { open, seal } from '../lib/security/crypto';
import { storageReady } from '../lib/storage/files';
import { providerFor } from './sessions';
import type { Provider } from './providers/types';
import { cleanup, processDownload } from './jobs';
const providers = new Map<string, Provider>();
let stopping = false,
  ready = false;
const secret = process.env.WORKER_SECRET ?? '';
if (secret.length < 32) throw new Error('WORKER_SECRET must be at least 32 characters');
seal('startup-check', 'worker');
// The single-service supervisor holds an OS flock for this data directory.
if (process.env.IMHUB_SUPERVISED !== '1') throw new Error('Use npm start');
ready = await storageReady();
const server = createWorkerServer(secret, () => ready);
server.listen(Number(process.env.WORKER_PORT ?? process.env.PORT ?? 3210), '127.0.0.1');
async function heartbeat() {
  await db.workerHealth.upsert({
    where: { id: 'primary' },
    create: { id: 'primary', provider: 'baileys', storageReady: ready },
    update: { heartbeat: new Date(), provider: 'baileys', storageReady: ready },
  });
}
const pulse = setInterval(() => {
  void heartbeat().catch(() => {
    ready = false;
  });
}, 5000);
async function startSession(
  userId: string,
  generation: number,
  method: 'qr' | 'code' = 'qr',
  phone?: string,
) {
  await providers.get(userId)?.close(false);
  providers.delete(userId);
  if (process.env.ENABLE_WHATSAPP !== 'true') {
    await db.waSession.updateMany({
      where: { userId, generation },
      data: { state: 'ERROR', lastError: 'PROVIDER_DISABLED', desired: false },
    });
    return;
  }
  const provider = providerFor(userId, generation);
  providers.set(userId, provider);
  await provider.connect(method, phone);
}
await db.downloadJob.updateMany({
  where: { state: 'PROCESSING' },
  data: { state: 'FAILED', errorCode: 'DOWNLOAD_INTERRUPTED', finishedAt: new Date() },
});
await db.command.updateMany({ where: { state: 'PROCESSING' }, data: { state: 'WAITING' } });
await heartbeat();
for (const s of await db.waSession.findMany({
  where: { desired: true, user: { adminAccess: { is: { id: 'owner' } } } },
})) {
  // Registered credentials may resume. Unregistered attempts must be explicitly restarted by the owner.
  const creds = await db.secret.findUnique({
    where: { userId_key: { userId: s.userId, key: 'creds' } },
  });
  const registered =
    creds && JSON.parse(open(creds.cipher, `${s.userId}:auth:creds`)).registered === true;
  if (registered) {
    await db.waSession.update({
      where: { userId: s.userId },
      data: { state: 'CONNECTING', challengeCipher: null, challengeExpiresAt: null },
    });
    await startSession(s.userId, s.generation);
  } else if (
    !(await db.command.count({
      where: { userId: s.userId, state: 'WAITING', generation: s.generation },
    }))
  )
    await db.waSession.update({
      where: { userId: s.userId },
      data: {
        desired: false,
        state: 'DISCONNECTED',
        challengeCipher: null,
        challengeExpiresAt: null,
      },
    });
}
let lastCleanup = 0;
let download: Promise<void> | undefined;
const shutdownController = new AbortController();
async function tick() {
  for (const cmd of await db.command.findMany({
    where: { state: 'WAITING' },
    orderBy: { createdAt: 'asc' },
    take: 10,
  })) {
    await db.command.update({ where: { id: cmd.id }, data: { state: 'PROCESSING' } });
    try {
      const session = await db.waSession.findUnique({ where: { userId: cmd.userId } });
      const owner = await db.adminAccess.findUnique({ where: { id: 'owner' } });
      if (session?.generation === cmd.generation && owner?.userId === cmd.userId) {
        if (cmd.kind === 'DISCONNECT') {
          await providers.get(cmd.userId)?.close(true);
          providers.delete(cmd.userId);
        }
        if (cmd.kind === 'CONNECT' && session.desired) {
          const payload = cmd.payloadCipher
            ? (JSON.parse(open(cmd.payloadCipher, `${cmd.userId}:command`)) as {
                method: 'qr' | 'code';
                phone?: string;
              })
            : { method: 'qr' as const };
          await startSession(cmd.userId, cmd.generation, payload.method, payload.phone);
        }
      }
    } catch {
      await db.waSession.updateMany({
        where: { userId: cmd.userId, generation: cmd.generation },
        data: {
          state: 'ERROR',
          lastError: 'CONNECTION_FAILED',
          desired: false,
          challengeCipher: null,
          challengeExpiresAt: null,
        },
      });
    }
    await db.command.update({
      where: { id: cmd.id },
      data: { state: 'DONE', payloadCipher: null },
    });
  }
  if (!download) {
    const job = await db.downloadJob.findFirst({
      where: { state: 'WAITING' },
      orderBy: { createdAt: 'asc' },
    });
    if (job)
      download = processDownload(job.id, providers.get(job.userId), shutdownController.signal)
        .catch(() => {
          console.error(JSON.stringify({ event: 'worker_tick_failed' }));
        })
        .finally(() => {
          download = undefined;
        });
  }
  if (Date.now() - lastCleanup > 30000) {
    ready = await storageReady();
    await cleanup();
    lastCleanup = Date.now();
  }
}
async function shutdown() {
  if (stopping) return;
  stopping = true;
  clearInterval(pulse);
  server.close();
  shutdownController.abort();
  await download;
  for (const provider of providers.values()) await provider.close(false);
  await db.workerHealth.updateMany({
    where: { id: 'primary' },
    data: { heartbeat: new Date(0), storageReady: false },
  });
  await db.$disconnect();
  process.exit(0);
}
process.on('SIGTERM', () => {
  void shutdown();
});
process.on('SIGINT', () => {
  void shutdown();
});
console.log(JSON.stringify({ event: 'worker_started', provider: 'baileys', storageReady: ready }));
while (!stopping) {
  try {
    await tick();
  } catch {
    ready = false;
    console.error(JSON.stringify({ event: 'worker_tick_failed' }));
  }
  await new Promise((resolve) => setTimeout(resolve, 1500));
}
