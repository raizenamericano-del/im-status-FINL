# Pengujian v2.0.0 SQLite

Tanggal validasi: **15 Oktober 2026**. Node **22.23.3**, Linux, Prisma **6.19.3** SQLite, Next **16.4.1**, Playwright **1.64.1**, Chromium, FFmpeg/ffprobe dan util-linux/flock. Tidak membutuhkan PostgreSQL.

## Hasil

| Pemeriksaan                         | Hasil                                                                                              |
| ----------------------------------- | -------------------------------------------------------------------------------------------------- |
| Clean npm ci                        | Lulus, Node 22.23.3; lockfile digunakan                                                            |
| Prettier, TypeScript strict, ESLint | Lulus                                                                                              |
| Unit                                | **95 tests**, **7 files**                                                                          |
| Integration pada file SQLite nyata  | **25 skenario**                                                                                    |
| Production build/start              | Lulus                                                                                              |
| Startup supervisor nyata            | Migrasi otomatis, WAL, proses web + unpaired worker, lock, restart, fail-closed, crash supervision |
| Chromium browser                    | **16 skenario**                                                                                    |
| Axe WCAG 2A/2AA/2.1AA               | **17 audit**, **0 violations** terdeteksi                                                          |
| Responsive                          | 360, 390, 1440 px; no overflow pada rute yang diperiksa                                            |
| JavaScript page errors              | 0                                                                                                  |
| npm audit                           | 0 vulnerabilities pada pemeriksaan                                                                 |

Bukti: `verification.json`, `verification-log.txt`, `integration-result.json`, `startup-result.json`, `browser-result.json`, dan screenshots. Foto/video fixture jelas test-only, bukan Status live. Tidak ada mock-switch atau data contoh otomatis di entry produksi.

## Unit

Encryption nonce/AAD/tamper/missing key; password/admin-config/no default/rotation; cookie, CSRF, exact origin/body limits; SSRF host/protocol/DNS/IP; paths, MIME, range, bytes/hash, atomic storage, stream size/timeout, real ffprobe, unwritable filesystem, orphan cleanup; Status filters; privacy logger; safe server errors. Tambahan config lokal: trusted Railway origin derivation, invalid origin rejection, mount matching, private stable keys, ignore old PostgreSQL env, key mismatch/missing-file fail-closed.

## Integration

- Bootstrap admin konkuren tunggal, signup/email rejected, invalid/missing password config, foreign sessions/ownership.
- Schema readiness errors aman, CSRF/origin/consent, limit login dan atomic rate counters.
- Pairing challenge bukan Connected; explicit provider-open mock diperlukan.
- Encrypted credentials/Signal state ditulis child process A dan dibaca child B, tanpa live account.
- Ingestion dedupe/metadata isolation; concurrent queue dedupe; real file bytes/range/auth/owner checks.
- Search/filter/count, SSE scope/revocation, preference isolation, delete/physical cleanup, retention.
- Download errors/timeout/retry, worker offline/disabled, disconnect/stale generation rejection.
- Password rotation/logout; URL/UUID injection rejection; no raw secrets/stack in public errors.
- **Tiga proses** melakukan total 60 read-modify-write increments pada file SQLite yang sama, tanpa lost updates, menguji writer reservation lintas proses.

## Startup production lokal

Test memakai direktori acak khusus di `runtime/`, kemudian menghapusnya. Menjalankan entrypoint produksi sesungguhnya, bukan mock supervisor:

1. DATABASE_URL sengaja berisi PostgreSQL unreachable; app tetap membuat SQLite sendiri.
2. Tanpa ADMIN_PASSWORD, service dapat start tetapi readiness login 503, tanpa password default.
3. Migrasi otomatis + WAL; web dan worker Baileys nyata start **tanpa akun tertaut**, sehingga tidak ada pairing/provider network success yang diklaim.
4. Login, file PNG fixture, dan internal worker file streaming; bytes cocok.
5. Instance kedua ditolak oleh flock; instance pertama tetap hidup.
6. Stop/restart mempertahankan owner, cookie valid, digest file key, metadata dan bytes media.
7. Worker produksi sengaja di-SIGKILL; supervisor menghentikan web dan keluar nonzero.
8. Key mismatch/missing-file ditolak; log tidak memuat password/credential fixture.

Klien DB inspeksi test ditutup sebelum restart migrasi; migrasi SQLite memerlukan tidak adanya proses lain yang membuka DB. Pengujian ini bukan uji Docker daemon atau mount Railway.

## Browser

Landing/admin readiness error+retry/wrong password; secure cookie; genuine empty dashboard; desktop/mobile navigation; preferences hydration/persistence/retry; password managed via server; consent/QR waiting; explicit mock confirmation/SSE; media filter/search; photo save/download/modal toast; JPEG decode; MP4 play/pause/mute/seek; Range; library grid/list/sort/delete; job history/activity; menu/dialog/escape; disconnect confirmation; logout/access rejection.

## Reproduksi

```bash
npm ci
npx playwright install --with-deps chromium
npm run verify
```

Suite membuat dan menghapus data pada `runtime/verification_test.sqlite`; jangan gunakan nama/path itu untuk data produksi. Port 3300/3301/3210/3212/3213 harus kosong. Full verify menutup server sementara. FFmpeg dan flock wajib tersedia. CI config memakai Ubuntu, tanpa service PostgreSQL.

## Belum diuji / bukan klaim

- WhatsApp nyata: QR/code diterima, incoming Status, CDN asli, remote logout atau reconnect setelah restart.
- Docker/Compose build/run pada daemon, GitHub Actions runner eksternal, push repo, Railway deployment, actual volume mount/persistence/restore.
- Perangkat Android fisik, Safari/iOS, seluruh codec/browser, load besar, multi-node/NFS atau pentest independen.
- Nol axe violations bukan sertifikasi aksesibilitas; nol audit bukan jaminan tanpa celah.
- Pemindahan data PostgreSQL v1 tidak diimplementasikan; data lama tetap di instalasi lama.
