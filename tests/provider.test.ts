import { describe, it, expect } from 'vitest';
import type { WAMessage } from '@whiskeysockets/baileys';
import { normalizeStatus } from '../worker/providers/baileys';
function fixture(): WAMessage {
  return {
    key: {
      remoteJid: 'status@broadcast',
      id: 'test-only-message',
      participant: 'test@s.whatsapp.net',
    },
    messageTimestamp: Math.floor(Date.now() / 1000),
    pushName: 'TEST FIXTURE',
    message: {
      imageMessage: {
        mimetype: 'image/jpeg',
        mediaKey: new Uint8Array(32),
        url: 'https://mmg.whatsapp.net/test.enc',
        caption: 'Do not retain this caption',
        contextInfo: { quotedMessage: { conversation: 'Do not retain this quoted message' } },
      },
    },
  };
}
describe('Baileys incoming status normalization', () => {
  it('accepts a current photo Status and retains only the required descriptor', () => {
    const result = normalizeStatus(fixture());
    expect(result?.kind).toBe('PHOTO');
    expect(JSON.stringify(result)).not.toContain('Do not retain');
    expect(JSON.stringify(result)).not.toContain('participant');
    expect(result?.contactName).toBe('TEST FIXTURE');
  });
  it('ignores private chats and groups', () => {
    for (const jid of ['friend@s.whatsapp.net', 'group@g.us', '123@broadcast']) {
      const m = fixture();
      m.key.remoteJid = jid;
      expect(normalizeStatus(m)).toBeNull();
    }
  });
  it('rejects view-once content', () => {
    const m = fixture();
    m.message!.imageMessage!.viewOnce = true;
    expect(normalizeStatus(m)).toBeNull();
    m.message = { viewOnceMessage: { message: m.message } };
    expect(normalizeStatus(m)).toBeNull();
  });
  it('ignores expired and implausibly future timestamps', () => {
    const m = fixture();
    m.messageTimestamp = Math.floor(Date.now() / 1000) - 86500;
    expect(normalizeStatus(m)).toBeNull();
    m.messageTimestamp = Math.floor(Date.now() / 1000) + 600;
    expect(normalizeStatus(m)).toBeNull();
  });
  it('ignores unsupported formats and text-only messages', () => {
    const m = fixture();
    m.message!.imageMessage!.mimetype = 'image/svg+xml';
    expect(normalizeStatus(m)).toBeNull();
    m.message = { conversation: 'text' };
    expect(normalizeStatus(m)).toBeNull();
  });
  it('accepts video metadata without promising quality', () => {
    const m = fixture();
    m.message = {
      videoMessage: {
        mimetype: 'video/mp4',
        mediaKey: new Uint8Array(32),
        directPath: '/test.enc',
        seconds: 12,
      },
    };
    expect(normalizeStatus(m)).toMatchObject({ kind: 'VIDEO', duration: 12 });
  });
  it('does not retain unbounded or invalid thumbnails', () => {
    const m = fixture();
    m.message!.imageMessage!.jpegThumbnail = new Uint8Array(110000);
    expect(normalizeStatus(m)?.thumbnail).toBeNull();
    m.message!.imageMessage!.jpegThumbnail = new Uint8Array([255, 216, 255]);
    expect(normalizeStatus(m)?.thumbnail).not.toBeNull();
  });
});
