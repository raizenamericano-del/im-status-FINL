import { db } from '../lib/db/client';
import { writeTransaction } from '../lib/db/write';
const url = new URL(process.env.DATABASE_URL || 'http://invalid');
if (url.protocol !== 'file:' || !url.pathname.endsWith('_test.sqlite'))
  throw new Error('Disposable SQLite test database required');
try {
  for (let i = 0; i < 20; i++)
    await writeTransaction(async (tx) => {
      const row = await tx.rateBucket.findUniqueOrThrow({
        where: { key: 'sqlite-concurrent-counter' },
      });
      await tx.rateBucket.update({ where: { key: row.key }, data: { count: row.count + 1 } });
    });
  console.log('SQLITE_WRITER_OK');
} finally {
  await db.$disconnect();
}
