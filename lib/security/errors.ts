export class AppError extends Error {
  constructor(
    public code: string,
    public status = 400,
  ) {
    super(code);
  }
}
export const errorMessages: Record<string, string> = {
  UNAUTHENTICATED: 'Silakan masuk kembali.',
  FORBIDDEN: 'Permintaan tidak diizinkan.',
  INVALID_INPUT: 'Periksa kembali data yang Anda masukkan.',
  NOT_FOUND: 'Item tidak ditemukan.',
  INVALID_CREDENTIALS: 'Kata sandi admin tidak sesuai.',
  APP_ORIGIN_REQUIRED:
    'Buat public domain untuk service ini, lalu restart. Untuk custom domain, isi APP_ORIGIN dengan alamat HTTPS yang tepat.',
  ADMIN_SETUP_REQUIRED:
    'Login admin belum disiapkan. Atur ADMIN_PASSWORD (12–128 karakter) pada service web, lalu deploy ulang.',
  ADMIN_PASSWORD_MANAGED:
    'Ubah ADMIN_PASSWORD pada service web, lalu deploy ulang. Sesi login lama otomatis tidak berlaku.',
  RATE_LIMITED: 'Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi.',
  WORKER_OFFLINE: 'Worker belum tersedia. Periksa layanan lalu coba lagi.',
  PROVIDER_DISABLED: 'Integrasi WhatsApp belum diaktifkan oleh pengelola.',
  SESSION_OFFLINE: 'Hubungkan kembali WhatsApp sebelum mengambil media baru.',
  MEDIA_EXPIRED: 'Status sudah kedaluwarsa atau media tidak lagi tersedia.',
  MEDIA_UNAVAILABLE: 'Provider tidak menyediakan media ini. Coba lagi jika status masih aktif.',
  UNSUPPORTED_MEDIA: 'Format media tidak didukung atau isi file tidak sesuai.',
  MEDIA_TOO_LARGE: 'Media melebihi batas 64 MB.',
  STORAGE_QUOTA: 'Kapasitas library 512 MB tercapai. Hapus beberapa media.',
  STORAGE_ERROR: 'Penyimpanan tidak dapat diakses atau penuh. Hubungi pengelola.',
  DOWNLOAD_TIMEOUT: 'Pengambilan media melewati batas waktu. Silakan coba lagi.',
  DOWNLOAD_INTERRUPTED: 'Worker berhenti saat mengunduh. Silakan coba lagi.',
  CONNECTION_FAILED: 'Koneksi WhatsApp gagal. Coba hubungkan ulang.',
  SESSION_EXPIRED: 'Sesi WhatsApp berakhir. Tautkan perangkat kembali.',
  PAIRING_TIMEOUT: 'Waktu penautan habis. Buat QR atau kode baru.',
  SSRF_BLOCKED: 'Alamat media provider tidak diizinkan.',
  DATABASE_NOT_READY: 'Database belum siap. Periksa log startup dan volume penyimpanan lokal.',
  DATABASE_UNAVAILABLE:
    'Database belum dapat diakses. Pengelola perlu memeriksa file database lokal dan izin volume.',
  SERVER_CONFIG_INCOMPLETE: 'Konfigurasi keamanan server belum lengkap. Hubungi pengelola.',
  INTERNAL_ERROR: 'Layanan mengalami gangguan. Silakan coba lagi.',
  DELETION_PENDING: 'Media sedang dihapus. Tunggu sampai proses selesai.',
};
export const errorMessage = (code: string) => errorMessages[code] ?? errorMessages.INTERNAL_ERROR;
