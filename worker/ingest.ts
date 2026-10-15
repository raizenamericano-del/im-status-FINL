import { writeTransaction } from '../lib/db/write';
import { BufferJSON } from '@whiskeysockets/baileys';
import { seal } from '../lib/security/crypto';
import type { ReceivedStatus } from './providers/types';
export async function ingest(userId: string, generation: number, status: ReceivedStatus) {
  await writeTransaction(async (tx) => {
    const session = await tx.waSession.findUnique({ where: { userId } });
    if (!session?.desired || session.generation !== generation) return;
    const { descriptor, thumbnail, ...data } = status;
    const previous = await tx.status.findUnique({
      where: { userId_fingerprint: { userId, fingerprint: data.fingerprint } },
    });
    if (previous) return;
    await tx.status.create({
      data: {
        ...data,
        userId,
        thumbnail: thumbnail ? new Uint8Array(thumbnail) : null,
        descriptorCipher: seal(
          JSON.stringify(descriptor, BufferJSON.replacer),
          `${userId}:status:${data.fingerprint}`,
        ),
      },
    });
    await tx.activity.create({ data: { userId, kind: 'STATUS_RECEIVED' } });
  });
}
