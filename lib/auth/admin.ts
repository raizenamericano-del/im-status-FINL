import { writeTransaction } from '../db/write';
import { randomBytes, randomUUID } from 'node:crypto';
import { passwordHash } from './auth';
import { adminPasswordVersion } from './admin-config';

/** Creates a dedicated owner, never silently adopts a legacy user's email/data. */
export async function ensureAdmin() {
  const version = adminPasswordVersion();
  return writeTransaction(async (tx) => {
    const existing = await tx.adminAccess.findUnique({
      where: { id: 'owner' },
      include: { user: true },
    });
    if (existing) {
      if (existing.credentialVersion !== version) {
        await tx.authSession.deleteMany({ where: { userId: existing.userId } });
        await tx.adminAccess.update({
          where: { id: 'owner' },
          data: { credentialVersion: version },
        });
      }
      return existing.user;
    }
    const user = await tx.user.create({
      data: {
        name: 'Admin',
        email: `admin-${randomUUID()}@im-status-hub.invalid`,
        // Legacy required column; not used for admin login and not derived from ADMIN_PASSWORD.
        passwordHash: await passwordHash(randomBytes(32).toString('hex')),
        whatsapp: { create: {} },
        preferences: { create: {} },
      },
    });
    await tx.adminAccess.create({
      data: { id: 'owner', userId: user.id, credentialVersion: version },
    });
    return user;
  });
}
