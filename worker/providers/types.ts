import type { Readable } from 'node:stream';
export interface MediaDescriptor {
  url?: string | null;
  directPath?: string | null;
  mediaKey?: Uint8Array | null;
  fileSha256?: Uint8Array | null;
}
export interface ReceivedStatus {
  fingerprint: string;
  contactName: string;
  kind: 'PHOTO' | 'VIDEO';
  mime: string;
  duration: number | null;
  postedAt: Date;
  expiresAt: Date;
  descriptor: MediaDescriptor;
  thumbnail: Uint8Array | null;
}
export interface ProviderHooks {
  state(
    state: 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR',
    error?: string,
  ): Promise<void>;
  challenge(type: 'qr' | 'code', value: string): Promise<void>;
  status(value: ReceivedStatus): Promise<void>;
}
export interface Provider {
  connect(method: 'qr' | 'code', phone?: string): Promise<void>;
  download(descriptor: MediaDescriptor, kind: string, signal: AbortSignal): Promise<Readable>;
  close(logout: boolean): Promise<void>;
}
