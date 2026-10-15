import { writeTransaction } from '../lib/db/write';
import { randomUUID } from 'node:crypto';
import { BufferJSON } from '@whiskeysockets/baileys';
import { db } from '../lib/db/client';
import { open } from '../lib/security/crypto';
import { AppError } from '../lib/security/errors';
import { QUOTA_BYTES } from '../lib/security/media';
import { saveStream, removeFile, cleanupOrphans } from '../lib/storage/files';
import type { MediaDescriptor, Provider } from './providers/types';
export async function processDownload(
  id: string,
  provider?: Provider,
  shutdownSignal?: AbortSignal,
) {
  const claimed = await db.downloadJob.updateMany({
    where: { id, state: 'WAITING' },
    data: { state: 'PROCESSING', attempts: { increment: 1 }, errorCode: null },
  });
  if (!claimed.count) return;
  const job = await db.downloadJob.findUniqueOrThrow({ where: { id }, include: { status: true } });
  let storageKey: string | undefined;
  const deadline = AbortSignal.timeout(45000);
  const signal = shutdownSignal ? AbortSignal.any([deadline, shutdownSignal]) : deadline;
  try {
    if (!job.status || job.status.expiresAt < new Date() || !job.status.descriptorCipher)
      throw new AppError('MEDIA_EXPIRED', 410);
    if (!provider) throw new AppError('SESSION_OFFLINE', 409);
    const used = await db.media.aggregate({ where: { userId: job.userId }, _sum: { bytes: true } });
    if ((used._sum.bytes ?? 0) >= QUOTA_BYTES) throw new AppError('STORAGE_QUOTA', 413);
    const descriptor = JSON.parse(
      open(job.status.descriptorCipher, `${job.userId}:status:${job.status.fingerprint}`),
      BufferJSON.reviver,
    ) as MediaDescriptor;
    const stream = await provider.download(descriptor, job.kind, signal);
    const mediaId = randomUUID();
    const file = await saveStream(
      job.userId,
      mediaId,
      job.kind,
      stream,
      signal,
      descriptor.fileSha256,
    );
    storageKey = file.storageKey;
    if ((used._sum.bytes ?? 0) + file.bytes > QUOTA_BYTES) throw new AppError('STORAGE_QUOTA', 413);
    await writeTransaction(async (tx) => {
      const session = await tx.waSession.findUnique({ where: { userId: job.userId } });
      if (!session?.desired) throw new AppError('SESSION_OFFLINE', 409);
      await tx.media.create({
        data: {
          id: mediaId,
          userId: job.userId,
          statusId: job.statusId,
          contactName: job.contactName,
          kind: job.kind,
          ...file,
        },
      });
      await tx.downloadJob.update({
        where: { id },
        data: { state: 'COMPLETED', finishedAt: new Date() },
      });
      await tx.activity.create({ data: { userId: job.userId, kind: 'DOWNLOAD_COMPLETED' } });
    });
    storageKey = undefined;
  } catch (error) {
    if (storageKey) await removeFile(storageKey).catch(() => {});
    const errorCode = shutdownSignal?.aborted
      ? 'DOWNLOAD_INTERRUPTED'
      : signal.aborted
        ? 'DOWNLOAD_TIMEOUT'
        : error instanceof AppError
          ? error.code
          : 'MEDIA_UNAVAILABLE';
    await db.$transaction([
      db.downloadJob.update({
        where: { id },
        data: { state: 'FAILED', errorCode, finishedAt: new Date() },
      }),
      db.activity.create({ data: { userId: job.userId, kind: 'DOWNLOAD_FAILED' } }),
    ]);
  }
}
export async function cleanup() {
  const now = new Date();
  const preferences = await db.preference.findMany();
  for (const p of preferences)
    await db.media.updateMany({
      where: {
        userId: p.userId,
        deleteRequestedAt: null,
        createdAt: { lt: new Date(Date.now() - p.retentionDays * 86400000) },
      },
      data: { deleteRequestedAt: now },
    });
  const removing = await db.media.findMany({
    where: { deleteRequestedAt: { not: null } },
    take: 100,
  });
  for (const m of removing) {
    try {
      await removeFile(m.storageKey);
      await db.$transaction([
        db.media.delete({ where: { id: m.id } }),
        db.activity.create({ data: { userId: m.userId, kind: 'MEDIA_DELETED' } }),
      ]);
    } catch {
      console.error(JSON.stringify({ event: 'media_delete_failed' }));
    }
  }
  await db.status.updateMany({
    where: { expiresAt: { lt: now }, descriptorCipher: { not: null } },
    data: { descriptorCipher: null, thumbnail: null },
  });
  await db.waSession.updateMany({
    where: { challengeExpiresAt: { lt: now } },
    data: { challengeCipher: null, challengeExpiresAt: null },
  });
  const cutoff = new Date(Date.now() - 90 * 86400000);
  await db.$transaction([
    db.authSession.deleteMany({ where: { expiresAt: { lt: now } } }),
    db.rateBucket.deleteMany({ where: { expiresAt: { lt: now } } }),
    db.command.deleteMany({
      where: { state: { not: 'WAITING' }, createdAt: { lt: new Date(Date.now() - 86400000) } },
    }),
    db.activity.deleteMany({ where: { createdAt: { lt: cutoff } } }),
    db.downloadJob.deleteMany({ where: { updatedAt: { lt: cutoff } } }),
    db.status.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 7 * 86400000) } } }),
  ]);
  await cleanupOrphans(
    new Set((await db.media.findMany({ select: { storageKey: true } })).map((m) => m.storageKey)),
  );
}
