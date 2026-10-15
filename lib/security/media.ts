import { lookup } from 'node:dns';
import ipaddr from 'ipaddr.js';
import { Agent } from 'undici';
import { AppError } from './errors';
export const MAX_MEDIA_BYTES = 64 * 1024 * 1024;
export const QUOTA_BYTES = 512 * 1024 * 1024;
export function assertMediaUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new AppError('SSRF_BLOCKED');
  }
  const host = url.hostname.toLowerCase();
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    (url.port && url.port !== '443') ||
    !(host === 'mmg.whatsapp.net' || host.endsWith('.whatsapp.net'))
  )
    throw new AppError('SSRF_BLOCKED');
  return url;
}
export function publicIp(address: string) {
  try {
    return ipaddr.process(address).range() === 'unicast';
  } catch {
    return false;
  }
}
// Validate every dispatch, including redirects, and pin DNS results at connect time.
export class MediaAgent extends Agent {
  constructor() {
    super({
      connect: {
        timeout: 10000,
        lookup: (hostname, options, callback) => {
          lookup(hostname, { ...options, all: true }, (error, addresses) => {
            if (error) return callback(error, '', 4);
            if (!addresses.length || addresses.some((a) => !publicIp(a.address)))
              return callback(new AppError('SSRF_BLOCKED'), '', 4);
            if (options.all) callback(null, addresses);
            else callback(null, addresses[0].address, addresses[0].family);
          });
        },
      },
      headersTimeout: 15000,
      bodyTimeout: 15000,
    });
  }
  override dispatch(
    options: Parameters<Agent['dispatch']>[0],
    handler: Parameters<Agent['dispatch']>[1],
  ): ReturnType<Agent['dispatch']> {
    try {
      assertMediaUrl(String(options.origin));
    } catch (e) {
      handler.onError?.(e as Error);
      return false;
    }
    return super.dispatch(options, handler);
  }
}
export function detectMedia(prefix: Buffer, kind: string) {
  if (kind === 'PHOTO' && prefix.subarray(0, 3).equals(Buffer.from([255, 216, 255])))
    return { mime: 'image/jpeg', ext: 'jpg' };
  if (
    kind === 'PHOTO' &&
    prefix.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return { mime: 'image/png', ext: 'png' };
  if (
    kind === 'PHOTO' &&
    prefix.toString('ascii', 0, 4) === 'RIFF' &&
    prefix.toString('ascii', 8, 12) === 'WEBP'
  )
    return { mime: 'image/webp', ext: 'webp' };
  if (kind === 'VIDEO' && prefix.toString('ascii', 4, 8) === 'ftyp')
    return { mime: 'video/mp4', ext: 'mp4' };
  throw new AppError('UNSUPPORTED_MEDIA', 415);
}
export function parseRange(
  value: string | undefined,
  bytes: number,
): { start: number; end: number } | null {
  if (!value) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!match || (!match[1] && !match[2])) throw new AppError('INVALID_INPUT', 416);
  let start: number, end: number;
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (suffix < 1) throw new AppError('INVALID_INPUT', 416);
    start = Math.max(0, bytes - suffix);
    end = bytes - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Math.min(Number(match[2]), bytes - 1) : bytes - 1;
  }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= bytes || start > end)
    throw new AppError('INVALID_INPUT', 416);
  return { start, end };
}
