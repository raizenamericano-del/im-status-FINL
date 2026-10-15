import { Prisma } from '@prisma/client';
import { db } from './client';
/** SQLite reserves its single writer before any reads: no deferred read/upgrade races. */
export async function writeTransaction<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await db.$transaction(
        async (tx) => {
          await tx.$executeRaw`UPDATE "User" SET "name" = "name" WHERE 1 = 0`;
          return fn(tx);
        },
        { maxWait: 20000, timeout: 20000 },
      );
    } catch (error) {
      if (
        attempt >= 2 ||
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        !['P1008', 'P2034'].includes(error.code)
      )
        throw error;
      await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
    }
  }
}
