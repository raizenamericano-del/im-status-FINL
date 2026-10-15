export type Session = {
  state: string;
  desired: boolean;
  lastConnectedAt: string | null;
  error: string | null;
  enabled: boolean;
  challenge: { type: 'qr' | 'code'; value: string } | null;
  challengeExpiresAt: string | null;
  worker: { online: boolean; storageReady: boolean; heartbeat: string | null; provider: string };
};
export type Media = {
  id: string;
  filename: string;
  contactName: string;
  kind: string;
  mime: string;
  bytes: number;
  duration: number | null;
  createdAt: string;
  statusId: string | null;
  deleteRequestedAt: string | null;
};
export type Status = {
  jobs?: { state: string; errorCode: string | null }[];
  id: string;
  contactName: string;
  kind: string;
  mime: string;
  duration: number | null;
  postedAt: string;
  expiresAt: string;
  media: { id: string; bytes: number; deleteRequestedAt: string | null } | null;
};
export type Activity = { id: string; kind: string; createdAt: string };
export type Job = {
  id: string;
  statusId: string | null;
  contactName: string;
  kind: string;
  state: string;
  attempts: number;
  error: string | null;
  updatedAt: string;
  status: { media: { id: string; deleteRequestedAt: string | null } | null } | null;
};
export type Dashboard = {
  session: Session;
  counts: {
    available: number;
    photos: number;
    videos: number;
    saved: number;
    completed: number;
    bytes: number;
  };
  recent: Media[];
  activity: Activity[];
};
export type PageData<T> = { items: T[]; total: number; page: number; pages: number };
export const activityLabels: Record<string, string> = {
  CONNECT_REQUESTED: 'Permintaan koneksi dibuat',
  CONNECTED: 'WhatsApp terhubung',
  DISCONNECTED: 'Sesi lokal diputuskan',
  RECONNECTING: 'Mencoba menghubungkan kembali',
  CONNECTION_ERROR: 'Koneksi memerlukan perhatian',
  STATUS_RECEIVED: 'Status baru diterima',
  DOWNLOAD_COMPLETED: 'Media berhasil disimpan',
  DOWNLOAD_FAILED: 'Pengambilan media gagal',
  MEDIA_DELETED: 'Media dihapus dari library',
};
export const stateLabels: Record<string, string> = {
  CONNECTED: 'Terhubung',
  CONNECTING: 'Menghubungkan',
  AWAITING_PAIRING: 'Menunggu penautan',
  DISCONNECTED: 'Belum terhubung',
  ERROR: 'Perlu perhatian',
  WORKER_OFFLINE: 'Worker offline',
};
export function bytes(n: number) {
  if (n === 0) return '0 B';
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1024 / 1024).toFixed(1) + ' MB';
}
export function date(value?: string | null) {
  return value
    ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(
        new Date(value),
      )
    : 'Belum pernah terhubung';
}
export function relative(value: string) {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  return mins < 1
    ? 'Baru saja'
    : mins < 60
      ? `${mins} menit lalu`
      : mins < 1440
        ? `${Math.floor(mins / 60)} jam lalu`
        : `${Math.floor(mins / 1440)} hari lalu`;
}
