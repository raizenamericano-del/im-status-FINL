import makeWASocket, {
  Browsers,
  DisconnectReason,
  downloadContentFromMessage,
  type WAMessage,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import { authStore } from '../auth-store';
import { digest } from '../../lib/security/crypto';
import { assertMediaUrl, MediaAgent } from '../../lib/security/media';
import { AppError } from '../../lib/security/errors';
import type { MediaDescriptor, Provider, ProviderHooks, ReceivedStatus } from './types';
const silent = pino({ level: 'silent' });
export function normalizeStatus(m: WAMessage): ReceivedStatus | null {
  if (m.key.remoteJid !== 'status@broadcast' || !m.key.id || !m.message) return null;
  // Deliberately do not unwrap view-once, quoted, private-chat, text or history messages.
  const media = m.message.imageMessage ?? m.message.videoMessage;
  if (!media || media.viewOnce || !media.mediaKey || (!media.url && !media.directPath)) return null;
  const postedAt = new Date(Number(m.messageTimestamp) * 1000),
    now = Date.now();
  if (
    !Number.isFinite(postedAt.getTime()) ||
    postedAt.getTime() < now - 86400000 ||
    postedAt.getTime() > now + 300000
  )
    return null;
  const kind = m.message.imageMessage ? 'PHOTO' : 'VIDEO';
  if (
    media.mimetype &&
    !(kind === 'PHOTO' ? ['image/jpeg', 'image/png', 'image/webp'] : ['video/mp4']).includes(
      media.mimetype,
    )
  )
    return null;
  const thumb = media.jpegThumbnail;
  const thumbnail =
    thumb && thumb.length <= 100 * 1024 && thumb[0] === 255 && thumb[1] === 216 ? thumb : null;
  return {
    fingerprint: digest(`${m.key.id}:${m.key.participant ?? ''}`),
    contactName:
      m.pushName
        ?.split('')
        .filter((c) => c.charCodeAt(0) >= 32)
        .join('')
        .slice(0, 80) || 'Kontak WhatsApp',
    kind,
    mime: media.mimetype ?? (kind === 'PHOTO' ? 'image/jpeg' : 'video/mp4'),
    duration: m.message.videoMessage?.seconds ?? null,
    postedAt,
    expiresAt: new Date(postedAt.getTime() + 86400000),
    thumbnail,
    // Retain only the download descriptor, never captions, quoted messages or unrelated chat payloads.
    descriptor: {
      url: media.url,
      directPath: media.directPath,
      mediaKey: media.mediaKey,
      fileSha256: media.fileSha256,
    },
  };
}
export class BaileysProvider implements Provider {
  private socket?: ReturnType<typeof makeWASocket>;
  private stopped = false;
  private flush?: () => Promise<void>;
  private attempts = 0;
  private retry?: ReturnType<typeof setTimeout>;
  private pairingTimer?: ReturnType<typeof setTimeout>;
  constructor(
    private userId: string,
    private generation: number,
    private hooks: ProviderHooks,
  ) {}
  async connect(method: 'qr' | 'code', phone?: string): Promise<void> {
    if (this.stopped) return;
    const auth = await authStore(this.userId, this.generation);
    this.flush = auth.flush;
    if (this.stopped) return;
    let requestedCode = false;
    const sock = makeWASocket({
      auth: auth.state,
      logger: silent,
      browser: Browsers.macOS('Chrome'),
      markOnlineOnConnect: false,
      syncFullHistory: false,
      shouldSyncHistoryMessage: () => false,
      connectTimeoutMs: 20000,
      defaultQueryTimeoutMs: 20000,
      shouldIgnoreJid: (jid) =>
        jid !== 'status@broadcast' && !jid.endsWith('@s.whatsapp.net') && !jid.endsWith('@lid'),
    });
    this.socket = sock;
    if (!auth.state.creds.registered && !this.pairingTimer)
      this.pairingTimer = setTimeout(() => {
        void this.fail('PAIRING_TIMEOUT');
      }, 180000);
    sock.ev.on('creds.update', () => {
      if (!this.stopped) void auth.save().catch(() => this.fail('CONNECTION_FAILED'));
    });
    sock.ev.on('connection.update', (update) => {
      void (async () => {
        if (this.stopped || this.socket !== sock) return;
        if (update.qr && !sock.authState.creds.registered) {
          if (method === 'code' && phone && !requestedCode) {
            requestedCode = true;
            const code = await sock.requestPairingCode(phone);
            if (!this.stopped) await this.hooks.challenge('code', code);
          } else if (method === 'qr') await this.hooks.challenge('qr', update.qr);
        }
        if (update.connection === 'open') {
          if (this.pairingTimer) clearTimeout(this.pairingTimer);
          this.pairingTimer = undefined;
          this.attempts = 0;
          await this.hooks.state('CONNECTED');
        }
        if (update.connection === 'close') {
          const code = (
            update.lastDisconnect?.error as { output?: { statusCode?: number } } | undefined
          )?.output?.statusCode;
          if (
            [
              DisconnectReason.loggedOut,
              DisconnectReason.badSession,
              DisconnectReason.connectionReplaced,
              DisconnectReason.multideviceMismatch,
            ].includes(code ?? 0)
          ) {
            await this.fail('SESSION_EXPIRED');
            return;
          }
          await this.hooks.state('CONNECTING', 'CONNECTION_FAILED');
          if (++this.attempts > 5) {
            await this.fail('CONNECTION_FAILED');
            return;
          }
          this.retry = setTimeout(
            () => {
              void this.connect(method, phone).catch(() => this.fail('CONNECTION_FAILED'));
            },
            Math.min(30000, 1000 * 2 ** (this.attempts - 1)),
          );
        }
      })().catch(() => this.fail('CONNECTION_FAILED'));
    });
    sock.ev.on('messages.upsert', (event) => {
      if (this.stopped || this.socket !== sock) return;
      // Append/history batches are not treated as fresh visible statuses.
      if (event.type !== 'notify') return;
      void (async () => {
        for (const message of event.messages) {
          if (this.stopped) return;
          const status = normalizeStatus(message);
          if (status) await this.hooks.status(status);
        }
      })().catch(() => {
        console.error(JSON.stringify({ event: 'status_ingest_failed' }));
      });
    });
  }
  private async fail(error: string) {
    if (this.stopped) return;
    await this.close(false);
    await this.hooks.state('ERROR', error);
  }
  async download(descriptor: MediaDescriptor, kind: string, signal: AbortSignal) {
    if (this.stopped || !this.socket?.user) throw new AppError('SESSION_OFFLINE', 409);
    // Prefer a fixed media host over provider-supplied URL; reject alternate hosts/redirects.
    if (
      descriptor.directPath &&
      (!descriptor.directPath.startsWith('/') ||
        descriptor.directPath.startsWith('//') ||
        /[\\\r\n]/.test(descriptor.directPath))
    )
      throw new AppError('SSRF_BLOCKED');
    const url = descriptor.directPath
      ? `https://mmg.whatsapp.net${descriptor.directPath}`
      : descriptor.url;
    if (!url) throw new AppError('MEDIA_UNAVAILABLE', 410);
    assertMediaUrl(url);
    const agent = new MediaAgent();
    const abort = () => {
      void agent.destroy(new Error('DOWNLOAD_TIMEOUT'));
    };
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) {
      abort();
      throw new AppError('DOWNLOAD_TIMEOUT', 504);
    }
    try {
      const options = { dispatcher: agent } as RequestInit;
      const stream = await downloadContentFromMessage(
        { mediaKey: descriptor.mediaKey, url },
        kind === 'PHOTO' ? 'image' : 'video',
        { options },
      );
      stream.once('close', () => {
        signal.removeEventListener('abort', abort);
        void agent.destroy();
      });
      return stream;
    } catch (error) {
      signal.removeEventListener('abort', abort);
      await agent.destroy();
      if (signal.aborted) throw new AppError('DOWNLOAD_TIMEOUT', 504);
      throw error;
    }
  }
  async close(logout: boolean) {
    this.stopped = true;
    if (this.retry) clearTimeout(this.retry);
    if (this.pairingTimer) clearTimeout(this.pairingTimer);
    if (logout && this.socket?.user) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          this.socket.logout(),
          new Promise<void>((resolve) => {
            timer = setTimeout(resolve, 5000);
          }),
        ]);
      } catch {
        /* remote revoke is best effort; local credentials are already revoked */
      } finally {
        if (timer) clearTimeout(timer);
      }
    }
    this.socket?.end(new Error('Closed by session owner'));
    this.socket = undefined;
    await this.flush?.();
  }
}
