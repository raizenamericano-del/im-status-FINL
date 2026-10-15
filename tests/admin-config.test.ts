import { describe, expect, it, beforeEach } from 'vitest';
import { adminPasswordVersion, verifyAdminPassword } from '../lib/auth/admin-config';
beforeEach(() => {
  process.env.ENCRYPTION_KEY = 'c'.repeat(64);
  process.env.ADMIN_PASSWORD = 'Admin-only-test-password';
});
describe('password-only admin configuration', () => {
  it('accepts only the configured password', () => {
    expect(verifyAdminPassword('Admin-only-test-password')).toBe(true);
    expect(verifyAdminPassword('wrong-password')).toBe(false);
  });
  it.each(['', 'short', ' '.repeat(20), 'x'.repeat(129)])(
    'fails closed for invalid configured password %#',
    (value) => {
      process.env.ADMIN_PASSWORD = value;
      expect(() => adminPasswordVersion()).toThrow('ADMIN_SETUP_REQUIRED');
    },
  );
  it('has no default password when configuration is missing', () => {
    delete process.env.ADMIN_PASSWORD;
    expect(() => verifyAdminPassword('admin')).toThrow('ADMIN_SETUP_REQUIRED');
  });
  it('binds session version to both admin password and server encryption key', () => {
    const original = adminPasswordVersion();
    process.env.ADMIN_PASSWORD = 'Changed-test-admin-password';
    expect(adminPasswordVersion()).not.toBe(original);
    process.env.ADMIN_PASSWORD = 'Admin-only-test-password';
    process.env.ENCRYPTION_KEY = 'd'.repeat(64);
    expect(adminPasswordVersion()).not.toBe(original);
  });
  it('returns a fixed-size keyed digest, never the password', () => {
    expect(adminPasswordVersion()).toMatch(/^[a-f0-9]{64}$/);
    expect(adminPasswordVersion()).not.toContain(process.env.ADMIN_PASSWORD);
  });
});
