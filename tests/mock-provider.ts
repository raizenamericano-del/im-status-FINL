// TEST ONLY: never imported by app/ or worker/main.ts.
import { Readable } from 'node:stream';
import { AppError } from '../lib/security/errors';
import type {
  MediaDescriptor,
  Provider,
  ProviderHooks,
  ReceivedStatus,
} from '../worker/providers/types';
export const fixturePng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6Vc8AAAAASUVORK5CYII=',
  'base64',
);
export class MockProvider implements Provider {
  mode: 'ok' | 'fail' | 'timeout' = 'ok';
  closed = false;
  loggedOut = false;
  payload = fixturePng;
  constructor(public hooks?: ProviderHooks) {}
  async connect(method: 'qr' | 'code') {
    await this.hooks?.challenge(
      method,
      method === 'qr' ? 'TEST-ONLY-QR-NOT-A-WHATSAPP-SESSION' : 'TEST1234',
    );
  }
  async confirm() {
    await this.hooks?.state('CONNECTED');
  }
  async emit(status: ReceivedStatus) {
    await this.hooks?.status(status);
  }
  async fail() {
    await this.hooks?.state('ERROR', 'SESSION_EXPIRED');
  }
  async download(_descriptor: MediaDescriptor, _kind: string, signal: AbortSignal) {
    if (this.mode === 'fail') throw new AppError('MEDIA_UNAVAILABLE', 410);
    if (this.mode === 'timeout' || signal.aborted) throw new AppError('DOWNLOAD_TIMEOUT', 504);
    return Readable.from(this.payload);
  }
  async close(logout: boolean) {
    this.closed = true;
    this.loggedOut = logout;
  }
}
