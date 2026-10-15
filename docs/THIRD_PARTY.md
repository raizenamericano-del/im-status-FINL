# Third-party notices

- **WhiskeySockets/Baileys 7.0.0-rc14** — MIT, copyright 2025 Rajeh Taher/WhiskeySockets. License terdapat dalam paket npm. Integrasi tidak resmi dan tidak diendors oleh WhatsApp/Meta.
- **whatsapp-web.js** — hanya dievaluasi, tidak dibundel/dipakai; Apache-2.0.
- **Manrope variable font** — SIL Open Font License 1.1. File `public/fonts/manrope.ttf` dan `public/fonts/OFL.txt`, diambil dari [google/fonts/ofl/manrope](https://github.com/google/fonts/tree/main/ofl/manrope). Disajikan lokal, tanpa request Google Fonts dari browser.
- Next.js, React, Prisma, Tailwind, Lucide, pino, qrcode.react, undici, Zod dan dependency lainnya mempertahankan lisensi paket masing-masing. Referensi versi/integrity ada di `package-lock.json`; metadata/lisensi disertakan oleh npm pada distribusi dependency.
- FFmpeg/ffprobe dipasang dari paket OS pada Docker runtime. Distribusi biner mengikuti lisensi build Debian (termasuk komponen GPL jika diaktifkan). Lihat `/usr/share/doc/ffmpeg/copyright` pada image yang dibangun.
- Ilustrasi dan mark IM dalam source dibuat untuk proyek ini; tidak memakai logo WhatsApp resmi atau foto orang lain. Gambar/video `TEST FIXTURE` hanya fixture pengujian yang dibuat lokal.

Lisensi sumber proyek di root tidak mengganti lisensi font/dependency atau memberi hak atas merek/konten pihak lain.

- SQLite melalui Prisma dan util-linux/flock serta gosu dari paket Debian mempertahankan lisensi komponen masing-masing; periksa `/usr/share/doc/` pada image distribusi. pg/PostgreSQL tidak dipakai oleh runtime v2.
