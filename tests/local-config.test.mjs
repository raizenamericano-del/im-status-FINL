import { describe, it, expect } from 'vitest';
import { mkdtemp, readFile, rm, writeFile, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { prepareConfig, appOrigins, isMounted } from '../scripts/config.mjs';
describe('self-contained local configuration', () => {
  it('derives Railway origin without trusting request headers', () => {
    expect(appOrigins({ RAILWAY_PUBLIC_DOMAIN: 'sample.up.railway.app' }, '3000')).toBe(
      'https://sample.up.railway.app',
    );
    expect(appOrigins({}, '3300')).toBe('http://localhost:3300');
    expect(appOrigins({ RAILWAY_PROJECT_ID: 'test' }, '3000')).toBe('');
  });
  it('rejects origins with paths, credentials or trailing slash', () => {
    for (const origin of [
      'https://host.test/login',
      'https://host.test/',
      'https://user:pass@host.test',
      'javascript:bad',
    ])
      expect(() => appOrigins({ APP_ORIGIN: origin }, '3000')).toThrow();
  });
  it('requires an actual mounted directory rather than the container root', () => {
    const mounts = '1 0 0:1 / / rw - overlay overlay rw\n2 1 0:2 / /data rw - ext4 /dev/test rw';
    expect(isMounted('/data/im-status-local', mounts)).toBe(true);
    expect(isMounted('/database', mounts)).toBe(false);
    expect(isMounted('/runtime/data', mounts)).toBe(false);
  });
  it('generates private stable keys, ignores PostgreSQL env and refuses silent key replacement', async () => {
    await mkdir('runtime', { recursive: true });
    const root = await mkdtemp(resolve('runtime/config_test_'));
    try {
      const env = {
        DATA_DIR: root,
        DATABASE_URL: 'postgresql://unused:unused@unreachable/test',
        SERVICE_ROLE: 'worker',
        WORKER_URL: 'https://unused.invalid',
      };
      const first = await prepareConfig(env),
        second = await prepareConfig(env);
      expect(first.DATABASE_URL.startsWith('file:')).toBe(true);
      expect(first.WORKER_URL).toBe('http://127.0.0.1:3210');
      expect(first.ENCRYPTION_KEY).toBe(second.ENCRYPTION_KEY);
      expect(first.WORKER_SECRET).toBe(second.WORKER_SECRET);
      expect((await stat(join(root, 'server-secrets.json'))).mode & 0o777).toBe(0o600);
      expect(
        JSON.parse(await readFile(join(root, 'server-secrets.json'), 'utf8')).encryptionKey,
      ).toBe(first.ENCRYPTION_KEY);
      await expect(prepareConfig({ ...env, ENCRYPTION_KEY: 'c'.repeat(64) })).rejects.toThrow(
        'KEY_CONFIG_MISMATCH',
      );
      await writeFile(join(root, 'hub.sqlite'), 'test existing file');
      await rm(join(root, 'server-secrets.json'));
      await expect(prepareConfig(env)).rejects.toThrow('KEY_FILE_MISSING');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
