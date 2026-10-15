import { createServer } from 'node:http';
import { db } from '../lib/db/client';
import { safeEqual } from '../lib/security/crypto';
import { AppError } from '../lib/security/errors';
import { parseRange } from '../lib/security/media';
import { openFile } from '../lib/storage/files';
export function createWorkerServer(secret: string, isReady: () => boolean) {
  const server = createServer((req, res) => {
    void (async () => {
      if (req.url === '/health' && req.method === 'GET') {
        await db.$queryRaw`SELECT 1`;
        res.writeHead(isReady() ? 200 : 503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: isReady() ? 'ok' : 'unavailable' }));
        return;
      }
      if (!safeEqual(req.headers.authorization ?? '', `Bearer ${secret}`)) {
        res.writeHead(401);
        res.end();
        return;
      }
      const id = req.url?.match(/^\/media\/([a-f0-9-]{36})$/)?.[1],
        userId = req.headers['x-user-id'];
      if (
        req.method !== 'GET' ||
        !id ||
        typeof userId !== 'string' ||
        !/^[a-f0-9-]{36}$/.test(userId)
      ) {
        res.writeHead(404);
        res.end();
        return;
      }
      const media = await db.media.findFirst({ where: { id, userId, deleteRequestedAt: null } });
      if (!media) {
        res.writeHead(404);
        res.end();
        return;
      }
      let range;
      try {
        range = parseRange(req.headers.range, media.bytes);
      } catch {
        res.writeHead(416, { 'Content-Range': `bytes */${media.bytes}` });
        res.end();
        return;
      }
      const file = await openFile(media.storageKey, range);
      res.writeHead(range ? 206 : 200, {
        'Content-Type': media.mime,
        'Accept-Ranges': 'bytes',
        'Content-Length': range ? range.end - range.start + 1 : file.bytes,
        ...(range ? { 'Content-Range': `bytes ${range.start}-${range.end}/${file.bytes}` } : {}),
      });
      file.stream.on('error', () => res.destroy());
      res.on('close', () => file.stream.destroy());
      file.stream.pipe(res);
    })().catch((error) => {
      if (!res.headersSent)
        res.writeHead(
          error instanceof AppError
            ? error.status
            : (error as NodeJS.ErrnoException).code === 'ENOENT'
              ? 404
              : 503,
        );
      res.end();
    });
  });
  server.requestTimeout = 10000;
  server.headersTimeout = 10000;
  return server;
}
