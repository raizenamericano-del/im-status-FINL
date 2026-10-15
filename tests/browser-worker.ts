// Explicit test-only service. No real WhatsApp connections. Refuses a non-test database.
import 'dotenv/config';
import { createHash } from 'node:crypto';
import { readFile, mkdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
if (!new URL(process.env.DATABASE_URL ?? '').pathname.endsWith('_test.sqlite'))
  throw new Error('Dedicated _test.sqlite database required');
const { db } = await import('../lib/db/client');
const { createWorkerServer } = await import('../worker/http');
const { providerFor } = await import('../worker/sessions');
const { storageReady } = await import('../lib/storage/files');
const { processDownload, cleanup } = await import('../worker/jobs');
const { MockProvider } = await import('./mock-provider');
await storageReady();
const fixtureRoot = resolve('runtime/browser-fixtures');
await mkdir(fixtureRoot, { recursive: true });
await promisify(execFile)('ffmpeg', [
  '-v',
  'error',
  '-f',
  'lavfi',
  '-i',
  'color=c=0x7da474:s=480x640',
  '-frames:v',
  '1',
  '-y',
  `${fixtureRoot}/photo.jpg`,
]);
await promisify(execFile)('ffmpeg', [
  '-v',
  'error',
  '-f',
  'lavfi',
  '-i',
  'testsrc=duration=2:size=320x240:rate=24',
  '-c:v',
  'libx264',
  '-pix_fmt',
  'yuv420p',
  '-y',
  `${fixtureRoot}/video.mp4`,
]);
const photo = await readFile(`${fixtureRoot}/photo.jpg`),
  video = await readFile(`${fixtureRoot}/video.mp4`);
const server = createWorkerServer(process.env.WORKER_SECRET!, () => true);
server.listen(Number(process.env.WORKER_PORT ?? 3213), '0.0.0.0');
const providers = new Map<string, InstanceType<typeof MockProvider>>();
let busy = false;
const loop = setInterval(() => {
  if (busy) return;
  busy = true;
  void (async () => {
    await db.workerHealth.upsert({
      where: { id: 'primary' },
      create: { id: 'primary', provider: 'mock-test-only', storageReady: true },
      update: { provider: 'mock-test-only', storageReady: true, heartbeat: new Date() },
    });
    for (const command of await db.command.findMany({
      where: { state: 'WAITING' },
      orderBy: { createdAt: 'asc' },
    })) {
      const session = await db.waSession.findUnique({ where: { userId: command.userId } });
      if (session?.generation === command.generation) {
        if (command.kind === 'CONNECT') {
          const provider = providerFor(
            command.userId,
            command.generation,
            (_id, _generation, hooks) => new MockProvider(hooks),
          ) as InstanceType<typeof MockProvider>;
          providers.set(command.userId, provider);
          await provider.connect('qr');
        } else if (command.kind === 'TEST_CONFIRM') {
          const provider = providers.get(command.userId)!;
          await provider.confirm();
          for (const [kind, file] of [
            ['PHOTO', photo],
            ['VIDEO', video],
          ] as const)
            await provider.emit({
              fingerprint: `browser-${kind}`,
              contactName: `TEST FIXTURE ${kind}`,
              kind,
              mime: kind === 'PHOTO' ? 'image/jpeg' : 'video/mp4',
              duration: kind === 'PHOTO' ? null : 2,
              postedAt: new Date(),
              expiresAt: new Date(Date.now() + 3600000),
              descriptor: {
                mediaKey: new Uint8Array(32),
                directPath: '/test-only',
                fileSha256: createHash('sha256').update(file).digest(),
              },
              thumbnail: kind === 'PHOTO' ? photo : null,
            });
        } else if (command.kind === 'DISCONNECT') {
          await providers.get(command.userId)?.close(true);
          providers.delete(command.userId);
        }
      }
      await db.command.update({
        where: { id: command.id },
        data: { state: 'DONE', payloadCipher: null },
      });
    }
    for (const job of await db.downloadJob.findMany({ where: { state: 'WAITING' } })) {
      const provider = providers.get(job.userId);
      if (provider) provider.payload = job.kind === 'PHOTO' ? photo : video;
      await processDownload(job.id, provider);
    }
    await cleanup();
  })()
    .catch(() => console.error('TEST worker failure'))
    .finally(() => {
      busy = false;
    });
}, 400);
process.on('SIGTERM', () => {
  clearInterval(loop);
  server.closeAllConnections();
  server.close();
  void db.$disconnect().then(() => process.exit(0));
});
console.log('TEST_ONLY_WORKER_READY');
