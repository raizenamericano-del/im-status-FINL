import { mkdir, readFile, writeFile, rename, chmod, access, open } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { randomBytes } from 'node:crypto';
export const dataDirectory = (env = process.env) => resolve(env.DATA_DIR || './runtime/data');
export function isMounted(path, mountinfo) {
  return mountinfo.split('\n').some((line) => {
    const mount = line.split(' ')[4]?.replace(/\\040/g, ' ');
    return mount && mount !== '/' && (path === mount || path.startsWith(mount + '/'));
  });
}
export function appOrigins(env, port) {
  const origins = (env.APP_ORIGIN || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  if (env.RAILWAY_PUBLIC_DOMAIN) {
    if (!/^[a-z0-9.-]+$/i.test(env.RAILWAY_PUBLIC_DOMAIN)) throw new Error('INVALID_PUBLIC_DOMAIN');
    origins.push(`https://${env.RAILWAY_PUBLIC_DOMAIN}`);
  }
  if (!origins.length && !env.RAILWAY_PROJECT_ID && !env.RAILWAY_ENVIRONMENT_ID)
    origins.push(`http://localhost:${port}`);
  for (const origin of origins) {
    let parsed;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error('INVALID_APP_ORIGIN');
    }
    if (
      !['https:', 'http:'].includes(parsed.protocol) ||
      parsed.origin !== origin ||
      parsed.username ||
      parsed.password
    )
      throw new Error('INVALID_APP_ORIGIN');
  }
  return [...new Set(origins)].join(',');
}
const exists = async (path) => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};
export async function prepareConfig(env = process.env) {
  const root = dataDirectory(env);
  if (
    (env.RAILWAY_PROJECT_ID || env.RAILWAY_ENVIRONMENT_ID) &&
    !isMounted(root, await readFile('/proc/self/mountinfo', 'utf8'))
  )
    throw new Error('DATA_VOLUME_REQUIRED');
  await mkdir(root, { recursive: true, mode: 0o700 });
  await chmod(root, 0o700);
  const filename = join(root, 'server-secrets.json');
  let secrets;
  if (await exists(filename)) {
    try {
      secrets = JSON.parse(await readFile(filename, 'utf8'));
    } catch {
      throw new Error('KEY_FILE_INVALID');
    }
  } else {
    if ((await exists(join(root, 'hub.sqlite'))) && !env.ENCRYPTION_KEY)
      throw new Error('KEY_FILE_MISSING');
    secrets = {
      version: 1,
      encryptionKey: env.ENCRYPTION_KEY || randomBytes(32).toString('hex'),
      workerSecret: env.WORKER_SECRET || randomBytes(32).toString('hex'),
    };
  }
  if (
    secrets.version !== 1 ||
    !/^[a-f0-9]{64}$/i.test(secrets.encryptionKey || '') ||
    typeof secrets.workerSecret !== 'string' ||
    secrets.workerSecret.length < 32
  )
    throw new Error('KEY_FILE_INVALID');
  if (
    (env.ENCRYPTION_KEY && env.ENCRYPTION_KEY !== secrets.encryptionKey) ||
    (env.WORKER_SECRET && env.WORKER_SECRET !== secrets.workerSecret)
  )
    throw new Error('KEY_CONFIG_MISMATCH');
  if (!(await exists(filename))) {
    const temp = filename + '.' + randomBytes(6).toString('hex') + '.tmp';
    await writeFile(temp, JSON.stringify(secrets), { mode: 0o600, flag: 'wx' });
    const keyHandle = await open(temp, 'r');
    try {
      await keyHandle.sync();
    } finally {
      await keyHandle.close();
    }
    await rename(temp, filename);
    const directoryHandle = await open(root, 'r');
    try {
      await directoryHandle.sync();
    } finally {
      await directoryHandle.close();
    }
  }
  await chmod(filename, 0o600);
  const port = String(env.PORT || '3000');
  if (!/^\d+$/.test(port) || +port < 1 || +port > 65535) throw new Error('INVALID_PORT');
  const workerPort = port === '3210' ? '3211' : '3210';
  return {
    ...env,
    DATA_DIR: root,
    // Intentionally ignore old PostgreSQL URLs and service-role/remote-worker settings.
    DATABASE_URL: `file:${join(root, 'hub.sqlite')}?connection_limit=1&socket_timeout=15`,
    ENCRYPTION_KEY: secrets.encryptionKey,
    WORKER_SECRET: secrets.workerSecret,
    MEDIA_ROOT: join(root, 'media'),
    WORKER_PORT: workerPort,
    WORKER_URL: `http://127.0.0.1:${workerPort}`,
    PORT: port,
    APP_ORIGIN: appOrigins(env, port),
    IMHUB_SUPERVISED: '1',
    COOKIE_SECURE:
      env.COOKIE_SECURE ??
      (env.RAILWAY_PROJECT_ID || env.RAILWAY_PUBLIC_DOMAIN || env.NODE_ENV === 'production'
        ? 'true'
        : 'false'),
    ENABLE_WHATSAPP: env.ENABLE_WHATSAPP ?? 'true',
  };
}
