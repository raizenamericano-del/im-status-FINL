import { Prisma } from '@prisma/client';
import { AppError } from './errors';

/** Classify backend failures without returning query text, metadata, stack traces or secrets. */
export function publicServerError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (['P2021', 'P2022'].includes(error.code)) return new AppError('DATABASE_NOT_READY', 503);
    if (
      ['P1000', 'P1001', 'P1002', 'P1008', 'P1010', 'P1011', 'P1013', 'P1017', 'P2024'].includes(
        error.code,
      )
    ) {
      return new AppError('DATABASE_UNAVAILABLE', 503);
    }
    // Handle simultaneous registrations with the same email without exposing DB metadata.
    if (
      error.code === 'P2002' &&
      Array.isArray(error.meta?.target) &&
      error.meta.target.includes('email')
    ) {
      return new AppError('EMAIL_EXISTS', 409);
    }
  }
  if (error instanceof Prisma.PrismaClientInitializationError)
    return new AppError('DATABASE_UNAVAILABLE', 503);
  if (error instanceof Error && error.message === 'ENCRYPTION_KEY must be 32 random bytes in hex') {
    return new AppError('SERVER_CONFIG_INCOMPLETE', 503);
  }
  return new AppError('INTERNAL_ERROR', 503);
}
