# Deployment v2 — satu service, SQLite lokal

## Topologi

Satu service/container Linux, satu replica, satu volume. Supervisor memegang OS file lock lalu menjalankan migrasi SQLite, Next.js, dan worker Node sebagai proses internal. Worker HTTP hanya mendengarkan 127.0.0.1; web mem-proxy file memakai service secret. Jangan membuat service/port publik khusus worker.

## Railway

1. Backup data v1 dahulu bila ada. Ganti source repo dengan **seluruh** source v2; jangan gabungkan migrasi PostgreSQL v1. Jangan commit `.env`, runtime data, DB, QR atau secrets.
2. Pakai Dockerfile dan `railway.toml` yang disediakan. Tidak perlu Railway PostgreSQL. Tidak ada pembuatan repo/push/deploy otomatis; pemilik melakukan langkah platform ini.
3. Hentikan worker v1 terpisah. Pasang volume di service aplikasi dengan **mount path `/data`**. Image memakai DATA_DIR=/data/im-status-local, sehingga media di `/data/media` milik worker v1 tidak dipindai/dihapus v2.
4. Isi ADMIN_PASSWORD yang kuat (12–128 karakter). Tetap gunakan password yang sudah diatur jika sesuai. Tidak ada login/default password otomatis.
5. Start Command: `npm start` atau `node scripts/start.mjs`. **Kosongkan custom Pre-deploy Command lama**. Migrasi dijalankan sendiri saat startup; jangan gunakan db push/reset/seed. Jangan memakai override start `npm run worker` atau `next start` langsung.
6. Gunakan domain publik service. RAILWAY_PUBLIC_DOMAIN dibaca otomatis untuk origin HTTPS. Untuk custom domain, isi APP_ORIGIN dengan exact origin. Jika domain baru dibuat setelah deployment, restart/redeploy supaya environment terbaru terbaca.
7. Tunggu `/api/health` 200. Buka `/login`; `/api/auth/config` memeriksa kesiapan password/key/origin/schema. Jika password belum ada, login diblokir dengan petunjuk, bukan bypass.
8. Owner menguji pairing/media/restart/volume persistence sendiri. Docker/GitHub Actions/Railway belum dieksekusi dari lingkungan pembuat paket ini.

**Satu replica dan tidak boleh sleep/serverless.** Hentikan deployment lama sebelum instance baru memakai volume yang sama. File lock menolak instance kedua; jangan menghapus lock untuk memaksa keduanya berjalan. Startup migration SQLite juga membutuhkan tidak adanya proses DB lain.

### Environment

| Variable        | Kebutuhan                                                                                                                                             |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| ADMIN_PASSWORD  | Wajib untuk login, 12–128 karakter; simpan privat, bukan password WhatsApp                                                                            |
| DATA_DIR        | Default image `/data/im-status-local`; biarkan default ketika volume di `/data`                                                                       |
| PORT            | Disediakan platform; default 3000                                                                                                                     |
| APP_ORIGIN      | Opsional untuk domain bawaan Railway; wajib untuk custom domain yang tidak tercantum dalam RAILWAY_PUBLIC_DOMAIN                                      |
| COOKIE_SECURE   | Default true di production/Railway; false hanya HTTP localhost                                                                                        |
| ENABLE_WHATSAPP | Default true; false menolak penautan baru dan tidak meresume sesi                                                                                     |
| ENCRYPTION_KEY  | Opsional saat pertama kali membuat data; jika ada harus 64 hex valid. Setelah key tersimpan, nilai env berbeda ditolak, bukan mengganti key diam-diam |
| WORKER_SECRET   | Opsional saat pertama kali membuat data; jika ada minimal 32 karakter, kemudian harus sesuai file tersimpan                                           |

DATABASE_URL, WORKER_URL, WORKER_PORT, MEDIA_ROOT dan SERVICE_ROLE dari versi lama **ditentukan ulang oleh supervisor**, bukan dipakai untuk menghubungkan service eksternal. Boleh hapus variable lama tersebut dari service aplikasi. Jangan menghapus service PostgreSQL/data lama tanpa keputusan dan backup terpisah.

Aplikasi mendeteksi mount filesystem untuk deployment Railway. Jika tidak ada mount yang menaungi DATA_DIR, startup gagal dengan DATA_VOLUME_REQUIRED daripada menyimpan ke disk ephemeral. File lock dan mount check ini diuji logikanya secara lokal; pemasangan volume Railway aktual tetap harus diverifikasi pemilik.

## Isi volume

```text
/data/im-status-local/
  hub.sqlite             # SQLite metadata, sessions, encrypted credentials
  hub.sqlite-wal         # dapat ada selama SQLite WAL aktif
  hub.sqlite-shm         # dapat ada selama SQLite WAL aktif
  server-secrets.json    # key + service secret privat, mode 0600
  .instance.lock         # OS flock, bukan penanda yang perlu dihapus
  media/                 # foto/video dan temporary files privat
```

Folder 0700; umask proses 077. Docker entrypoint menyiapkan ownership lalu menjalankan aplikasi sebagai user `node`. Key baru hanya dibuat saat belum ada DB/key; DB yang sudah ada tanpa file key ditolak (kecuali operator menyediakan key asli secara eksplisit). File key ditulis privat, fsync, lalu rename; jangan menghapus/mengganti file tersebut untuk mencoba memperbaiki login.

## Password dan backup

Ubah ADMIN_PASSWORD lalu redeploy untuk mereset login; admin tetap sama. Key enkripsi tidak perlu dirotasi. Cookie password lama ditolak dan sesi lama dicabut pada login baru.

Untuk backup sederhana dan konsisten: **hentikan service**, backup seluruh folder data termasuk database/WAL bila ada, key dan media, lalu nyalakan kembali. Jangan menyalin hanya `hub.sqlite` saat proses masih menulis. Lindungi dan enkripsi arsip backup, karena key berada bersama data dalam volume. Pemisahan key/KMS belum diimplementasikan. Restore folder utuh dengan izin/ownership yang benar, volume dan password admin yang Anda kelola; uji restore memakai media berizin.

File data v1 tidak diimpor. Backup PostgreSQL, key dan volume v1 tetap terpisah; jangan menimpa/menghapusnya sebagai bagian dari upgrade SQLite.

## Local Docker

`docker compose up --build` memakai satu named volume dan satu container, HTTP localhost. Ini konfigurasi yang disediakan, bukan klaim Docker daemon berhasil dijalankan. Untuk pengujian Node lokal lihat README; util-linux/flock dan FFmpeg diperlukan.
