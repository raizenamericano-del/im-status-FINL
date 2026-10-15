import { db } from '../db/client';
import { digest } from './crypto';
import { AppError } from './errors';
export async function rateLimit(identity: string, limit: number, seconds = 60) {
  const window = Math.floor(Date.now() / (seconds * 1000));
  const key = digest(`${identity}:${window}`);
  const bucket = await db.rateBucket.upsert({
    where: { key },
    create: { key, count: 1, expiresAt: new Date((window + 1) * seconds * 1000) },
    update: { count: { increment: 1 } },
  });
  if (bucket.count > limit) throw new AppError('RATE_LIMITED', 429);
}
