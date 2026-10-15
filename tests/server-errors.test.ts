import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { AppError, errorMessage } from '../lib/security/errors';
import { publicServerError } from '../lib/security/server-errors';
const known = (code: string) =>
  new Prisma.PrismaClientKnownRequestError('private query and connection secret', {
    code,
    clientVersion: 'test',
    meta: { database: 'private' },
  });
describe('safe backend error diagnostics', () => {
  it.each(['P2021', 'P2022'])('identifies missing schema for %s', (code) => {
    expect(publicServerError(known(code))).toMatchObject({
      code: 'DATABASE_NOT_READY',
      status: 503,
    });
  });
  it.each(['P1000', 'P1001', 'P1002', 'P1008', 'P1010', 'P1011', 'P1013', 'P1017', 'P2024'])(
    'identifies DB connectivity failure %s',
    (code) => {
      expect(publicServerError(known(code))).toMatchObject({
        code: 'DATABASE_UNAVAILABLE',
        status: 503,
      });
    },
  );
  it('handles initialization failure without exposing connection strings', () => {
    const error = new Prisma.PrismaClientInitializationError(
      'postgresql://private:secret@db',
      'test',
      'P1001',
    );
    const result = publicServerError(error);
    expect(result.code).toBe('DATABASE_UNAVAILABLE');
    expect(errorMessage(result.code)).not.toContain('secret');
  });
  it('preserves authentication and CSRF errors', () => {
    const error = new AppError('FORBIDDEN', 403);
    expect(publicServerError(error)).toBe(error);
  });
  it('explains missing encryption setup without disclosing any key', () => {
    expect(publicServerError(new Error('ENCRYPTION_KEY must be 32 random bytes in hex')).code).toBe(
      'SERVER_CONFIG_INCOMPLETE',
    );
  });
  it('recognizes only an email uniqueness conflict as duplicate registration', () => {
    const email = new Prisma.PrismaClientKnownRequestError('private SQL', {
      code: 'P2002',
      clientVersion: 'test',
      meta: { target: ['email'] },
    });
    expect(publicServerError(email)).toMatchObject({ code: 'EMAIL_EXISTS', status: 409 });
    expect(publicServerError(known('P2002')).code).toBe('INTERNAL_ERROR');
  });
  it('does not echo unexpected backend exceptions', () => {
    const result = publicServerError(new Error('private credentials and stack'));
    expect(result.code).toBe('INTERNAL_ERROR');
    expect(errorMessage(result.code)).not.toContain('private');
  });
});
