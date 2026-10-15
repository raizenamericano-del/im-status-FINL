import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
function key() {
  const value = process.env.ENCRYPTION_KEY ?? '';
  if (!/^[a-f0-9]{64}$/i.test(value))
    throw new Error('ENCRYPTION_KEY must be 32 random bytes in hex');
  return Buffer.from(value, 'hex');
}
export function seal(value: string, scope: string) {
  const iv = randomBytes(12),
    cipher = createCipheriv('aes-256-gcm', key(), iv);
  cipher.setAAD(Buffer.from(scope));
  const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [
    'v1',
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    data.toString('base64url'),
  ].join('.');
}
export function open(value: string, scope: string) {
  const [version, iv, tag, data] = value.split('.');
  if (version !== 'v1' || !iv || !tag || !data) throw new Error('Invalid encrypted record');
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
  decipher.setAAD(Buffer.from(scope));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(data, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}
export const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export const csrfFor = (token: string) =>
  createHmac('sha256', key()).update(`csrf:${token}`).digest('hex');
export function safeEqual(a: string, b: string) {
  const aa = Buffer.from(a),
    bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}

export const keyedDigest = (value: string) =>
  createHmac('sha256', key()).update(value).digest('hex');
