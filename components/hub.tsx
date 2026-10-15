'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Bell,
  ChevronRight,
  CircleHelp,
  Clock3,
  FolderHeart,
  Grid2X2,
  Images,
  Link2,
  LogOut,
  Menu,
  MoreHorizontal,
  Radio,
  Settings2,
  ShieldCheck,
  X,
  Check,
  AlertCircle,
} from 'lucide-react';
import { Brand, Mark } from './brand';
import { Dialog } from './dialog';
import { ToastPortal } from './toast-portal';
import { HubContext, useResource } from './hub-context';
import { api } from '@/lib/client';
import { activityLabels, relative, stateLabels, type Dashboard } from '@/lib/ui-types';
import {
  DashboardView,
  CollectionView,
  ConnectView,
  HistoryView,
  ActivityView,
  SettingsView,
} from './hub-pages';
const nav = [
  { href: '/hub', label: 'Ringkasan', icon: Grid2X2 },
  { href: '/hub/statuses', label: 'Status Center', icon: Images },
  { href: '/hub/library', label: 'Media Library', icon: FolderHeart },
  { href: '/hub/history', label: 'Riwayat unduhan', icon: Clock3 },
  { href: '/hub/activity', label: 'Aktivitas', icon: Radio },
];
const settings = [
  { href: '/hub/connect', label: 'Koneksi WhatsApp', icon: Link2 },
  { href: '/hub/settings', label: 'Pengaturan', icon: Settings2 },
];
const titles: Record<string, [string, string]> = {
  '/hub': ['Ruang untuk momen Anda.', 'Kelola koneksi, status, dan koleksi dalam satu tempat.'],
  '/hub/statuses': ['Status Center', 'Momen yang tersedia dari sesi WhatsApp Anda.'],
  '/hub/library': ['Media Library', 'Momen pilihan, tersimpan dengan rapi.'],
  '/hub/history': ['Riwayat unduhan', 'Pantau setiap proses pengambilan media.'],
  '/hub/activity': ['Aktivitas workspace', 'Jejak aktivitas, tanpa isi pesan atau kredensial.'],
  '/hub/connect': ['Koneksi WhatsApp', 'Satu langkah lebih dekat dengan momen Anda.'],
  '/hub/settings': ['Pengaturan', 'Workspace yang mengikuti preferensi Anda.'],
};
export function Hub() {
  const path = usePathname(),
    router = useRouter();
  const [auth, setAuth] = useState<{ user: { name: string; email: string }; csrf: string } | null>(
      null,
    ),
    [authError, setAuthError] = useState('');
  const [version, setVersion] = useState(0),
    [notice, setNotice] = useState<{ message: string; error: boolean } | null>(null),
    [menu, setMenu] = useState(false),
    [notificationsOpen, setNotificationsOpen] = useState(false),
    [help, setHelp] = useState(false),
    [live, setLive] = useState(false),
    [notifications, setNotifications] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    firstEvent = useRef(true),
    lastActivity = useRef('');
  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  const toast = useCallback((message: string, error = false) => {
    setNotice({ message, error });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setNotice(null), 6000);
  }, []);
  useEffect(() => {
    api<{ user: { name: string; email: string }; csrf: string }>('auth/me')
      .then(setAuth)
      .catch((e) => {
        if (e.code === 'UNAUTHENTICATED') router.replace('/login');
        else setAuthError(e.message);
      });
  }, [router]);
  useEffect(() => {
    if (!auth) return;
    api<{ notifications: boolean }>('preferences')
      .then((p) => setNotifications(p.notifications))
      .catch(() => {});
  }, [auth]);
  useEffect(() => {
    if (!auth) return;
    const events = new EventSource('/api/events');
    events.onopen = () => setLive(true);
    events.onerror = () => setLive(false);
    events.addEventListener('update', (e) => {
      const value = JSON.parse((e as MessageEvent).data) as {
        activity?: { id: string; kind: string; createdAt: string };
      };
      if (
        !firstEvent.current &&
        notifications &&
        value.activity &&
        value.activity.id !== lastActivity.current &&
        Date.now() - new Date(value.activity.createdAt).getTime() < 30000
      )
        toast(
          activityLabels[value.activity.kind] ?? 'Workspace diperbarui',
          value.activity.kind.endsWith('FAILED') || value.activity.kind === 'CONNECTION_ERROR',
        );
      firstEvent.current = false;
      lastActivity.current = value.activity?.id ?? '';
      refresh();
    });
    const interval = setInterval(() => {
      if (!document.hidden) refresh();
    }, 15000);
    return () => {
      events.close();
      clearInterval(interval);
    };
  }, [auth, notifications, refresh, toast]);
  useEffect(() => {
    setMenu(false);
    setNotificationsOpen(false);
    window.scrollTo(0, 0);
  }, [path]);
  async function logout() {
    try {
      await api('auth/logout', { method: 'POST', csrf: auth?.csrf });
      router.replace('/login');
    } catch (e) {
      toast((e as Error).message, true);
    }
  }
  if (!auth)
    return (
      <main id="main" className="page-loading">
        <Mark />
        {authError ? (
          <>
            <p role="alert">{authError}</p>
            <button className="btn btn-dark" onClick={() => window.location.reload()}>
              Coba lagi
            </button>
          </>
        ) : (
          <>
            <span className="spinner" />
            <p>Menyiapkan workspace pribadi Anda…</p>
          </>
        )}
      </main>
    );
  return (
    <LoadedShell
      current={auth}
      version={version}
      refresh={refresh}
      toast={toast}
      notifications={notifications}
      setNotifications={setNotifications}
      path={path}
      menu={menu}
      setMenu={setMenu}
      notificationsOpen={notificationsOpen}
      setNotificationsOpen={setNotificationsOpen}
      help={help}
      setHelp={setHelp}
      live={live}
      notice={notice}
      setNotice={setNotice}
      logout={logout}
    />
  );
}
type ShellProps = {
  current: { user: { name: string; email: string }; csrf: string };
  version: number;
  refresh: () => void;
  toast: (message: string, error?: boolean) => void;
  notifications: boolean;
  setNotifications: (value: boolean) => void;
  path: string;
  menu: boolean;
  setMenu: (v: boolean) => void;
  notificationsOpen: boolean;
  setNotificationsOpen: (v: boolean) => void;
  help: boolean;
  setHelp: (v: boolean) => void;
  live: boolean;
  notice: { message: string; error: boolean } | null;
  setNotice: (v: null) => void;
  logout: () => Promise<void>;
};
function LoadedShell(p: ShellProps) {
  const { data, error } = useResource<Dashboard>('dashboard', p.version);
  const [title, subtitle] = titles[p.path] ?? [
    'Halaman tidak ditemukan',
    'Kembali ke ringkasan workspace.',
  ];
  const link = (item: (typeof nav)[number]) => (
    <Link
      key={item.href}
      href={item.href}
      className={`nav-item ${p.path === item.href ? 'active' : ''}`}
      aria-current={p.path === item.href ? 'page' : undefined}
    >
      <item.icon size={19} />
      {item.label}
      {p.path === item.href && <span className="nav-active-dot" />}
    </Link>
  );
  const sideContent = (
    <>
      <div className="sidebar-brand">
        <Brand />
      </div>
      <div className="workspace-label">
        <span className="workspace-icon">P</span>
        <div>
          Personal workspace<small>Hanya untuk Anda</small>
        </div>
        <ShieldCheck size={15} />
      </div>
      <p className="nav-caption">WORKSPACE</p>
      <nav aria-label="Workspace">{nav.map(link)}</nav>
      <p className="nav-caption">PREFERENSI</p>
      <nav aria-label="Preferensi">{settings.map(link)}</nav>
      <div className="sidebar-bottom">
        <div className="privacy-note">
          <ShieldCheck size={19} />
          <b>Privasi, bukan opsi.</b>
          <p>Simpan hanya media yang Anda miliki atau boleh Anda simpan.</p>
          <button className="text-link" onClick={() => p.setHelp(true)}>
            Tentang integrasi <ArrowUpRight size={15} />
          </button>
        </div>
        <button className="profile" onClick={p.logout} title="Keluar dari workspace">
          <span className="avatar">{p.current.user.name.slice(0, 1).toUpperCase()}</span>
          <span>
            <b>{p.current.user.name}</b>
            <small>Keluar dari workspace</small>
          </span>
          <LogOut size={17} />
        </button>
      </div>
    </>
  );
  return (
    <HubContext
      value={{
        ...p.current,
        refresh: p.refresh,
        version: p.version,
        toast: p.toast,
        dashboard: data,
        notifications: p.notifications,
        setNotifications: p.setNotifications,
      }}
    >
      <div className="hub-layout">
        <aside className="sidebar">{sideContent}</aside>
        <div className="hub-body">
          <header className="hub-topbar">
            <div className="mobile-brand">
              <button className="icon-btn" onClick={() => p.setMenu(true)} aria-label="Buka menu">
                <Menu size={21} />
              </button>
              <Mark small />
            </div>
            <div className="breadcrumb">
              Workspace <ChevronRight size={14} />
              <span>
                {nav.concat(settings).find((n) => n.href === p.path)?.label ?? 'Ringkasan'}
              </span>
            </div>
            <div className="topbar-actions">
              <span className={`live-label ${p.live ? 'is-live' : ''}`}>
                <span className="tiny-dot" />
                {p.live ? 'Live updates' : 'Polling aktif'}
              </span>
              <button
                className="icon-btn"
                aria-label="Buka notifikasi"
                onClick={() => p.setNotificationsOpen(true)}
              >
                <Bell size={19} />
              </button>
              <span className="topbar-avatar">{p.current.user.name.slice(0, 1).toUpperCase()}</span>
            </div>
          </header>
          <main id="main" className="hub-main">
            <div className="page-heading">
              <div>
                <span className="eyebrow">
                  {p.path === '/hub'
                    ? `HALO, ${p.current.user.name.toUpperCase()}`
                    : 'PERSONAL WORKSPACE'}
                </span>
                <h1>{title}</h1>
                <p>{subtitle}</p>
              </div>
              <Link
                href="/hub/connect"
                className={`connection-badge ${data?.session.state === 'CONNECTED' ? 'connected' : ''}`}
              >
                <span className="tiny-dot" />
                {data ? (stateLabels[data.session.state] ?? data.session.state) : 'Memuat sesi…'}
                <ChevronRight size={14} />
              </Link>
            </div>
            {error && (
              <div className="error-box" role="alert">
                {error}
                <button onClick={p.refresh}>Coba lagi</button>
              </div>
            )}
            {p.path === '/hub' ? (
              <DashboardView />
            ) : p.path === '/hub/statuses' ? (
              <CollectionView key="statuses" type="statuses" />
            ) : p.path === '/hub/library' ? (
              <CollectionView key="library" type="library" />
            ) : p.path === '/hub/connect' ? (
              <ConnectView />
            ) : p.path === '/hub/history' ? (
              <HistoryView />
            ) : p.path === '/hub/activity' ? (
              <ActivityView />
            ) : p.path === '/hub/settings' ? (
              <SettingsView />
            ) : (
              <Link href="/hub" className="btn btn-dark">
                Kembali ke ringkasan
              </Link>
            )}
            <footer className="hub-footer">
              <span>
                <ShieldCheck size={14} />
                Personal by design.
              </span>
              <span>
                IM Status Hub <span className="footer-dot">·</span> v1.2
              </span>
              <button onClick={() => p.setHelp(true)}>
                <CircleHelp size={14} />
                Bantuan & batasan
              </button>
            </footer>
          </main>
        </div>
        <nav className="mobile-bottom" aria-label="Navigasi seluler">
          {[
            { href: '/hub', label: 'Beranda', icon: Grid2X2 },
            { href: '/hub/statuses', label: 'Status', icon: Images },
            { href: '/hub/library', label: 'Library', icon: FolderHeart },
            { href: '/hub/connect', label: 'Koneksi', icon: Link2 },
          ].map((n) => (
            <Link key={n.href} href={n.href} className={p.path === n.href ? 'active' : ''}>
              <n.icon size={20} />
              <span>{n.label}</span>
            </Link>
          ))}
          <button onClick={() => p.setMenu(true)}>
            <MoreHorizontal size={21} />
            <span>Lainnya</span>
          </button>
        </nav>
      </div>
      {p.menu && (
        <Dialog title="Workspace Anda" onClose={() => p.setMenu(false)}>
          <div className="mobile-menu">{sideContent}</div>
        </Dialog>
      )}
      {p.notificationsOpen && (
        <Dialog title="Notifikasi" onClose={() => p.setNotificationsOpen(false)}>
          <div className="dialog-body">
            {data?.activity.length ? (
              <div className="activity-list">
                {data.activity.map((a) => (
                  <div className="activity-row" key={a.id}>
                    <span className="activity-icon">
                      <Radio size={16} />
                    </span>
                    <div>
                      <b>{activityLabels[a.kind] ?? 'Workspace diperbarui'}</b>
                      <small>{relative(a.createdAt)}</small>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="small-empty">
                <Bell size={30} />
                <h3>Belum ada notifikasi</h3>
                <p>Koneksi dan aktivitas unduhan akan muncul di sini.</p>
              </div>
            )}
            <Link
              href="/hub/activity"
              className="btn btn-light full"
              onClick={() => p.setNotificationsOpen(false)}
            >
              Lihat semua aktivitas <ChevronRight size={16} />
            </Link>
          </div>
        </Dialog>
      )}
      {p.help && (
        <Dialog title="Transparansi & bantuan" onClose={() => p.setHelp(false)}>
          <div className="dialog-body help-content">
            <span className="tag">Integrasi tidak resmi</span>
            <h3>Hanya yang benar-benar tersedia.</h3>
            <p>
              Baileys menghubungkan perangkat melalui WhatsApp Web. Meta Cloud API tidak menyediakan
              akses umum ke Status teman. Aplikasi ini tidak dapat melewati privasi kontak,
              mengambil seluruh riwayat, atau menjamin semua Status akan diterima.
            </p>
            <h3>Jika status belum muncul</h3>
            <ol>
              <li>Periksa bahwa worker aktif dan WhatsApp benar-benar terhubung.</li>
              <li>
                Tunggu event Status baru yang memang tersedia bagi akun Anda. Refresh hanya memuat
                ulang daftar server.
              </li>
              <li>
                Media lama dapat kedaluwarsa. Jika koneksi bermasalah, putuskan sesi lalu tautkan
                ulang.
              </li>
            </ol>
            <h3>Kendali tetap di tangan Anda</h3>
            <p>
              Jangan bagikan QR, kode penautan, atau OTP kepada operator. Integrasi tidak resmi bisa
              berubah atau memicu pembatasan akun. Untuk mencabut perangkat sepenuhnya, buka
              WhatsApp → Perangkat tertaut dan keluarkan perangkat ini.
            </p>
            <p>
              Pratinjau penuh mengambil dan menyimpan salinan media di library. Unduhan “selesai”
              berarti bytes tersimpan di server; penyimpanan ke ponsel ditangani browser.
            </p>
          </div>
        </Dialog>
      )}
      <ToastPortal>
        <div className="toast-region" aria-live="polite" aria-atomic="true">
          {p.notice && (
            <div className={`toast ${p.notice.error ? 'toast-error' : ''}`}>
              {p.notice.error ? <AlertCircle size={20} /> : <Check size={20} />}
              <span>{p.notice.message}</span>
              <button onClick={() => p.setNotice(null)} aria-label="Tutup pemberitahuan">
                <X size={17} />
              </button>
            </div>
          )}
        </div>
      </ToastPortal>
    </HubContext>
  );
}
