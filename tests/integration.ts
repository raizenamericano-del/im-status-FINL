import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith('_test.sqlite'))
  throw new Error(
    'Set TEST_DATABASE_URL to a dedicated database ending in _test.sqlite. All test data will be deleted.',
  );
process.env.DATABASE_URL = url;
process.env.APP_ORIGIN = 'http://localhost:3300';
process.env.ENCRYPTION_KEY = 'b'.repeat(64);
process.env.ADMIN_PASSWORD = 'Integration-admin-password-2026!';
delete process.env.REGISTRATION_INVITE;
process.env.WORKER_SECRET = 'integration-worker-secret-not-production-2026';
process.env.MEDIA_ROOT = resolve('runtime/integration-media');
process.env.WORKER_URL = 'http://127.0.0.1:3212';
process.env.ENABLE_WHATSAPP = 'true';
const { db } = await import('../lib/db/client');
const { GET, POST, DELETE, PATCH } = await import('../app/api/[...path]/route');
const { createWorkerServer } = await import('../worker/http');
const { storageReady, filePath } = await import('../lib/storage/files');
const { processDownload, cleanup } = await import('../worker/jobs');
const { providerFor } = await import('../worker/sessions');
const { authStore } = await import('../worker/auth-store');
const { seal, digest, csrfFor } = await import('../lib/security/crypto');
const { adminPasswordVersion } = await import('../lib/auth/admin-config');
const { MockProvider, fixturePng } = await import('./mock-provider');
const { rateLimit } = await import('../lib/security/rate');
await db.$queryRawUnsafe('PRAGMA journal_mode = WAL');
await db.user.deleteMany();
await db.rateBucket.deleteMany();
await db.workerHealth.deleteMany();
await storageReady();
const server = createWorkerServer(process.env.WORKER_SECRET, () => true);
await new Promise<void>((resolve) => server.listen(3212, '127.0.0.1', resolve));
await db.workerHealth.create({
  data: { id: 'primary', provider: 'mock-test-only', storageReady: true },
});
type Login = { cookie: string; csrf: string; userId: string };
let cases = 0;
async function check(name: string, fn: () => Promise<void>) {
  await fn();
  cases++;
  console.log(`PASS ${name}`);
}
async function request(
  path: string,
  method = 'GET',
  data?: unknown,
  login?: Login,
  extra: Record<string, string> = {},
  signal?: AbortSignal,
) {
  const req = new Request(`http://localhost:3300/api/${path}`, {
    method,
    headers: {
      Origin: 'http://localhost:3300',
      ...(data !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(login ? { Cookie: login.cookie, 'X-CSRF-Token': login.csrf } : {}),
      ...extra,
    },
    body: data !== undefined ? JSON.stringify(data) : undefined,
    signal,
  });
  return ({ GET, POST, DELETE, PATCH } as Record<string, typeof GET>)[method](req);
}
async function payload<T>(res: Response): Promise<T> {
  return (await res.json()).data as T;
}
async function adminLogin(): Promise<Login> {
  const response = await request('auth/login', 'POST', { password: process.env.ADMIN_PASSWORD });
  assert.equal(response.status, 200);
  const cookie = response.headers.get('set-cookie')!.split(';')[0];
  const data = await payload<{ csrf: string }>(response);
  const me = await payload<{ user: { id: string } }>(
    await request('auth/me', 'GET', undefined, { cookie, csrf: data.csrf, userId: '' }),
  );
  return { cookie, csrf: data.csrf, userId: me.user.id };
}
const legacy = await db.user.create({
  data: {
    email: 'legacy-integration@imhub.test',
    name: 'TEST LEGACY',
    passwordHash: 'disabled',
    whatsapp: { create: {} },
    preferences: { create: {} },
  },
});
const legacyToken = randomBytes(32).toString('hex');
// Even a correctly versioned foreign session cannot become the singleton administrator.
await db.authSession.create({
  data: {
    id: digest(legacyToken),
    userId: legacy.id,
    authVersion: adminPasswordVersion(),
    expiresAt: new Date(Date.now() + 3600000),
  },
});
const b: Login = {
  userId: legacy.id,
  cookie: `im_session=${legacyToken}`,
  csrf: csrfFor(legacyToken),
};
const [a, secondAdminLogin] = await Promise.all([adminLogin(), adminLogin()]);
let statusId = '',
  mediaId = '',
  generation = 0;
let provider: InstanceType<typeof MockProvider>;
try {
  await check(
    'password-only login atomically bootstraps one dedicated admin; registration is disabled',
    async () => {
      assert.equal(a.userId, secondAdminLogin.userId);
      assert.notEqual(a.userId, b.userId);
      assert.equal(await db.adminAccess.count(), 1);
      assert.equal(await db.user.count(), 2);
      const created = await db.user.findUniqueOrThrow({ where: { id: a.userId } });
      assert.equal(created.name, 'Admin');
      assert.ok(!created.passwordHash.includes(process.env.ADMIN_PASSWORD!));
      assert.equal(
        (
          await request('auth/register', 'POST', {
            name: 'Nobody',
            email: 'no@imhub.test',
            password: 'not-a-register-password',
          })
        ).status,
        404,
      );
      assert.equal(
        (await request('auth/login', 'POST', { password: 'wrong-admin-password' })).status,
        401,
      );
      assert.equal(
        (
          await request('auth/login', 'POST', {
            password: process.env.ADMIN_PASSWORD,
            email: legacy.email,
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await request('auth/login', 'POST', { password: process.env.ADMIN_PASSWORD }, undefined, {
            Origin: 'https://evil.test',
          })
        ).status,
        403,
      );
      assert.equal(await db.user.count(), 2);
    },
  );
  await check('missing admin setup fails closed without leaking credentials', async () => {
    const saved = process.env.ADMIN_PASSWORD;
    try {
      process.env.ADMIN_PASSWORD = '';
      const response = await request('auth/config');
      assert.equal(response.status, 503);
      assert.equal((await response.json()).error.code, 'ADMIN_SETUP_REQUIRED');
      assert.equal(
        (await request('auth/login', 'POST', { password: 'any-password-value' })).status,
        503,
      );
    } finally {
      process.env.ADMIN_PASSWORD = saved;
    }
    const config = await request('auth/config');
    assert.equal(config.status, 200);
    const text = await config.text();
    assert.ok(!text.includes(saved!));
    assert.ok(!text.includes(process.env.ENCRYPTION_KEY!));
  });
  await check(
    'legacy sessions are denied and the admin cannot read another user resources',
    async () => {
      assert.equal((await request('auth/me', 'GET', undefined, b)).status, 401);
      const foreign = await db.status.create({
        data: {
          userId: b.userId,
          fingerprint: 'foreign',
          kind: 'PHOTO',
          mime: 'image/jpeg',
          contactName: 'TEST FOREIGN',
          postedAt: new Date(),
          expiresAt: new Date(Date.now() + 3600000),
          descriptorCipher: 'not-returned',
        },
      });
      assert.equal((await request(`statuses/${foreign.id}`, 'GET', undefined, a)).status, 404);
      assert.equal(
        (await request(`statuses/${foreign.id}/thumbnail`, 'GET', undefined, a)).status,
        404,
      );
      assert.equal(
        (await request(`statuses/${foreign.id}/download`, 'POST', undefined, a)).status,
        404,
      );
      const foreignMedia = await db.media.create({
        data: {
          userId: b.userId,
          filename: 'foreign.jpg',
          contactName: 'TEST FOREIGN',
          kind: 'PHOTO',
          mime: 'image/jpeg',
          bytes: 1,
          storageKey: 'never-used',
          sha256: 'none',
        },
      });
      for (const path of [`media/${foreignMedia.id}`, `media/${foreignMedia.id}/file`])
        assert.equal((await request(path, 'GET', undefined, a)).status, 404);
      assert.equal((await request(`media/${foreignMedia.id}`, 'DELETE', undefined, a)).status, 404);
      await db.media.delete({ where: { id: foreignMedia.id } });
    },
  );
  await check('health is public; all personal endpoints require authentication', async () => {
    assert.equal((await request('health')).status, 200);
    for (const path of [
      'dashboard',
      'wa/session',
      'statuses',
      'library',
      'history',
      'activity',
      'preferences',
      'events',
      `media/${randomUUID()}`,
    ])
      assert.equal((await request(path)).status, 401, path);
    for (const path of ['wa/connect', 'wa/disconnect', `statuses/${randomUUID()}/download`])
      assert.equal((await request(path, 'POST', {})).status, 401);
  });
  await check(
    'missing schema returns a specific safe error for readiness and admin login',
    async () => {
      // This suite already enforces an isolated disposable _test database.
      await db.$executeRaw`ALTER TABLE "RateBucket" RENAME TO "RateBucket_schema_test"`;
      try {
        for (const response of [
          await request('health'),
          await request('auth/login', 'POST', { password: process.env.ADMIN_PASSWORD }),
        ]) {
          assert.equal(response.status, 503);
          const result = await response.json();
          assert.equal(result.error.code, 'DATABASE_NOT_READY');
          assert.ok(!JSON.stringify(result).includes('RateBucket'));
          assert.ok(!JSON.stringify(result).includes(process.env.DATABASE_URL!));
        }
      } finally {
        await db.$executeRaw`ALTER TABLE "RateBucket_schema_test" RENAME TO "RateBucket"`;
      }
      assert.equal((await request('health')).status, 200);
    },
  );
  await check(
    'admin table readiness errors are safe and recover after schema restoration',
    async () => {
      await db.$executeRaw`ALTER TABLE "AdminAccess" RENAME TO "AdminAccess_schema_test"`;
      try {
        for (const path of ['health', 'auth/config']) {
          const response = await request(path);
          assert.equal(response.status, 503);
          const data = await response.json();
          assert.equal(data.error.code, 'DATABASE_NOT_READY');
          assert.ok(!JSON.stringify(data).includes('AdminAccess'));
        }
      } finally {
        await db.$executeRaw`ALTER TABLE "AdminAccess_schema_test" RENAME TO "AdminAccess"`;
      }
      assert.equal((await request('auth/config')).status, 200);
    },
  );
  await check('CSRF, origin and consent are enforced', async () => {
    assert.equal(
      (
        await request('wa/connect', 'POST', { consent: true, method: 'qr' }, a, {
          'X-CSRF-Token': '',
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await request('wa/connect', 'POST', { consent: true, method: 'qr' }, a, {
          Origin: 'https://evil.test',
        })
      ).status,
      403,
    );
    assert.equal(
      (await request('wa/connect', 'POST', { consent: false, method: 'qr' }, a)).status,
      400,
    );
    assert.equal(
      (await request('wa/connect', 'POST', { consent: true, method: 'code', phone: 'invalid' }, a))
        .status,
      400,
    );
  });
  await check('pairing challenge does not mean connected; only provider open does', async () => {
    assert.equal(
      (await request('wa/connect', 'POST', { consent: true, method: 'qr' }, a)).status,
      202,
    );
    const session = await db.waSession.findUniqueOrThrow({ where: { userId: a.userId } });
    generation = session.generation;
    assert.equal(session.state, 'CONNECTING');
    provider = providerFor(
      a.userId,
      generation,
      (_id, _gen, hooks) => new MockProvider(hooks),
    ) as InstanceType<typeof MockProvider>;
    await provider.connect('qr');
    const info = await payload<{ state: string; challenge: { value: string } }>(
      await request('wa/session', 'GET', undefined, a),
    );
    assert.equal(info.state, 'AWAITING_PAIRING');
    assert.ok(info.challenge.value.startsWith('TEST-ONLY'));
    const privateRow = await db.waSession.findUniqueOrThrow({ where: { userId: a.userId } });
    assert.ok(!privateRow.challengeCipher?.includes('TEST-ONLY'));
    assert.equal((await request('wa/session', 'GET', undefined, b)).status, 401);
    await provider.confirm();
    assert.equal(
      (await payload<{ state: string }>(await request('wa/session', 'GET', undefined, a))).state,
      'CONNECTED',
    );
  });
  await check('auth credentials survive a real child-process restart encrypted', async () => {
    const run = (mode: string) =>
      promisify(execFile)(
        process.execPath,
        ['--import', 'tsx', 'tests/auth-store-process.ts', mode, a.userId, String(generation)],
        { env: process.env },
      );
    const first = (await run('write')).stdout.trim(),
      second = (await run('read')).stdout.trim();
    assert.equal(first, second);
    assert.match(first, /^[a-f0-9]{64}$/);
    const rows = await db.secret.findMany({ where: { userId: a.userId } });
    assert.ok(rows.length >= 2);
    assert.ok(rows.every((s) => s.cipher.startsWith('v1.') && !s.cipher.includes('private')));
  });
  await check('deduplicated status ingestion persists only owner-scoped metadata', async () => {
    const status = {
      fingerprint: 'fixture-photo-1',
      contactName: 'TEST PHOTO',
      kind: 'PHOTO' as const,
      mime: 'image/png',
      duration: null,
      postedAt: new Date(),
      expiresAt: new Date(Date.now() + 3600000),
      descriptor: {
        url: 'https://mmg.whatsapp.net/test.enc',
        mediaKey: new Uint8Array(32),
        fileSha256: createHash('sha256').update(fixturePng).digest(),
      },
      thumbnail: null,
    };
    await provider.emit(status);
    await provider.emit(status);
    const list = await payload<{ total: number; items: { id: string }[] }>(
      await request('statuses', 'GET', undefined, a),
    );
    assert.equal(list.total, 1);
    statusId = list.items[0].id;
    assert.equal((await request('statuses', 'GET', undefined, b)).status, 401);
    const raw = await db.status.findUniqueOrThrow({ where: { id: statusId } });
    assert.ok(!raw.descriptorCipher?.includes('https:'));
    assert.equal((await request(`statuses/${statusId}`, 'GET', undefined, b)).status, 401);
    assert.equal(
      (await request(`statuses/${statusId}/download`, 'POST', undefined, b)).status,
      401,
    );
  });
  await check(
    'download jobs deduplicate concurrent requests and complete after actual file bytes exist',
    async () => {
      const responses = await Promise.all([
        request(`statuses/${statusId}/download`, 'POST', undefined, a),
        request(`statuses/${statusId}/download`, 'POST', undefined, a),
      ]);
      const values = await Promise.all(responses.map((r) => payload<{ jobId: string }>(r)));
      assert.equal(values[0].jobId, values[1].jobId);
      assert.equal(await db.media.count({ where: { userId: a.userId } }), 0);
      await processDownload(values[0].jobId, provider);
      const job = await db.downloadJob.findUniqueOrThrow({ where: { id: values[0].jobId } });
      assert.equal(job.state, 'COMPLETED');
      assert.equal(job.attempts, 1);
      const media = await db.media.findFirstOrThrow({ where: { userId: a.userId } });
      mediaId = media.id;
      assert.equal(media.bytes, fixturePng.length);
      assert.deepEqual(await readFile(filePath(media.storageKey)), fixturePng);
      assert.equal(
        (
          await payload<{ mediaId: string }>(
            await request(`statuses/${statusId}/download`, 'POST', undefined, a),
          )
        ).mediaId,
        mediaId,
      );
      assert.equal(await db.downloadJob.count({ where: { userId: a.userId } }), 1);
    },
  );
  await check(
    'HTTP file service streams exact bytes, ranges and safe filenames; rejects foreign owners',
    async () => {
      const res = await request(`media/${mediaId}/file?download=1`, 'GET', undefined, a);
      assert.equal(res.status, 200);
      assert.ok(res.headers.get('content-disposition')?.startsWith('attachment'));
      assert.deepEqual(Buffer.from(await res.arrayBuffer()), fixturePng);
      const range = await request(`media/${mediaId}/file`, 'GET', undefined, a, {
        Range: 'bytes=0-9',
      });
      assert.equal(range.status, 206);
      assert.equal((await range.arrayBuffer()).byteLength, 10);
      assert.equal(
        (await request(`media/${mediaId}/file`, 'GET', undefined, a, { Range: 'bytes=9999-' }))
          .status,
        416,
      );
      for (const endpoint of [`media/${mediaId}`, `media/${mediaId}/file`])
        assert.equal((await request(endpoint, 'GET', undefined, b)).status, 401);
      assert.equal((await request(`media/${mediaId}`, 'DELETE', undefined, b)).status, 401);
      assert.equal((await fetch(`${process.env.WORKER_URL}/media/${mediaId}`)).status, 401);
      assert.equal(
        (
          await fetch(`${process.env.WORKER_URL}/media/${mediaId}`, {
            headers: {
              Authorization: `Bearer ${process.env.WORKER_SECRET}`,
              'X-User-Id': b.userId,
            },
          })
        ).status,
        404,
      );
    },
  );
  await check('search, filters and library counts use actual persisted records', async () => {
    assert.equal(
      (
        await payload<{ total: number }>(
          await request('statuses?filter=saved', 'GET', undefined, a),
        )
      ).total,
      1,
    );
    assert.equal(
      (
        await payload<{ total: number }>(
          await request('statuses?filter=unsaved', 'GET', undefined, a),
        )
      ).total,
      0,
    );
    assert.equal(
      (
        await payload<{ total: number }>(
          await request('statuses?filter=video', 'GET', undefined, a),
        )
      ).total,
      0,
    );
    assert.equal(
      (await payload<{ total: number }>(await request('library?q=status-', 'GET', undefined, a)))
        .total,
      1,
    );
    assert.equal(
      (await payload<{ total: number }>(await request('library?q=not-found', 'GET', undefined, a)))
        .total,
      0,
    );
    assert.equal((await request('library', 'GET', undefined, b)).status, 401);
  });
  await check(
    'SSE emits only authenticated owner updates without challenges or session secrets',
    async () => {
      const controller = new AbortController();
      const res = await request('events', 'GET', undefined, a, {}, controller.signal),
        reader = res.body!.getReader();
      const first = await reader.read(),
        text = new TextDecoder().decode(first.value);
      assert.ok(text.includes('event: update'));
      assert.ok(!text.includes('TEST-ONLY-QR'));
      assert.ok(!text.includes(process.env.WORKER_SECRET!));
      assert.ok(!text.includes(b.userId));
      controller.abort();
      await reader.cancel();
    },
  );
  await check(
    'confirmed deletion hides media immediately and physically removes bytes during cleanup',
    async () => {
      const media = await db.media.findUniqueOrThrow({ where: { id: mediaId } });
      assert.equal((await request(`media/${mediaId}`, 'DELETE', undefined, a)).status, 202);
      assert.equal((await request(`media/${mediaId}/file`, 'GET', undefined, a)).status, 404);
      await cleanup();
      assert.equal(await db.media.count({ where: { id: mediaId } }), 0);
      await assert.rejects(readFile(filePath(media.storageKey)));
    },
  );
  await check('provider error and timeout become durable failed jobs; retry is safe', async () => {
    provider.mode = 'fail';
    let job = await payload<{ jobId: string }>(
      await request(`statuses/${statusId}/download`, 'POST', undefined, a),
    );
    await processDownload(job.jobId, provider);
    assert.equal(
      (await db.downloadJob.findUniqueOrThrow({ where: { id: job.jobId } })).errorCode,
      'MEDIA_UNAVAILABLE',
    );
    provider.mode = 'timeout';
    job = await payload<{ jobId: string }>(
      await request(`statuses/${statusId}/download`, 'POST', undefined, a),
    );
    await processDownload(job.jobId, provider);
    assert.equal(
      (await db.downloadJob.findUniqueOrThrow({ where: { id: job.jobId } })).errorCode,
      'DOWNLOAD_TIMEOUT',
    );
    provider.mode = 'ok';
    job = await payload<{ jobId: string }>(
      await request(`statuses/${statusId}/download`, 'POST', undefined, a),
    );
    await processDownload(job.jobId, provider);
    const stored = await db.downloadJob.findUniqueOrThrow({ where: { id: job.jobId } });
    assert.equal(stored.state, 'COMPLETED');
    assert.equal(stored.attempts, 4);
  });
  await check('automatic retention removes old media and expired descriptors', async () => {
    assert.equal(
      (await request('preferences', 'PATCH', { retentionDays: 1, notifications: false }, a)).status,
      200,
    );
    await db.media.updateMany({
      where: { userId: a.userId },
      data: { createdAt: new Date(Date.now() - 2 * 86400000) },
    });
    await db.status.update({
      where: { id: statusId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await cleanup();
    assert.equal(await db.media.count({ where: { userId: a.userId } }), 0);
    assert.equal(
      (await db.status.findUniqueOrThrow({ where: { id: statusId } })).descriptorCipher,
      null,
    );
    assert.equal(
      (await request(`statuses/${statusId}/download`, 'POST', undefined, a)).status,
      410,
    );
    assert.equal(
      (await request('preferences', 'PATCH', { retentionDays: 0, notifications: true }, a)).status,
      400,
    );
    assert.equal(
      (await db.preference.findUniqueOrThrow({ where: { userId: b.userId } })).retentionDays,
      7,
    );
    assert.equal((await request('preferences', 'GET', undefined, b)).status, 401);
  });
  await check(
    'disconnect revokes secrets and generation-fences stale credential/event callbacks',
    async () => {
      const store = await authStore(a.userId, generation);
      assert.equal((await request('wa/disconnect', 'POST', undefined, a)).status, 200);
      await store.save();
      await store.state.keys.set({
        'pre-key': { '99': { public: Buffer.alloc(32), private: Buffer.alloc(32) } },
      });
      await provider.confirm();
      assert.equal(await db.secret.count({ where: { userId: a.userId } }), 0);
      const session = await db.waSession.findUniqueOrThrow({ where: { userId: a.userId } });
      assert.equal(session.state, 'DISCONNECTED');
      assert.equal(session.challengeCipher, null);
    },
  );
  await check('offline worker prevents connecting; disabled provider is explicit', async () => {
    await db.rateBucket.deleteMany();
    await db.workerHealth.update({ where: { id: 'primary' }, data: { heartbeat: new Date(0) } });
    assert.equal(
      (await request('wa/connect', 'POST', { consent: true, method: 'qr' }, a)).status,
      503,
    );
    process.env.ENABLE_WHATSAPP = 'false';
    const res = await request('wa/connect', 'POST', { consent: true, method: 'qr' }, a);
    assert.equal((await res.json()).error.code, 'PROVIDER_DISABLED');
    process.env.ENABLE_WHATSAPP = 'true';
  });
  await check('rate limits are persistent and atomic across concurrent requests', async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 12 }, () => rateLimit('isolated-test-limit', 5)),
    );
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 5);
    assert.equal(results.filter((r) => r.status === 'rejected').length, 7);
  });
  await check(
    'malformed media identifiers and user URL injection cannot cause arbitrary fetches',
    async () => {
      assert.equal((await request('media/not-a-uuid/file', 'GET', undefined, a)).status, 404);
      assert.equal(
        (
          await request(
            'wa/connect',
            'POST',
            { consent: true, method: 'qr', url: 'http://169.254.169.254' },
            a,
          )
        ).status,
        400,
      );
      const record = seal('sensitive', `${a.userId}:scope`);
      assert.ok(!record.includes('sensitive'));
    },
  );
  await check(
    'admin password is server-managed; rotation invalidates old sessions and logout revokes cookie',
    async () => {
      assert.equal(
        (
          await request(
            'auth/password',
            'POST',
            { current: process.env.ADMIN_PASSWORD, password: 'changed-from-browser' },
            a,
          )
        ).status,
        409,
      );
      const previous = process.env.ADMIN_PASSWORD!;
      const abort = new AbortController();
      const stream = await request('events', 'GET', undefined, a, {}, abort.signal);
      const reader = stream.body!.getReader();
      await reader.read();
      process.env.ADMIN_PASSWORD = 'Rotated-admin-test-password-2026!';
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const closed = await Promise.race([
          reader.read(),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error('SSE did not revoke authentication')), 6000);
          }),
        ]);
        assert.equal(closed.done, true);
      } finally {
        clearTimeout(timer);
        abort.abort();
      }

      assert.equal((await request('auth/me', 'GET', undefined, a)).status, 401);
      assert.equal((await request('auth/me', 'GET', undefined, secondAdminLogin)).status, 401);
      assert.equal((await request('auth/login', 'POST', { password: previous })).status, 401);
      const rotated = await adminLogin();
      assert.equal(rotated.userId, a.userId);
      assert.equal((await request('auth/me', 'GET', undefined, rotated)).status, 200);
      assert.equal((await request('auth/logout', 'POST', undefined, rotated)).status, 200);
      assert.equal((await request('auth/me', 'GET', undefined, rotated)).status, 401);
      process.env.ADMIN_PASSWORD = previous;
      Object.assign(a, await adminLogin());
    },
  );
  await check(
    'public error responses do not expose stack traces or internal credentials',
    async () => {
      const res = await request(`media/${randomUUID()}`, 'GET', undefined, a);
      const text = await res.text();
      assert.equal(res.status, 404);
      assert.ok(!text.includes('stack'));
      assert.ok(!text.includes(process.env.DATABASE_URL!));
      assert.ok(!text.includes(process.env.ENCRYPTION_KEY!));
    },
  );
  await check(
    'SQLite serializes read-modify-write transactions across separate processes',
    async () => {
      const { writeTransaction } = await import('../lib/db/write');
      await db.rateBucket.create({
        data: {
          key: 'sqlite-concurrent-counter',
          count: 0,
          expiresAt: new Date(Date.now() + 3600000),
        },
      });
      const child = () =>
        promisify(execFile)(
          process.execPath,
          ['--import', 'tsx', 'tests/sqlite-writer-process.ts'],
          { env: process.env },
        );
      await Promise.all([
        child(),
        child(),
        (async () => {
          for (let i = 0; i < 20; i++)
            await writeTransaction(async (tx) => {
              const row = await tx.rateBucket.findUniqueOrThrow({
                where: { key: 'sqlite-concurrent-counter' },
              });
              await tx.rateBucket.update({
                where: { key: row.key },
                data: { count: row.count + 1 },
              });
            });
        })(),
      ]);
      assert.equal(
        (await db.rateBucket.findUniqueOrThrow({ where: { key: 'sqlite-concurrent-counter' } }))
          .count,
        60,
      );
    },
  );
  await check('admin login enforces its persistent ten-attempt limit', async () => {
    await db.rateBucket.deleteMany();
    for (let i = 0; i < 10; i++)
      assert.equal(
        (await request('auth/login', 'POST', { password: 'invalid-admin-password' })).status,
        401,
      );
    const limited = await request('auth/login', 'POST', { password: process.env.ADMIN_PASSWORD });
    assert.equal(limited.status, 429);
    assert.ok(limited.headers.get('retry-after'));
  });
  await mkdir('docs', { recursive: true });
  await writeFile(
    'docs/integration-result.json',
    JSON.stringify(
      {
        passed: cases,
        database: 'SQLite (isolated disposable file)',
        provider: 'mock, no live account',
        authRestart: 'two child processes; encrypted state/Signal keys round-trip verified',
        at: new Date().toISOString(),
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`\n${cases} integration scenarios passed. No real WhatsApp account used.`);
} finally {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await db.user.deleteMany();
  await db.workerHealth.deleteMany();
  await db.rateBucket.deleteMany();
  await db.$disconnect();
  await rm(process.env.MEDIA_ROOT!, { recursive: true, force: true });
}
