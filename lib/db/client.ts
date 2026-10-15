import { PrismaClient } from '@prisma/client';
const globalDb = globalThis as unknown as { db?: PrismaClient };
export const db =
  globalDb.db ??
  new PrismaClient({ log: [], transactionOptions: { maxWait: 20000, timeout: 20000 } });
if (process.env.NODE_ENV !== 'production') globalDb.db = db;
