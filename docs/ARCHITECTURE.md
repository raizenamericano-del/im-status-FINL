# Architecture — SQLite local v2

## Proses dan storage

```text
Browser --HTTPS + cookie/CSRF--> Next.js API
                                  | SQLite file (shared local volume)
                                  | signed internal HTTP, loopback only
                             Node Baileys worker
                                  | provider WebSocket / guarded CDN media
                                  | durable media directory
```

Satu container/service, dua proses internal long-lived, satu filesystem/replica. `scripts/start.mjs` memegang OS flock melalui `flock --no-fork`; `scripts/service.mjs` menjalankan konfigurasi, migrasi lalu anak web/worker. Web/worker exit menyebabkan keduanya dihentikan dan service keluar nonzero; signal shutdown diteruskan, child diberi batas waktu sebelum SIGKILL. Supervisor yang exit tidak meninggalkan child sebagai service setengah aktif.

SQLite WAL memungkinkan pembaca saat writer aktif. Satu connection per proses, busy timeout, transaction max-wait/timeout, dan writer reservation sebelum read-modify-write. `writeTransaction` memulai dengan UPDATE tanpa row untuk memperoleh reservation SQLite, bukan PostgreSQL advisory/row lock. Retry dibatasi untuk conflict/timeout tertentu; callback hanya mengubah database, tidak mengulangi network download. Queue, generation fencing, credential writes, ingestion dedupe, admin bootstrap dan finalisasi job memakai transaksi.

## Admin

ADMIN_PASSWORD hanya environment; no default/signup/email. `AdminAccess(id=owner)` menunjuk User khusus. Keyed HMAC constant-time membandingkan password dan memberi session version. Random cookie 256-bit disimpan sebagai digest dengan expiry tujuh hari. Owner marker dan password/key version diperiksa tiap request dan tick SSE. Login pertama setelah password rotation menghapus session rows lama, tidak membuat owner baru. User lain/legacy fixtures tidak diadopsi.

Kunci AES-GCM/service otomatis disimpan privat sekali pada volume. ENCRYPTION_KEY env yang valid dapat dipakai untuk inisialisasi awal, tetapi key mismatch terhadap file ditolak. Ini bukan KMS atau pemisahan key dari volume; backup perlu dilindungi.

## WhatsApp lifecycle

DISCONNECTED → CONNECTING → AWAITING_PAIRING → CONNECTED hanya dari event backend/provider open. ERROR/WORKER_OFFLINE bukan Connected. Owner memberi consent dan menyelesaikan QR/kode sendiri. QR/code memiliki batas waktu, ciphertext disimpan dengan AAD; tidak ada QR/code/OTP di activity/log.

Command queue dan desired/generation di DB memisahkan API dari socket worker. Startup hanya meresume sesi admin yang desired dan credentials-nya registered; sesi unregistered tidak diteruskan diam-diam tanpa command aktif. Reconnect terbatas dan bergantung provider. Heartbeat stale >20 detik ditampilkan offline. File secret/credential/Signal keys survive proses restart; live socket resumption bukan jaminan.

Incoming notify Status foto/video yang masih aktif dan memang dikirim ke akun disaring; chat pribadi/group/view-once/text/history/expired diabaikan. Fingerprint user-scoped mencegah duplikasi. Descriptor terenkripsi; API tidak memberikan remote media URL untuk diambil bebas.

## Media dan pekerjaan

Queue WAITING/PROCESSING/COMPLETED/FAILED durable, retry/dedupe, attempts/history nyata. Streaming memakai deadline, bounded bytes, SSRF/DNS/redirect allowlist, MIME magic, hash dan ffprobe. Temporary file di-rename secara atomik; Completed hanya setelah file ada dan metadata tersimpan. Worker restart menandai PROCESSING yang terputus sebagai FAILED/DOWNLOAD_INTERRUPTED, bukan sukses palsu.

Preview penuh menyiapkan/menyimpan media setelah persetujuan. Library, search, filters, pagination, original download dan HTTP Range menggunakan record/file aktual. Query SQLite LIKE melakukan case-insensitive ASCII, bukan jaminan full Unicode case folding.

Delete langsung membuat file inaccessible dan worker menghapus bytes; retensi default 7 hari, maksimum 90; expired descriptor dan orphan file dibersihkan. Penghapusan bukan forensic wipe backup. Disconnect mencabut active credentials/descriptor dan menaikkan generation, menolak stale callback; remote logout best-effort.

## Batas

Tidak ada PostgreSQL, shared volume antar-service, multi-replica/sharding/NFS, upload Status/bot pengirim, mock di production, universal URL fetch atau automatic migration data v1. Browser suite memakai worker test terpisah; entry production selalu memakai Baileys. Metadata dan media tidak fabricated/seeded di produksi.
