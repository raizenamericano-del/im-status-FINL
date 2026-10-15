import { writeTransaction } from '../db/write';
import { db } from '../db/client';
import { AppError, errorMessage } from '../security/errors';
import { open, seal } from '../security/crypto';
export const activity = (userId: string, kind: string) =>
  db.activity.create({ data: { userId, kind } });
export async function workerCondition(client: Pick<typeof db, 'workerHealth'> = db) {
  const state = await client.workerHealth.findUnique({ where: { id: 'primary' } });
  return {
    online: !!state && Date.now() - state.heartbeat.getTime() < 20000,
    storageReady: state?.storageReady ?? false,
    heartbeat: state?.heartbeat ?? null,
    provider: state?.provider ?? 'baileys',
  };
}
export async function requireWorker(client: Pick<typeof db, 'workerHealth'> = db) {
  const health = await workerCondition(client);
  if (!health.online) throw new AppError('WORKER_OFFLINE', 503);
  return health;
}
export async function sessionInfo(userId: string, challenge = false) {
  const [session, worker] = await Promise.all([
    db.waSession.findUnique({ where: { userId } }),
    workerCondition(),
  ]);
  let pairing: { type: 'qr' | 'code'; value: string } | null = null;
  if (
    challenge &&
    worker.online &&
    session?.challengeCipher &&
    session.challengeExpiresAt &&
    session.challengeExpiresAt > new Date()
  ) {
    pairing = JSON.parse(open(session.challengeCipher, `${userId}:challenge`));
  }
  return {
    state:
      !worker.online && session?.desired ? 'WORKER_OFFLINE' : (session?.state ?? 'DISCONNECTED'),
    desired: session?.desired ?? false,
    lastConnectedAt: session?.lastConnectedAt,
    error: session?.lastError ? errorMessage(session.lastError) : null,
    challenge: pairing,
    challengeExpiresAt: pairing ? session?.challengeExpiresAt : null,
    worker,
    enabled: process.env.ENABLE_WHATSAPP === 'true',
  };
}
export async function connect(userId: string, data: { method: 'qr' | 'code'; phone?: string }) {
  if (process.env.ENABLE_WHATSAPP !== 'true') throw new AppError('PROVIDER_DISABLED', 503);
  await requireWorker();
  return writeTransaction(async (tx) => {
    const s = await tx.waSession.update({
      where: { userId },
      data: {
        generation: { increment: 1 },
        desired: true,
        state: 'CONNECTING',
        lastError: null,
        challengeCipher: null,
        challengeExpiresAt: null,
      },
    });
    await tx.command.create({
      data: {
        userId,
        generation: s.generation,
        kind: 'CONNECT',
        payloadCipher: seal(JSON.stringify(data), `${userId}:command`),
      },
    });
    await tx.activity.create({ data: { userId, kind: 'CONNECT_REQUESTED' } });
    return { state: 'CONNECTING' };
  });
}
export async function disconnect(userId: string) {
  // Revocation is atomic with generation bump. Stale worker callbacks cannot re-persist credentials.
  await writeTransaction(async (tx) => {
    const s = await tx.waSession.update({
      where: { userId },
      data: {
        desired: false,
        generation: { increment: 1 },
        state: 'DISCONNECTED',
        challengeCipher: null,
        challengeExpiresAt: null,
        lastError: null,
      },
    });
    await tx.secret.deleteMany({ where: { userId } });
    await tx.status.updateMany({
      where: { userId },
      data: { descriptorCipher: null, thumbnail: null },
    });
    await tx.command.updateMany({
      where: { userId, state: 'WAITING' },
      data: { state: 'CANCELLED', payloadCipher: null },
    });
    await tx.command.create({ data: { userId, generation: s.generation, kind: 'DISCONNECT' } });
    await tx.activity.create({ data: { userId, kind: 'DISCONNECTED' } });
  });
}
export async function queueDownload(userId: string, statusId: string) {
  return writeTransaction(async (tx) => {
    // Serialize download/retry/delete races for this status.
    const status = await tx.status.findFirst({
      where: { id: statusId, userId },
      include: { media: true },
    });
    if (!status) throw new AppError('NOT_FOUND', 404);
    if (status.media?.deleteRequestedAt) throw new AppError('DELETION_PENDING', 409);
    if (status.media) return { mediaId: status.media.id, state: 'COMPLETED' };
    if (status.expiresAt < new Date() || !status.descriptorCipher)
      throw new AppError('MEDIA_EXPIRED', 410);
    const health = await requireWorker(tx);
    if (!health.storageReady) throw new AppError('STORAGE_ERROR', 503);
    const session = await tx.waSession.findUnique({ where: { userId } });
    if (session?.state !== 'CONNECTED' || !session.desired)
      throw new AppError('SESSION_OFFLINE', 409);
    const previous = await tx.downloadJob.findUnique({ where: { statusId } });
    if (previous && ['WAITING', 'PROCESSING'].includes(previous.state))
      return { jobId: previous.id, state: previous.state };
    const job = await tx.downloadJob.upsert({
      where: { statusId },
      create: { userId, statusId, kind: status.kind, contactName: status.contactName },
      update: { state: 'WAITING', errorCode: null, finishedAt: null },
    });
    return { jobId: job.id, state: job.state };
  });
}
export async function dashboard(userId: string) {
  const now = new Date();
  const [session, available, photos, videos, saved, completed, storage, recent, activityRows] =
    await Promise.all([
      sessionInfo(userId),
      db.status.count({
        where: { userId, expiresAt: { gt: now }, descriptorCipher: { not: null } },
      }),
      db.status.count({
        where: { userId, kind: 'PHOTO', expiresAt: { gt: now }, descriptorCipher: { not: null } },
      }),
      db.status.count({
        where: { userId, kind: 'VIDEO', expiresAt: { gt: now }, descriptorCipher: { not: null } },
      }),
      db.media.count({ where: { userId, deleteRequestedAt: null } }),
      db.downloadJob.count({ where: { userId, state: 'COMPLETED' } }),
      db.media.aggregate({ where: { userId }, _sum: { bytes: true } }),
      db.media.findMany({
        where: { userId, deleteRequestedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 4,
        select: mediaSelect,
      }),
      db.activity.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 5 }),
    ]);
  return {
    session,
    counts: { available, photos, videos, saved, completed, bytes: storage._sum.bytes ?? 0 },
    recent,
    activity: activityRows.map((a) => ({ id: a.id, kind: a.kind, createdAt: a.createdAt })),
  };
}
export const mediaSelect = {
  id: true,
  filename: true,
  contactName: true,
  kind: true,
  mime: true,
  bytes: true,
  duration: true,
  createdAt: true,
  statusId: true,
  deleteRequestedAt: true,
} as const;
