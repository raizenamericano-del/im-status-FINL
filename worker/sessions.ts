import { writeTransaction } from '../lib/db/write';
import { db } from '../lib/db/client';
import { seal } from '../lib/security/crypto';
import { BaileysProvider } from './providers/baileys';
import type { Provider, ProviderHooks } from './providers/types';
import { ingest } from './ingest';
export type ProviderFactory = (
  userId: string,
  generation: number,
  hooks: ProviderHooks,
) => Provider;
export function providerFor(
  userId: string,
  generation: number,
  factory: ProviderFactory = (id, gen, hooks) => new BaileysProvider(id, gen, hooks),
): Provider {
  return factory(userId, generation, {
    async state(state, error) {
      await writeTransaction(async (tx) => {
        const result = await tx.waSession.updateMany({
          where: { userId, generation, desired: true },
          data: {
            state,
            lastError: error ?? null,
            ...(state === 'CONNECTED'
              ? { lastConnectedAt: new Date(), challengeCipher: null, challengeExpiresAt: null }
              : {}),
            ...(state === 'ERROR'
              ? { desired: false, challengeCipher: null, challengeExpiresAt: null }
              : {}),
          },
        });
        if (result.count && ['CONNECTED', 'ERROR', 'CONNECTING'].includes(state))
          await tx.activity.create({
            data: {
              userId,
              kind:
                state === 'CONNECTED'
                  ? 'CONNECTED'
                  : state === 'ERROR'
                    ? 'CONNECTION_ERROR'
                    : 'RECONNECTING',
            },
          });
        if (result.count && error === 'SESSION_EXPIRED')
          await tx.secret.deleteMany({ where: { userId } });
      });
    },
    async challenge(type, value) {
      await db.waSession.updateMany({
        where: { userId, generation, desired: true },
        data: {
          state: 'AWAITING_PAIRING',
          challengeCipher: seal(JSON.stringify({ type, value }), `${userId}:challenge`),
          challengeExpiresAt: new Date(Date.now() + (type === 'qr' ? 55000 : 120000)),
        },
      });
    },
    status: (value) => ingest(userId, generation, value),
  });
}
