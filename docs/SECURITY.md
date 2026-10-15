# Security — SQLite local v2

## Controls

- Admin-only: ADMIN_PASSWORD 12–128 karakter, no default/signup/email. Keyed HMAC constant-time, bootstrap dedicated owner atomik. Cookie acak 256-bit, digest di DB, tujuh hari; owner + auth version diperiksa ulang, termasuk SSE. Password rotation via env + redeploy, bukan key rotation.
- Cookie HttpOnly, Secure default di production, SameSite=Lax. Exact trusted Origin + HMAC CSRF untuk mutasi; login membutuhkan exact origin + JSON. Domain Railway dari environment, tidak mempercayai Host/X-Forwarded-Host untuk allowlist. Custom domain eksplisit.
- Login rate limit 10/5 menit, global auth 120/menit, API 600/menit/admin, connect 5/5 menit, download 30/menit, file 120/menit, SSE 20/menit. Atomic SQLite counters; tidak mempercayai IP spoof dari X-Forwarded-For.
- Authentication/ownership untuk metadata, QR/code, thumbnails, files, jobs, preferences, history/activity, SSE. Session foreign/legacy ditolak. Strict JSON <=16 KiB, UUID/pagination bounds, no arbitrary upload/path/URL fetch.
- AES-256-GCM nonce acak + AAD user/scope/key untuk auth/Signal keys, challenges, commands, descriptors. Generation fencing mencegah callback stale mengembalikan secrets setelah revoke.
- File key/service secret mode 0600, data directory 0700, umask 077. Key tidak dikirim ke browser atau log. Startup menolak key mismatch dan DB yang kehilangan key tanpa key asli dari operator; tidak regenerate diam-diam.
- Satu service memegang OS flock; worker hanya loopback + service token dan owner checking ulang. SQLite WAL + transaksi writer-reserved dan constraint uniqueness. Tidak mematikan foreign keys di operasi runtime.
- Provider logger silent; worker bootstrap memfilter raw console libsignal ke event allowlist. API/startup logs hanya code aman tanpa URL DB, SQL, stack, credential, QR atau pesan asli.
- CDN media hanya HTTPS + hostname WhatsApp allowlist; larang userinfo/custom port, private/link-local/mapped IP, validasi DNS/redirect per dispatch. Abort/deadline, kuota/stream size, MIME magic, hash dan ffprobe. URL worker adalah config operator/internal supervisor, bukan input browser.
- Filename/storage key server-generated UUID, directory/file privat, symlink media ditolak. File response MIME nyata, nosniff, no-store/private, safe Content-Disposition, single-range support.
- CSP self assets, restrictive object/base/form/frame policies, no-referrer, Permissions-Policy, HSTS production. Tidak ada raw HTML atau CDN dependency di frontend.

## Residual risk dan operator

1. Baileys bukan Meta resmi; perubahan protokol, disconnect/ban, dan risiko prerelease tetap ada. Izin akun tidak menghapus ketentuan WhatsApp. Gunakan hanya akun sendiri/berizin; jangan stalkerware/spam atau menyerahkan OTP/QR ke operator.
2. SQLite dan media bukan otomatis terenkripsi seluruhnya. Metadata/media plaintext pada volume privat; auth descriptors/credentials dienkripsi. **Key berada di volume yang sama**, bukan KMS: orang dengan akses volume/backup dapat membaca key dan data. Enkripsi backup, batasi operator dan gunakan encryption-at-rest platform.
3. Jangan mengganti key setelah dipakai. Hilangnya file key tanpa salinan asli membuat credentials lama tidak bisa dipulihkan. Password admin dapat diganti terpisah melalui env; tidak perlu menghapus DB.
4. Password admin bersama tidak memberikan identitas per operator; tidak ada MFA, email reset, antivirus, WAF atau pentest independen. Gunakan password acak kuat; rate limit global berpotensi dimanfaatkan untuk menunda login. Perlindungan edge/network adalah tanggung jawab deployment.
5. File lock/single writer bukan dukungan multi-node. Gunakan satu replica dengan filesystem lokal POSIX; jangan NFS/volume sharing antar-service. Volume mount Railway wajib benar-benar tersedia; bukan sekadar variabel path.
6. Backup konsisten dengan menghentikan service dan menyalin seluruh data/key/media. Jangan hot-copy hanya file utama SQLite tanpa WAL. Tetapkan TTL snapshot/WAL/backup dan uji restore. Tidak ada jaminan forensic wipe atau penarikan salinan yang sudah diunduh.
7. Remote logout best-effort; owner memeriksa/mencabut perangkat di WhatsApp. Reconnect/Status nyata belum diuji di akun live.
8. TLS, patching, reverse-proxy limits, volume capacity, alerting dan resource sizing adalah tanggung jawab deployment. CSP inline script/style diperlukan Next; bukan nonce-only CSP.
9. Source/lockfile dipin dan audit dijalankan; hasil audit 0 hanya pada saat pengujian, bukan jaminan tanpa kelemahan. Provider memiliki akses akun di prosesnya; aplikasi bukan sandbox bagi library.
10. v2 tidak mengimpor atau menghapus database/media PostgreSQL v1. Hindari menjalankan worker v1 dan v2 untuk sesi akun yang sama. Simpan backup/key lama terpisah.

Laporkan issue secara privat dengan code error dan langkah reproduksi. Jangan kirim `.env`, DB dump, key file, QR/code/OTP atau media pribadi.
