# Versi final SQLite — mulai dari sini

**Satu service. Satu password admin. Tanpa PostgreSQL.** Database dibuat otomatis sebagai file lokal di volume service, bukan di HP/browser Anda.

## Railway — 4 langkah

1. **Ganti source repo dengan isi paket v2.0.0 ini** dan deploy service aplikasi dari Dockerfile yang disediakan. Jangan mencampur folder `prisma/` dengan migrasi PostgreSQL v1. Gunakan satu replica; hentikan worker v1 terpisah. Backup data lama dahulu, jangan hapus database/volume lama.
2. **Pasang satu Volume pada service aplikasi**, mount path **`/data`**. Ini wajib agar database, media, dan kunci tetap ada setelah redeploy. Mengisi variabel `/data` saja bukan memasang volume.
3. Di Variables, isi **`ADMIN_PASSWORD`** dengan password kuat 12–128 karakter. Password yang sudah Anda atur boleh dipertahankan. Tidak ada password bawaan. `DATABASE_URL`, `WORKER_URL`, dan `SERVICE_ROLE` lama tidak dipakai dan boleh dihapus dari **service aplikasi**; jangan menghapus PostgreSQL/data lama.
4. Gunakan Start Command **`npm start`**, kosongkan custom Pre-deploy Command lama, lalu deploy. Gunakan domain publik service ini (buat lewat Generate Domain jika belum ada). **APP_ORIGIN otomatis dari domain Railway**; untuk custom domain, isi origin HTTPS persis tanpa path/slash akhir. Setelah aktif, buka `/login` dan masukkan password admin.

`ENCRYPTION_KEY` dan `WORKER_SECRET` tidak perlu dibuat manual untuk instalasi baru: keduanya dibuat privat sekali dan disimpan di volume. Bila variabel tersebut sudah terisi dengan nilai valid, nilainya dipertahankan saat pembuatan awal. Jangan mengubah key setelah data terenkripsi tersimpan.

## Yang otomatis

- Database SQLite dan migrasi tabel.
- Kunci enkripsi/service yang disimpan di file privat, tidak dicetak ke log.
- Menjalankan web dan worker bersama dalam satu service.
- Admin dibuat pada login benar pertama kali.
- SQLite WAL, perlindungan instance ganda, dan penghentian web jika worker mati.

## Yang tidak otomatis

- Pemasangan volume/domain di akun Railway Anda.
- Memindahkan data PostgreSQL v1 ke SQLite. Ini workspace baru; data v1 tidak dihapus oleh aplikasi v2.
- Menautkan WhatsApp: tetap pemilik yang memindai QR/memasukkan kode melalui aplikasi WhatsApp sendiri.

Database/kunci/media berada di `/data/im-status-local/`. **Jangan hapus `server-secrets.json` atau volume tersebut.** Backup seluruh folder secara konsisten saat service berhenti.

Panduan rinci: [DEPLOYMENT](docs/DEPLOYMENT.md). Hasil tes dan batasnya: [TESTING](docs/TESTING.md). Paket ini sudah diuji lokal, tetapi belum dideploy ke akun Railway pengguna.
