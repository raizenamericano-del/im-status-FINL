import 'dotenv/config';
import { chromium } from 'playwright';
import { expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { PrismaClient } from '@prisma/client';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const base = process.env.BROWSER_BASE_URL || 'http://localhost:3300',
  testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl || !new URL(testUrl).pathname.endsWith('_test.sqlite'))
  throw new Error('TEST_DATABASE_URL ending in _test.sqlite is required');
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname))
  throw new Error('Browser suite only targets a local test app');
const db = new PrismaClient({ datasourceUrl: testUrl });
await db.user.deleteMany();
await db.rateBucket.deleteMany();
const browser = await chromium.launch(),
  context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true,
  }),
  page = await context.newPage();
const failures = [],
  consoleErrors = [],
  accessibility = [];
let count = 0;
page.on('pageerror', (e) => consoleErrors.push(e.message));
async function scenario(name, fn) {
  await fn();
  count++;
  console.log('PASS ' + name);
}
async function noOverflow() {
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    false,
    'Horizontal overflow',
  );
}
async function audit(name) {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  const violations = result.violations.map((v) => ({
    id: v.id,
    nodes: v.nodes.map((n) => ({ target: n.target, reason: n.failureSummary })),
  }));
  accessibility.push({ page: name, violations });
  if (violations.length) failures.push({ page: name, violations });
}
await fs.mkdir('docs/screenshots', { recursive: true });
try {
  await scenario('landing navigation, local assets and responsive layout', async () => {
    await page.goto(base);
    await expect(page.getByRole('heading', { name: /Momen singkat/ })).toBeVisible();
    await noOverflow();
    await audit('landing-desktop');
    await page.screenshot({ path: 'docs/screenshots/landing.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await noOverflow();
    await audit('landing-mobile');
    await page.getByRole('link', { name: 'Masuk admin' }).click();
    await expect(page.getByRole('heading', { name: 'Login admin.' })).toBeVisible();
    await expect(page.locator('[name=name], [name=email]')).toHaveCount(0);
    await expect(page.locator('[name=invite]')).toHaveCount(0);
    await expect(page.getByText('Kode undangan', { exact: true })).toHaveCount(0);
  });
  await scenario('admin setup readiness failure blocks login and retry recovers', async () => {
    await page.route('**/api/auth/config', (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 'ADMIN_SETUP_REQUIRED',
            message: 'Atur ADMIN_PASSWORD untuk melanjutkan.',
          },
        }),
      }),
    );
    await page.reload();
    await expect(page.getByText('Atur ADMIN_PASSWORD untuk melanjutkan.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Masuk sebagai admin' })).toBeDisabled();
    await page.unroute('**/api/auth/config');
    await page.getByRole('button', { name: 'Periksa lagi' }).click();
    await expect(page.getByRole('button', { name: 'Masuk sebagai admin' })).toBeEnabled();
    await audit('admin-login-mobile');
    await page.screenshot({ path: 'docs/screenshots/admin-login.png', fullPage: true });
  });
  await scenario(
    'password-only admin login, secure cookie and authenticated empty dashboard',
    async () => {
      await page.locator('[name=password]').fill('Wrong-admin-password!');
      await page.getByRole('button', { name: 'Masuk sebagai admin', exact: true }).click();
      await expect(page.getByText('Kata sandi admin tidak sesuai.')).toBeVisible();
      await page.locator('[name=password]').fill('Browser-admin-password-2026!');
      await page.getByRole('button', { name: 'Masuk sebagai admin', exact: true }).click();
      await page.waitForURL(base + '/hub');
      await expect(page.getByText('Status Anda,')).toBeVisible();
      await noOverflow();
      const cookie = (await context.cookies()).find((c) => c.name === 'im_session');
      assert.ok(cookie?.httpOnly && cookie.secure && cookie.sameSite === 'Lax');
      await audit('dashboard-mobile');
      await page.screenshot({ path: 'docs/screenshots/dashboard-mobile.png', fullPage: true });
      await page.setViewportSize({ width: 1440, height: 1000 });
      await audit('dashboard-desktop');
      await page.screenshot({ path: 'docs/screenshots/dashboard-desktop.png', fullPage: true });
    },
  );
  await scenario('desktop empty pages, filters and navigation', async () => {
    for (const route of ['statuses', 'library', 'history', 'activity', 'settings']) {
      await page.goto(`${base}/hub/${route}`);
      await expect(page.locator('.hub-main h1')).toBeVisible();
      await noOverflow();
      await audit(route + '-desktop');
    }
    await page.goto(`${base}/hub/statuses`);
    await page.getByRole('button', { name: 'Foto', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Tidak ada media yang cocok.' })).toBeVisible();
    await page.getByRole('button', { name: 'Reset filter' }).click();
    await expect(page.getByRole('heading', { name: 'Menunggu momen pertama.' })).toBeVisible();
  });
  await scenario('preferences persist and admin password settings are server-managed', async () => {
    await page.goto(`${base}/hub/settings`);
    await page.getByLabel('Masa simpan media').selectOption('14');
    await page.getByRole('switch', { name: 'Notifikasi di aplikasi' }).click();
    await page.getByRole('button', { name: 'Simpan preferensi' }).click();
    await expect(page.getByText('Preferensi berhasil disimpan.')).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('Masa simpan media')).toHaveValue('14');
    await expect(page.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByText('ADMIN_PASSWORD', { exact: true })).toBeVisible();
    await expect(page.locator('[name=current], [name=new], [name=confirm]')).toHaveCount(0);
  });
  await scenario('preferences recover from a real HTTP error using the retry control', async () => {
    await page.route('**/api/preferences', (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { code: 'INTERNAL_ERROR', message: 'Gangguan uji preferensi.' },
        }),
      }),
    );
    await page.goto(`${base}/hub/settings`);
    await expect(page.getByText('Gangguan uji preferensi.', { exact: true })).toBeVisible();
    await page.unroute('**/api/preferences');
    await page.getByRole('button', { name: 'Coba lagi', exact: true }).click();
    await expect(page.getByLabel('Masa simpan media')).toHaveValue('14');
    await expect(page.getByRole('button', { name: 'Simpan preferensi' })).toBeEnabled();
  });
  await scenario('consent gate and QR generation are not represented as Connected', async () => {
    await page.goto(`${base}/hub/connect`);
    await expect(page.getByRole('button', { name: 'Mulai penautan' })).toBeDisabled();
    await audit('connect-desktop');
    await page.getByRole('tab', { name: 'Kode penautan' }).click();
    await page.getByRole('checkbox').check();
    await expect(page.getByRole('button', { name: 'Mulai penautan' })).toBeDisabled();
    await page.getByLabel('Nomor WhatsApp Anda').fill('6281234567890');
    await expect(page.getByRole('button', { name: 'Mulai penautan' })).toBeEnabled();
    await page.getByRole('tab', { name: 'Pindai QR' }).click();
    await page.getByRole('button', { name: 'Mulai penautan' }).click();
    await expect(page.getByRole('heading', { name: 'Pindai dengan WhatsApp Anda.' })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByRole('heading', { name: 'WhatsApp terhubung.' })).toHaveCount(0);
    await expect(page.locator('.real-qr svg')).toBeVisible();
  });
  await scenario(
    'mock provider confirmation and SSE deliver actual persisted test events',
    async () => {
      const owner = await db.adminAccess.findUniqueOrThrow({
        where: { id: 'owner' },
        include: { user: { include: { whatsapp: true } } },
      });
      const user = owner.user;
      await db.command.create({
        data: { userId: user.id, generation: user.whatsapp.generation, kind: 'TEST_CONFIRM' },
      });
      await expect(page.getByRole('heading', { name: 'WhatsApp terhubung.' })).toBeVisible({
        timeout: 15000,
      });
      await page.getByRole('link', { name: 'Buka Status Center', exact: true }).click();
      await expect(page.locator('.media-card')).toHaveCount(2);
    },
  );
  await scenario('status search and photo/video filters are functional', async () => {
    await page.getByRole('button', { name: 'Video', exact: true }).click();
    await expect(page.locator('.media-card')).toHaveCount(1);
    await expect(page.locator('.media-card-info>b')).toHaveText('TEST FIXTURE VIDEO');
    await page.getByRole('button', { name: 'Semua media', exact: true }).click();
    await page.getByLabel('Cari nama kontak').fill('PHOTO');
    await expect(page.locator('.media-card')).toHaveCount(1);
    await page.getByLabel('Cari nama kontak').fill('');
    await expect(page.locator('.media-card')).toHaveCount(2);
  });
  await scenario(
    'photo preparation, library save, original-byte download and modal toast',
    async () => {
      await page.getByRole('button', { name: 'Pratinjau TEST FIXTURE PHOTO' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.getByRole('button', { name: 'Siapkan & simpan' }).click();
      await expect(page.locator('.full-preview img')).toBeVisible({ timeout: 15000 });
      await expect
        .poll(() => page.locator('.full-preview img').evaluate((e) => e.naturalWidth))
        .toBe(480);
      const downloaded = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Unduh file', exact: true }).click();
      const file = await downloaded;
      const content = await fs.readFile(await file.path());
      assert.ok(content.length > 100);
      assert.ok(file.suggestedFilename().endsWith('.jpg'));
      await expect(
        page.getByRole('dialog').getByText('File dikirim ke browser.', { exact: false }),
      ).toBeVisible();
      await page.getByRole('button', { name: 'Tutup dialog' }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
    },
  );
  await scenario('video decoding, playback controls and range seeking', async () => {
    await page.getByRole('button', { name: 'Pratinjau TEST FIXTURE VIDEO' }).click();
    await page.getByRole('button', { name: 'Siapkan & simpan' }).click();
    const video = page.locator('.full-preview video');
    await expect(video).toBeVisible({ timeout: 15000 });
    await expect.poll(() => video.evaluate((v) => v.readyState)).toBeGreaterThanOrEqual(2);
    await video.evaluate(async (v) => {
      await v.play();
    });
    await expect.poll(() => video.evaluate((v) => v.paused)).toBe(false);
    await video.evaluate((v) => {
      v.pause();
      v.currentTime = 1;
      v.muted = false;
    });
    await expect.poll(() => video.evaluate((v) => Math.round(v.currentTime))).toBe(1);
    assert.equal(await video.evaluate((v) => v.controls), true);
    await page.screenshot({ path: 'docs/screenshots/video-test-fixture.png', fullPage: true });
    await page.getByRole('button', { name: 'Tutup dialog' }).click();
  });
  await scenario('library grid/list, filename search, sort and confirmed delete', async () => {
    await page.goto(`${base}/hub/library`);
    await expect(page.locator('.media-card')).toHaveCount(2);
    await page.getByRole('button', { name: 'Tampilan daftar' }).click();
    await expect(page.locator('.media-grid')).toHaveClass(/list-view/);
    await page.getByLabel('Urutan media').selectOption('oldest');
    const photo = await db.media.findFirstOrThrow({ where: { kind: 'PHOTO' } });
    await page.getByLabel('Cari nama file').fill(photo.filename);
    await expect(page.locator('.media-card')).toHaveCount(1);
    await page.getByRole('button', { name: `Hapus ${photo.filename}` }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Batal', exact: true }).click();
    assert.equal(await db.media.count({ where: { id: photo.id } }), 1);
    await page.getByRole('button', { name: `Hapus ${photo.filename}` }).click();
    await page.getByRole('button', { name: 'Ya, hapus media' }).click();
    await expect.poll(() => db.media.count({ where: { id: photo.id } })).toBe(0);
    await page.getByLabel('Cari nama file').fill('');
    await expect(page.locator('.media-card')).toHaveCount(1);
  });
  await scenario('download history and activity reflect real test jobs', async () => {
    await page.goto(`${base}/hub/history`);
    await expect(page.locator('.history-row')).toHaveCount(2);
    await expect(page.locator('.job-state.completed')).toHaveCount(2);
    await page.goto(`${base}/hub/activity`);
    await expect(page.getByText('Media dihapus dari library', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Buka notifikasi' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
  await scenario('mobile menu, dialogs and narrow-screen routes have no overflow', async () => {
    for (const width of [360, 390]) {
      await page.setViewportSize({ width, height: 844 });
      for (const route of ['statuses', 'library', 'connect', 'settings', 'history']) {
        await page.goto(`${base}/hub/${route}`);
        await expect(page.locator('.hub-main h1')).toBeVisible();
        await noOverflow();
        if (width === 390) await audit(route + '-mobile');
      }
    }
    await page.getByRole('button', { name: 'Lainnya', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('dialog').getByRole('link', { name: 'Pengaturan', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button', { name: 'Bantuan & batasan' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await noOverflow();
    await page.keyboard.press('Escape');
  });
  await scenario('disconnect requires confirmation and clears local session', async () => {
    await page.goto(`${base}/hub/connect`);
    await page.getByRole('button', { name: 'Putuskan & hapus sesi lokal' }).click();
    await page.getByRole('button', { name: 'Putuskan & hapus sesi', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'QR Anda akan muncul di sini.' })).toBeVisible({
      timeout: 15000,
    });
  });
  await scenario('logout invalidates authentication and protects resource APIs', async () => {
    await page.getByRole('button', { name: 'Lainnya', exact: true }).click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /Keluar dari workspace/ })
      .click();
    await page.waitForURL(base + '/login');
    const response = await context.request.get(base + '/api/library');
    assert.equal(response.status(), 401);
    await audit('login-mobile');
  });
  assert.deepEqual(consoleErrors, []);
  await fs.writeFile(
    'docs/browser-result.json',
    JSON.stringify(
      {
        scenariosPassed: count,
        provider: 'isolated mock only; no real account',
        widths: [360, 390, 1440],
        consoleErrors,
        accessibility,
        at: new Date().toISOString(),
      },
      null,
      2,
    ) + '\n',
  );
  if (failures.length) {
    console.log(JSON.stringify(failures, null, 2));
    throw new Error(`${failures.length} pages have accessibility violations`);
  }
  console.log(
    `\n${count} browser scenarios passed; ${accessibility.length} accessibility audits clean.`,
  );
} finally {
  await browser.close();
  await db.$disconnect();
}
