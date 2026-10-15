import { writeTransaction } from '../lib/db/write';
import {
  BufferJSON,
  initAuthCreds,
  proto,
  type AuthenticationCreds,
  type AuthenticationState,
  type SignalDataTypeMap,
} from '@whiskeysockets/baileys';
import { db } from '../lib/db/client';
import { open, seal } from '../lib/security/crypto';
export async function authStore(userId: string, generation: number) {
  async function read(key: string): Promise<unknown> {
    const row = await db.secret.findUnique({ where: { userId_key: { userId, key } } });
    return row
      ? JSON.parse(open(row.cipher, `${userId}:auth:${key}`), BufferJSON.reviver)
      : undefined;
  }
  const pending = new Set<Promise<void>>();
  async function persist(entries: [string, unknown][]) {
    await writeTransaction(async (tx) => {
      const session = await tx.waSession.findUnique({ where: { userId } });
      if (!session?.desired || session.generation !== generation) return;
      for (const [key, value] of entries) {
        if (value == null) await tx.secret.deleteMany({ where: { userId, key } });
        else {
          const cipher = seal(JSON.stringify(value, BufferJSON.replacer), `${userId}:auth:${key}`);
          await tx.secret.upsert({
            where: { userId_key: { userId, key } },
            create: { userId, key, cipher },
            update: { cipher },
          });
        }
      }
    });
  }
  function write(entries: [string, unknown][]) {
    const task = persist(entries);
    pending.add(task);
    task.then(
      () => pending.delete(task),
      () => pending.delete(task),
    );
    return task;
  }
  const creds = ((await read('creds')) as AuthenticationCreds | undefined) ?? initAuthCreds();
  const state: AuthenticationState = {
    creds,
    keys: {
      get: async <T extends keyof SignalDataTypeMap>(type: T, ids: string[]) => {
        const data: { [key: string]: SignalDataTypeMap[T] } = {};
        await Promise.all(
          ids.map(async (id) => {
            let value = await read(`${type}:${id}`);
            if (type === 'app-state-sync-key' && value)
              value = proto.Message.AppStateSyncKeyData.fromObject(
                value as Record<string, unknown>,
              );
            if (value) data[id] = value as SignalDataTypeMap[T];
          }),
        );
        return data;
      },
      set: async (data) => {
        const entries: [string, unknown][] = [];
        for (const [category, values] of Object.entries(data))
          for (const [id, value] of Object.entries(values ?? {}))
            entries.push([`${category}:${id}`, value]);
        await write(entries);
      },
    },
  };
  return {
    state,
    save: () => write([['creds', creds]]),
    flush: async () => {
      await Promise.allSettled([...pending]);
    },
  };
}
