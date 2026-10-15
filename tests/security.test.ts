import { describe, it, expect, beforeAll } from 'vitest';
import { z } from 'zod';
import { seal, open, csrfFor, safeEqual } from '../lib/security/crypto';
import { body, checkOrigin, pagination, uuid } from '../lib/security/http';
import { passwordHash, verifyPassword, cookie } from '../lib/auth/auth';
import { assertMediaUrl, detectMedia, publicIp, parseRange } from '../lib/security/media';
import { filePath } from '../lib/storage/files';
beforeAll(() => {
  process.env.ENCRYPTION_KEY = 'a'.repeat(64);
  process.env.APP_ORIGIN = 'https://hub.example.test';
});
describe('encryption and authentication primitives', () => {
  it('authenticates AES-GCM ciphertext and binds owner/scope', () => {
    const ciphertext = seal('private-session-value', 'userA:creds');
    expect(ciphertext).not.toContain('private-session-value');
    expect(open(ciphertext, 'userA:creds')).toBe('private-session-value');
    expect(() => open(ciphertext, 'userB:creds')).toThrow();
    expect(() => open(ciphertext.slice(0, -2) + 'zz', 'userA:creds')).toThrow();
  });
  it('uses a fresh nonce for each write', () =>
    expect(seal('same', 'scope')).not.toBe(seal('same', 'scope')));
  it('rejects missing encryption keys', () => {
    const key = process.env.ENCRYPTION_KEY;
    delete process.env.ENCRYPTION_KEY;
    expect(() => seal('x', 'x')).toThrow();
    process.env.ENCRYPTION_KEY = key;
  });
  it('uses salted scrypt and validates passwords', async () => {
    const a = await passwordHash('a-secure-test-password');
    const b = await passwordHash('a-secure-test-password');
    expect(a).not.toBe(b);
    expect(await verifyPassword('a-secure-test-password', a)).toBe(true);
    expect(await verifyPassword('wrong-password', a)).toBe(false);
  });
  it('binds CSRF to the login token', () => {
    expect(csrfFor('token-a')).not.toBe(csrfFor('token-b'));
    expect(safeEqual('', 'x')).toBe(false);
    expect(safeEqual('same', 'same')).toBe(true);
  });
  it('sets secure HttpOnly SameSite cookies by default', () => {
    delete process.env.COOKIE_SECURE;
    expect(cookie('x')).toContain('HttpOnly');
    expect(cookie('x')).toContain('SameSite=Lax');
    expect(cookie('x')).toContain('Secure');
    expect(cookie('', true)).toContain('Max-Age=0');
  });
});
describe('HTTP boundaries', () => {
  it('accepts only configured exact origins', () => {
    expect(() =>
      checkOrigin(
        new Request('https://hub.example.test', {
          headers: { Origin: 'https://hub.example.test' },
        }),
      ),
    ).not.toThrow();
    for (const origin of ['', 'https://hub.example.test.evil', 'null', 'http://hub.example.test'])
      expect(() =>
        checkOrigin(new Request('https://hub.example.test', { headers: { Origin: origin } })),
      ).toThrow();
  });
  it('requires JSON and a strict schema', async () => {
    const schema = z.object({ yes: z.literal(true) }).strict();
    expect(
      await body(
        new Request('https://test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{"yes":true}',
        }),
        schema,
      ),
    ).toEqual({ yes: true });
    await expect(
      body(new Request('https://test', { method: 'POST', body: '{"yes":true}' }), schema),
    ).rejects.toThrow();
    await expect(
      body(
        new Request('https://test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{"yes":true,"url":"http://localhost"}',
        }),
        schema,
      ),
    ).rejects.toThrow();
  });
  it('caps body size without trusting Content-Length', async () => {
    await expect(
      body(
        new Request('https://test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ x: 'a'.repeat(17000) }),
        }),
        z.unknown(),
      ),
    ).rejects.toThrow();
  });
  it.each(['-1', '0', '1.5', '10001', 'NaN'])('rejects invalid page %s', (page) =>
    expect(() => pagination(new URL('https://test?page=' + page))).toThrow(),
  );
  it('validates object IDs', () => {
    expect(() => uuid('../../passwd')).toThrow();
    expect(() => uuid('00000000-0000-4000-8000-000000000000')).not.toThrow();
  });
});
describe('media SSRF, format, and path defense', () => {
  it.each([
    'http://mmg.whatsapp.net/a',
    'https://mmg.whatsapp.net.evil/a',
    'https://localhost/a',
    'https://127.0.0.1/a',
    'https://[::1]/a',
    'https://169.254.169.254/a',
    'https://u:p@mmg.whatsapp.net/a',
    'https://mmg.whatsapp.net:8443/a',
    'file:///etc/passwd',
    'https://evil.test@mmg.whatsapp.net/a',
  ])('rejects unsafe URL %s', (url) => expect(() => assertMediaUrl(url)).toThrow());
  it('allows an HTTPS WhatsApp media host', () =>
    expect(assertMediaUrl('https://mmg.whatsapp.net/v/a.enc').hostname).toBe('mmg.whatsapp.net'));
  it.each([
    '127.0.0.1',
    '10.0.0.1',
    '172.16.0.1',
    '192.168.1.1',
    '169.254.169.254',
    '::1',
    '::ffff:127.0.0.1',
    'fc00::1',
    'fe80::1',
    '0.0.0.0',
    'not-an-ip',
  ])('blocks nonpublic DNS result %s', (ip) => expect(publicIp(ip)).toBe(false));
  it('accepts public addresses', () => {
    expect(publicIp('1.1.1.1')).toBe(true);
    expect(publicIp('2606:4700:4700::1111')).toBe(true);
  });
  it.each([
    '../../etc/passwd',
    '/etc/passwd',
    'a/../../b.jpg',
    '00000000-0000-4000-8000-000000000000/..%2fsecret.jpg',
  ])('rejects storage key %s', (key) => expect(() => filePath(key)).toThrow());
  it('detects real media bytes instead of trusting MIME', () => {
    expect(detectMedia(Buffer.from([255, 216, 255, 0]), 'PHOTO').mime).toBe('image/jpeg');
    expect(detectMedia(Buffer.from('0000ftypisom'), 'VIDEO').mime).toBe('video/mp4');
    expect(() => detectMedia(Buffer.from('<svg onload=alert(1)>'), 'PHOTO')).toThrow();
    expect(() => detectMedia(Buffer.from('0000ftypisom'), 'PHOTO')).toThrow();
  });
  it('supports normal, open-ended and suffix video ranges', () => {
    expect(parseRange('bytes=0-9', 100)).toEqual({ start: 0, end: 9 });
    expect(parseRange('bytes=90-', 100)).toEqual({ start: 90, end: 99 });
    expect(parseRange('bytes=-10', 100)).toEqual({ start: 90, end: 99 });
    expect(parseRange(undefined, 100)).toBeNull();
  });
  it.each(['bytes=101-', 'bytes=10-5', 'bytes=0-2,10-20', 'bytes=-', 'bytes=-0'])(
    'rejects invalid range %s',
    (range) => expect(() => parseRange(range, 100)).toThrow(),
  );
});
