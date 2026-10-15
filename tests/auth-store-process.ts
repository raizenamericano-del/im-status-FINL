import { createHash } from 'node:crypto';
import { BufferJSON } from '@whiskeysockets/baileys';
import { authStore } from '../worker/auth-store';
import { db } from '../lib/db/client';
if (!new URL(process.env.DATABASE_URL ?? '').pathname.endsWith('_test.sqlite'))
  throw new Error('Test database required');
const [mode, userId, generation] = process.argv.slice(2);
const store = await authStore(userId, Number(generation));
if (mode === 'write') {
  await store.save();
  await store.state.keys.set({
    'pre-key': { '42': { public: Buffer.alloc(32, 1), private: Buffer.alloc(32, 2) } },
  });
}
const keys = await store.state.keys.get('pre-key', ['42']);
console.log(
  createHash('sha256')
    .update(JSON.stringify({ creds: store.state.creds, keys }, BufferJSON.replacer))
    .digest('hex'),
);
await db.$disconnect();
