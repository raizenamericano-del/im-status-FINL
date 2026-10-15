import { describe, it, expect } from 'vitest';
import { sanitizeLogArgs } from '../worker/privacy-logger';
describe('provider log redaction', () => {
  it('blocks libsignal session dumps and exception stacks', () => {
    expect(sanitizeLogArgs(['Closing session:', { privateKey: 'sensitive' }])).toBeNull();
    expect(sanitizeLogArgs([new Error('secret token')])).toBeNull();
  });
  it('drops QR, OTP, phone, raw protocol data and arbitrary strings', () => {
    for (const value of [
      'QR: secret',
      'Pairing code: 12345678',
      '62800000000',
      '{"event":"unknown","password":"secret"}',
    ])
      expect(sanitizeLogArgs([value])).toBeNull();
  });
  it('allowlists operational fields rather than serializing additional data', () => {
    expect(
      sanitizeLogArgs([
        '{"event":"worker_started","storageReady":true,"credentials":"do not log"}',
      ]),
    ).toEqual({ event: 'worker_started', provider: 'baileys', storageReady: true });
  });
});
