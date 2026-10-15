# Checklist v2.0.0 SQLite Local

## Terimplementasi / diuji lokal

- [x] Admin satu password, no signup/email/default, auto-bootstrap, rotation/logout/SSE revalidation.
- [x] Satu service menjalankan web dan worker, worker HTTP loopback, file service authenticated dan owner-scoped.
- [x] SQLite lokal, migrasi startup otomatis, WAL, single-writer transactions, 60 increments lintas tiga proses.
- [x] Private stable key file, fail-closed jika hilang/tidak cocok, original key dipertahankan.
- [x] OS flock menolak instance ganda, worker crash menghentikan web, graceful signal handling dengan batas waktu.
- [x] Restart mempertahankan owner/cookie/key/metadata/media bytes lokal.
- [x] Dashboard/Status/library/history/activity/preferences nyata; mobile/desktop/empty/loading/error states.
- [x] Pairing adapter, ownership/consent; Connected hanya provider-open; no fake Status/contacts/counts.
- [x] Encrypted auth/Signal/descriptor/challenge, generation fencing, durable queue/retry/dedupe/cleanup.
- [x] Bytes/range/MIME/hash/ffprobe, SSRF/DNS/path limits, timeout/kuota, preview/download/delete/retention.
- [x] 95 unit, 25 integration, 16 browser, 17 axe audits; strict TS/lint/build/audit.
- [x] Dockerfile single-service, Compose single-volume, Railway config, CI tanpa PostgreSQL, setup/deploy/security/provider/troubleshooting docs.

## Wajib dilakukan pemilik deployment

- [ ] Update source repo dan deploy v2, bukan hanya mengganti variable database v1.
- [ ] Mount volume `/data` pada service aplikasi, satu replica; hentikan worker v1.
- [ ] Set ADMIN_PASSWORD kuat, public domain/HTTPS, exact custom origin bila dipakai.
- [ ] Verifikasi actual Railway volume persistence/backup/restore dan resource capacity.
- [ ] Jalankan Docker/GitHub Actions/Railway sesungguhnya; belum dieksekusi dari lingkungan pembuat.
- [ ] Uji WhatsApp akun sendiri/berizin, incoming Status/media, reconnect dan remote unlink.
- [ ] Lindungi volume/backup/key, tetapkan retention snapshot/log/backup dan monitoring.

## Bukan fitur / jaminan

- [ ] Impor otomatis PostgreSQL v1 ke SQLite; data v1 tidak dihapus oleh v2.
- [ ] Semua Status teman, backfill penuh, bypass privasi, chat/view-once downloader, URL fetch bebas.
- [ ] Multi-replica/NFS/serverless, cloud object storage, MFA/KMS/email reset.
- [ ] Meta resmi, bebas ban, reconnect permanen, browser pasti menyimpan file ke Downloads.
