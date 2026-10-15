import { z } from 'zod';
import { AppError } from './errors';
export function checkOrigin(req: Request) {
  const origin = req.headers.get('origin');
  const allowed = process.env.APP_ORIGIN?.split(',').map((v) => v.trim()) ?? [];
  if (!origin || !allowed.includes(origin)) throw new AppError('FORBIDDEN', 403);
}
export async function body<T>(req: Request, schema: z.ZodType<T>): Promise<T> {
  if (!req.headers.get('content-type')?.startsWith('application/json'))
    throw new AppError('INVALID_INPUT', 415);
  const reader = req.body?.getReader();
  if (!reader) throw new AppError('INVALID_INPUT', 400);
  let bytes = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.length;
    if (bytes > 16_384) {
      await reader.cancel();
      throw new AppError('INVALID_INPUT', 413);
    }
    chunks.push(value);
  }
  try {
    return schema.parse(JSON.parse(Buffer.concat(chunks).toString('utf8')));
  } catch {
    throw new AppError('INVALID_INPUT', 400);
  }
}
export function uuid(value?: string) {
  if (!value || !z.uuid().safeParse(value).success) throw new AppError('NOT_FOUND', 404);
  return value;
}
export function pagination(url: URL) {
  const page = Number(url.searchParams.get('page') || 1);
  if (!Number.isInteger(page) || page < 1 || page > 10000) throw new AppError('INVALID_INPUT');
  return { page, take: 24, skip: (page - 1) * 24 };
}
