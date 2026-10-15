# Evaluasi provider

Ditinjau untuk proyek ini pada 15 Oktober 2026. Nomor versi berasal dari registry npm yang benar-benar diperiksa, bukan asumsi dari contoh lama.

## Pilihan

| Opsi                                        | Bukti / batasan                                                                                                                                                                                                         | Keputusan                                                                                                                  |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Meta WhatsApp Business Platform / Cloud API | Dokumentasi resmi memaparkan messaging, media, webhooks, business assets, calling/groups. Delivery “message status” bukan fitur WhatsApp Status Stories. Tidak menyediakan API umum untuk membaca seluruh Status teman. | Tidak digunakan untuk kebutuhan Stories. Tidak membuat endpoint fiktif.                                                    |
| WhiskeySockets/Baileys                      | Socket WhatsApp Web; auth state credentials + Signal keys, QR / requestPairingCode, connection.update, messages.upsert, status broadcast JID, unduhan media. MIT.                                                       | Dipilih karena tidak memerlukan browser Chromium produksi dan auth store dapat diimplementasi langsung secara terenkripsi. |
| whatsapp-web.js                             | README upstream: memakai Puppeteer + managed browser, QR, ready/message events, authentication strategies, penerimaan media; Apache-2.0. Disclaimer eksplisit bahwa akun bisa diblokir.                                 | Tidak dipasang. Memerlukan browser produksi tambahan; tidak memberi jaminan akses semua Stories. Bukan fallback otomatis.  |

Baileys dikunci **7.0.0-rc14**. npm `latest` menunjuk rc14 dan `legacy` menunjuk 6.7.24 saat pemeriksaan. **rc14 adalah release candidate, bukan rilis stabil.** Memilihnya adalah kompromi kompatibilitas protokol baru, bukan janji kestabilan. README upstream menyebut breaking changes v7 dan dokumentasi yang masih berkembang. Perubahan upstream mengenai identitas handshake Windows menunjukkan mengapa release lama tidak otomatis lebih cocok untuk protokol terbaru.

Registry metadata paket terpasang:

- Engines: Node >=20.0.0; proyek merekomendasikan Node 22 LTS.
- License: MIT, diperiksa juga dari file LICENSE paket.
- gitHead: `7e7b0757e3f9f3c7789fb1cfd2f241d5002a199a`.
- Integrity: `sha512-WK+X8ju8TPGxvWIsP8hrY6JB6FltYuFe+vsqKfjOYX25JObij9qLf2c3ZGdl1Q+vhFwbnT+AZmWAB5pTvzmSiQ==`.

## Dukungan yang diimplementasikan

- `makeWASocket`, `Browsers.macOS('Chrome')`; tidak menggunakan identitas Windows lama yang diketahui bermasalah.
- QR dari `connection.update.qr`; kode dari `requestPairingCode(number)` **setelah event QR**, bukan sebelum socket siap. Kode hanya diminta bila credentials belum registered.
- `connection.update.open` satu-satunya konfirmasi Connected. Credential updates di-save ke encrypted DB auth store.
- Fresh `messages.upsert` bertipe **notify**, `remoteJid === status@broadcast`, imageMessage/videoMessage saja. Sumber terpasang `Socket/messages-recv.js` secara eksplisit menangani status broadcast dan expiry 24 jam.
- `downloadContentFromMessage(..., 'image'|'video', { options: { dispatcher } })` menghasilkan stream; implementasi source yang terpasang diperiksa bahwa dispatcher diteruskan ke fetch. Tidak mengandalkan `signal`/`redirect` request options yang ternyata tidak diteruskan oleh helper paket ini.
- Dispatcher memeriksa tiap origin termasuk redirect dan DNS publik. Per-download agent dihancurkan saat timeout. Lebih memilih directPath dengan host tetap `mmg.whatsapp.net`.
- Bytes asli dicek batas ukuran, magic MIME dan SHA-256 jika provider memberi file hash. Video diukur menggunakan ffprobe; tidak dikonversi.
- Reconnect backoff 1/2/4/8/16 detik, maksimum lima percobaan berturut-turut sebelum Error. Login ulang required untuk logout/bad session/replaced session/multidevice mismatch. Restart-required dapat membuka socket baru memakai credentials yang sudah disimpan.

## Batas yang eksplisit

Tidak ada polling endpoint “semua Status”, sinkronisasi riwayat lama, upload Status, kirim pesan, download chat, view-once unwrap, maupun fetch URL dari pengguna. Status yang sudah diterima bisa tidak bisa diunduh lagi. Tidak otomatis meminta re-upload media kedaluwarsa. `append`/history batches sengaja diabaikan, sehingga kelengkapan feed tidak dijanjikan.

Nama kontak berasal dari pushName event yang tersedia, bukan phonebook scrape. Jika tidak ada nama, tampil “Kontak WhatsApp”. Tidak mengarang nomor, avatar, durasi atau kualitas.

Baileys dapat memproses pesan/protokol akun di memori sebagai linked device. Aplikasi hanya mempersist event Status yang lolos filter; menonaktifkan full-history sync bukan jaminan bahwa library tidak pernah melihat data protokol lain. Jangan gunakan untuk akun yang tidak diizinkan.

## Bukti vs belum dibuktikan

**Dibuktikan lokal:** library dapat diimport/dijalankan; adapter cocok dengan tipe/API rc14; worker idle aktif; parser/status filters; encrypted auth credentials dan Signal keys pulih di proses kedua; seluruh alur aplikasi lewat mock terisolasi dan DB nyata.

**Belum dibuktikan dengan akun WhatsApp nyata:** QR diterima WhatsApp saat ini, pairing code berhasil, event Status benar-benar dikirim WhatsApp ke sesi pengguna, download CDN nyata, logout remote dan reconnect akun nyata setelah restart. Semua memerlukan pemilik akun melakukan uji berizin. Jangan mengganti checklist ini menjadi “verified” hanya karena unit tests lulus.

## Sumber primer

1. [Meta — About the WhatsApp Business Platform](https://developers.facebook.com/documentation/business-messaging/whatsapp/about-the-platform), halaman resmi yang dibaca; pembaruan halaman 4 Agustus 2026.
2. [Baileys upstream README & disclaimer](https://github.com/WhiskeySockets/Baileys).
3. [Baileys — Session management](https://baileys.wiki/authentication/session-management.md): peringatan useMultiFileAuthState tidak untuk produksi, struktur credentials/Signal keys dan BufferJSON.
4. [Baileys — Pairing code](https://baileys.wiki/authentication/pairing-code.md): requestPairingCode, format nomor, trigger QR dan event open.
5. [Baileys — Media messages](https://baileys.wiki/messaging/media-messages.md): media streaming dan batas media kedaluwarsa.
6. [Baileys — Broadcasts & Stories](https://baileys.wiki/features/broadcasts-stories.md): JID status@broadcast. Halaman ini terutama menjelaskan publishing; bukti jalur receive juga diperiksa langsung dalam source paket terpasang.
7. [Baileys docs index](https://baileys.wiki/llms.txt). URL docs lama `/docs/socket/connecting/` sudah tidak digunakan karena 404.
8. [whatsapp-web.js README](https://github.com/wwebjs/whatsapp-web.js): Puppeteer, auth, dukungan dan disclaimer; tidak dianggap bukti all-Status access.
9. Registry yang diperiksa: `npm view @whiskeysockets/baileys@7.0.0-rc14 version engines license gitHead dist.integrity dist-tags --json`.
