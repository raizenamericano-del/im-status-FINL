import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID, createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import { saveStream, filePath, removeFile, storageReady } from '../lib/storage/files';
import { MAX_MEDIA_BYTES } from '../lib/security/media';
const testRoot = resolve('runtime/unit-storage-' + randomUUID());
const userId = randomUUID();
beforeAll(async () => {
  process.env.MEDIA_ROOT = testRoot;
  await mkdir(testRoot, { recursive: true });
});
afterAll(async () => {
  await rm(testRoot, { recursive: true, force: true });
});
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6Vc8AAAAASUVORK5CYII=',
  'base64',
);
describe('durable file storage', () => {
  it('writes original bytes atomically, verifies hash and records actual size', async () => {
    expect(await storageReady()).toBe(true);
    const file = await saveStream(
      userId,
      randomUUID(),
      'PHOTO',
      Readable.from(png),
      AbortSignal.timeout(3000),
      createHash('sha256').update(png).digest(),
    );
    expect(file.bytes).toBe(png.length);
    expect(file.mime).toBe('image/png');
    expect(await readFile(filePath(file.storageKey))).toEqual(png);
    await removeFile(file.storageKey);
  });
  it('fails integrity mismatch and cleans temporary files', async () => {
    await expect(
      saveStream(
        userId,
        randomUUID(),
        'PHOTO',
        Readable.from(png),
        AbortSignal.timeout(3000),
        Buffer.alloc(32),
      ),
    ).rejects.toThrow('MEDIA_UNAVAILABLE');
    expect((await readdir(testRoot)).filter((v) => v.startsWith('.tmp'))).toHaveLength(0);
  });
  it('bounds streamed media size', async () => {
    async function* chunks() {
      for (let n = 0; n <= MAX_MEDIA_BYTES / 1048576; n++) yield Buffer.alloc(1048576);
    }
    await expect(
      saveStream(
        userId,
        randomUUID(),
        'PHOTO',
        Readable.from(chunks()),
        AbortSignal.timeout(10000),
      ),
    ).rejects.toThrow('MEDIA_TOO_LARGE');
  });
  it('aborts a stalled stream and cleans its partial file', async () => {
    const stream = new Readable({ read() {} });
    await expect(
      saveStream(userId, randomUUID(), 'PHOTO', stream, AbortSignal.timeout(80)),
    ).rejects.toThrow('DOWNLOAD_TIMEOUT');
    expect((await readdir(testRoot)).filter((v) => v.startsWith('.tmp'))).toHaveLength(0);
  });
  it('reports unsupported file content', async () => {
    await expect(
      saveStream(
        userId,
        randomUUID(),
        'PHOTO',
        Readable.from(Buffer.from('<html>fake image</html>')),
        AbortSignal.timeout(1000),
      ),
    ).rejects.toThrow('UNSUPPORTED_MEDIA');
  });
  it('measures the real video duration using ffprobe', async () => {
    const temp = resolve(testRoot, 'fixture.mp4');
    await promisify(execFile)('ffmpeg', [
      '-v',
      'error',
      '-f',
      'lavfi',
      '-i',
      'color=c=green:s=64x64:d=1',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-y',
      temp,
    ]);
    const data = await readFile(temp);
    const file = await saveStream(
      userId,
      randomUUID(),
      'VIDEO',
      Readable.from(data),
      AbortSignal.timeout(15000),
    );
    expect(file.duration).toBe(1);
    expect(file.bytes).toBe(data.length);
    await removeFile(file.storageKey);
  });
});

describe('filesystem failure recovery', () => {
  it('reports an unwritable storage volume without claiming download success', async () => {
    const { chmod } = await import('node:fs/promises');
    await chmod(testRoot, 0o500);
    try {
      await expect(
        saveStream(userId, randomUUID(), 'PHOTO', Readable.from(png), AbortSignal.timeout(2000)),
      ).rejects.toThrow('STORAGE_ERROR');
    } finally {
      await chmod(testRoot, 0o700);
    }
  });
  it('cleans old orphaned bytes and temporary files without deleting known media', async () => {
    const { utimes, writeFile } = await import('node:fs/promises');
    const { cleanupOrphans } = await import('../lib/storage/files');
    const known = await saveStream(
      userId,
      randomUUID(),
      'PHOTO',
      Readable.from(png),
      AbortSignal.timeout(2000),
    );
    const orphan = await saveStream(
      userId,
      randomUUID(),
      'PHOTO',
      Readable.from(png),
      AbortSignal.timeout(2000),
    );
    const temp = resolve(testRoot, '.tmp-crash-test');
    await writeFile(temp, 'partial');
    const old = new Date(Date.now() - 7200000);
    await utimes(filePath(orphan.storageKey), old, old);
    await utimes(temp, old, old);
    await cleanupOrphans(new Set([known.storageKey]));
    expect(await readFile(filePath(known.storageKey))).toEqual(png);
    await expect(readFile(filePath(orphan.storageKey))).rejects.toThrow();
    await expect(readFile(temp)).rejects.toThrow();
    await removeFile(known.storageKey);
  });
});
