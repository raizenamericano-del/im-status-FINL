import { createReadStream, createWriteStream } from 'node:fs';
import { access, mkdir, rename, rm, stat, lstat, readdir } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { Transform, type Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { AppError } from '../security/errors';
import { detectMedia, MAX_MEDIA_BYTES } from '../security/media';
export const root = () => resolve(process.env.MEDIA_ROOT ?? './runtime/media');
export function filePath(key: string) {
  if (!/^[a-f0-9-]{36}\/[a-f0-9-]{36}\.(jpg|png|webp|mp4)$/.test(key))
    throw new AppError('NOT_FOUND', 404);
  return resolve(root(), key);
}
export async function storageReady() {
  await mkdir(root(), { recursive: true, mode: 0o700 });
  await access(root(), constants.R_OK | constants.W_OK);
  const test = resolve(root(), '.probe-' + randomUUID());
  const { writeFile } = await import('node:fs/promises');
  await writeFile(test, 'ok', { mode: 0o600, flag: 'wx' });
  await rm(test);
  return true;
}
export async function saveStream(
  userId: string,
  mediaId: string,
  kind: string,
  stream: Readable,
  signal: AbortSignal,
  expectedHash?: Uint8Array | null,
) {
  if (!/^[a-f0-9-]{36}$/.test(userId) || !/^[a-f0-9-]{36}$/.test(mediaId))
    throw new AppError('INVALID_INPUT');
  const temp = resolve(root(), `.tmp-${randomUUID()}`);
  let bytes = 0,
    prefix = Buffer.alloc(0);
  const hash = createHash('sha256');
  const limit = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      bytes += chunk.length;
      if (bytes > MAX_MEDIA_BYTES) {
        callback(new AppError('MEDIA_TOO_LARGE', 413));
        return;
      }
      if (prefix.length < 32)
        prefix = Buffer.concat([prefix, chunk.subarray(0, 32 - prefix.length)]);
      hash.update(chunk);
      callback(null, chunk);
    },
  });
  try {
    await mkdir(root(), { recursive: true, mode: 0o700 });
    await pipeline(stream, limit, createWriteStream(temp, { flags: 'wx', mode: 0o600 }), {
      signal,
    });
    const detected = detectMedia(prefix, kind),
      sha256 = hash.digest('hex');
    if (expectedHash?.length && Buffer.from(expectedHash).toString('hex') !== sha256)
      throw new AppError('MEDIA_UNAVAILABLE', 410);
    let duration: number | null = null;
    if (kind === 'VIDEO') {
      try {
        const result = await promisify(execFile)(
          'ffprobe',
          ['-v', 'error', '-show_entries', 'format=duration', '-of', 'json', temp],
          { timeout: 10000, maxBuffer: 65536, signal },
        );
        duration = Math.round(Number(JSON.parse(result.stdout).format.duration));
        if (!Number.isFinite(duration) || duration < 0) throw new Error('Invalid video');
      } catch {
        throw new AppError('UNSUPPORTED_MEDIA', 415);
      }
    }
    const storageKey = `${userId}/${mediaId}.${detected.ext}`;
    await mkdir(dirname(filePath(storageKey)), { recursive: true, mode: 0o700 });
    await rename(temp, filePath(storageKey));
    return {
      bytes,
      sha256,
      storageKey,
      mime: detected.mime,
      duration,
      filename: `status-${new Date().toISOString().slice(0, 10)}-${mediaId.slice(0, 8)}.${detected.ext}`,
    };
  } catch (e) {
    if (signal.aborted) throw new AppError('DOWNLOAD_TIMEOUT', 504);
    if (e instanceof AppError) throw e;
    const code = (e as NodeJS.ErrnoException).code;
    if (
      [
        'ENOSPC',
        'EACCES',
        'EROFS',
        'EDQUOT',
        'ENOENT',
        'EEXIST',
        'ENOTDIR',
        'EIO',
        'EMFILE',
      ].includes(code ?? '')
    )
      throw new AppError('STORAGE_ERROR', 503);
    throw new AppError('MEDIA_UNAVAILABLE', 502);
  } finally {
    stream.destroy();
    await rm(temp, { force: true }).catch(() => {});
  }
}
export async function removeFile(key: string) {
  await rm(filePath(key), { force: true });
}
export async function openFile(key: string, range?: { start: number; end: number } | null) {
  const path = filePath(key),
    info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink()) throw new AppError('NOT_FOUND', 404);
  return { stream: createReadStream(path, range ?? {}), bytes: info.size };
}
export async function cleanupOrphans(known: Set<string>) {
  for (const item of await readdir(root(), { withFileTypes: true })) {
    if (item.isFile() && (item.name.startsWith('.tmp-') || item.name.startsWith('.probe-'))) {
      const path = resolve(root(), item.name);
      if (Date.now() - (await stat(path)).mtimeMs > 3600000) await rm(path, { force: true });
    }
    if (item.isDirectory() && /^[a-f0-9-]{36}$/.test(item.name))
      for (const file of await readdir(resolve(root(), item.name))) {
        const key = `${item.name}/${file}`;
        if (
          /^[a-f0-9-]{36}\.(jpg|png|webp|mp4)$/.test(file) &&
          !known.has(key) &&
          Date.now() - (await stat(filePath(key))).mtimeMs > 3600000
        )
          await removeFile(key);
      }
  }
}
