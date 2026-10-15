import { keyedDigest, safeEqual } from '../security/crypto';
import { AppError } from '../security/errors';

function configuredPassword() {
  const password = process.env.ADMIN_PASSWORD;
  if (!password || password.length < 12 || password.length > 128 || !password.trim()) {
    throw new AppError('ADMIN_SETUP_REQUIRED', 503);
  }
  return password;
}
export const adminPasswordVersion = () => keyedDigest(`admin-password:v1:${configuredPassword()}`);
export function verifyAdminPassword(candidate: string) {
  const expected = adminPasswordVersion();
  return safeEqual(keyedDigest(`admin-password:v1:${candidate}`), expected);
}
