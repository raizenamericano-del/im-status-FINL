'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  FileImage,
  Film,
  FolderHeart,
  Grid2X2,
  HardDrive,
  Image as ImageIcon,
  Info,
  Link2,
  List,
  LoaderCircle,
  LockKeyhole,
  Pause,
  QrCode,
  Radio,
  RefreshCw,
  Search,
  ShieldCheck,
  Smartphone,
  Trash2,
  Unplug,
  AlertTriangle,
  X,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '@/lib/client';
import {
  activityLabels,
  bytes,
  date,
  relative,
  stateLabels,
  type Activity,
  type Job,
  type Media,
  type PageData,
  type Session,
  type Status,
} from '@/lib/ui-types';
import { errorMessage } from '@/lib/security/errors';
import { useHub, useResource } from './hub-context';
import { Dialog } from './dialog';
import { EmptyArt } from './illustrations';
const jobLabels: Record<string, string> = {
  WAITING: 'Menunggu',
  PROCESSING: 'Memproses',
  COMPLETED: 'Selesai',
  FAILED: 'Gagal',
};
function Failure({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div className="error-box" role="alert">
      <AlertTriangle size={18} />
      <span>{message}</span>
      <button onClick={retry}>Coba lagi</button>
    </div>
  );
}
function Loading() {
  return (
    <div className="skeleton-grid" aria-label="Memuat data" role="status">
      {[1, 2, 3].map((n) => (
        <div key={n} className="skeleton" />
      ))}
      <span className="sr-only">Memuat data…</span>
    </div>
  );
}
function Pager({
  page,
  pages,
  setPage,
  total,
}: {
  page: number;
  pages: number;
  setPage: (p: number) => void;
  total: number;
}) {
  return total > 0 ? (
    <div className="pagination">
      <span>
        {total} item · Halaman {page} dari {Math.max(1, pages)}
      </span>
      <div>
        <button
          className="icon-btn"
          aria-label="Halaman sebelumnya"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
        >
          <ChevronLeft size={18} />
        </button>
        <button
          className="icon-btn"
          aria-label="Halaman berikutnya"
          disabled={page >= pages}
          onClick={() => setPage(page + 1)}
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  ) : null;
}
function MediaThumb({ src, video, alt }: { src: string; video: boolean; alt: string }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  return failedSrc === src ? (
    <div className="thumb-fallback">
      {video ? <Film size={35} /> : <ImageIcon size={35} />}
      <span>Pratinjau belum tersedia</span>
    </div>
  ) : video ? (
    <video
      src={src}
      preload="metadata"
      muted
      playsInline
      aria-label={alt}
      onError={() => setFailedSrc(src)}
    />
  ) : (
    <img src={src} alt={alt} loading="lazy" onError={() => setFailedSrc(src)} />
  );
}
export function DashboardView() {
  const { dashboard: d } = useHub();
  const [preview, setPreview] = useState<string | null>(null);
  if (!d) return <Loading />;
  const connected = d.session.state === 'CONNECTED';
  return (
    <>
      <section className="stats-grid" aria-label="Ringkasan workspace">
        {[
          {
            label: 'Status tersedia',
            value: d.counts.available,
            icon: Radio,
            sub: `${d.counts.photos} foto · ${d.counts.videos} video`,
          },
          {
            label: 'Media tersimpan',
            value: d.counts.saved,
            icon: FolderHeart,
            sub: 'Di library pribadi Anda',
          },
          {
            label: 'Unduhan selesai',
            value: d.counts.completed,
            icon: ArrowDownToLine,
            sub: 'Bytes berhasil tersimpan',
          },
          {
            label: 'Penyimpanan',
            value: bytes(d.counts.bytes),
            icon: HardDrive,
            sub: 'Dari kapasitas 512 MB',
          },
        ].map((s, i) => (
          <article key={s.label} className={`stat-card stat-${i}`}>
            <div>
              <span>{s.label}</span>
              <s.icon size={18} />
            </div>
            <strong>{s.value}</strong>
            <small>{s.sub}</small>
            {i === 3 && (
              <div className="storage-meter">
                <span
                  style={{
                    width: `${Math.min(100, (d.counts.bytes / (512 * 1024 * 1024)) * 100)}%`,
                  }}
                />
              </div>
            )}
          </article>
        ))}
      </section>
      <section className="connect-banner">
        <div>
          <span className="eyebrow">
            <span className="tiny-dot" />
            {connected ? 'SESI WHATSAPP AKTIF' : 'MULAI DARI SINI'}
          </span>
          <h2>
            {connected ? (
              <>
                Siap menerima
                <br />
                momen berikutnya.
              </>
            ) : (
              <>
                Status Anda,
                <br />
                selangkah lebih dekat.
              </>
            )}
          </h2>
          <p>
            {connected
              ? 'Status foto dan video yang benar-benar diterima akan muncul otomatis di Status Center.'
              : 'Tautkan WhatsApp milik Anda. Terima status yang tersedia, lalu simpan momen pilihan ke library.'}
          </p>
          <Link href={connected ? '/hub/statuses' : '/hub/connect'} className="btn btn-lime">
            {connected ? 'Jelajahi Status Center' : 'Hubungkan WhatsApp'}
            <ArrowUpRight size={18} />
          </Link>
        </div>
        <div className="banner-art" aria-hidden="true">
          <div className="banner-orbit" />
          <div className="banner-orbit second" />
          <div className="banner-device">
            <span />
            <Link2 size={42} />
            <i />
            <i />
          </div>
          <span className="banner-shield">
            <ShieldCheck size={22} />
          </span>
          <div className="banner-caption">
            YOUR ACCOUNT.
            <br />
            YOUR LITTLE MOMENTS.
          </div>
        </div>
      </section>
      <div className="dashboard-grid">
        <section className="panel recent-panel">
          <div className="panel-heading">
            <div>
              <h2>
                Baru disimpan <span className="count-badge">{d.counts.saved}</span>
              </h2>
              <p>Koleksi kecil untuk momen yang berarti.</p>
            </div>
            <Link href="/hub/library" className="text-link">
              Lihat library <ArrowUpRight size={16} />
            </Link>
          </div>
          {d.recent.length ? (
            <div className="recent-grid">
              {d.recent.map((m) => (
                <button key={m.id} className="recent-card" onClick={() => setPreview(m.id)}>
                  <div className="recent-thumb">
                    <MediaThumb
                      src={`/api/media/${m.id}/file`}
                      video={m.kind === 'VIDEO'}
                      alt={`Media dari ${m.contactName}`}
                    />
                  </div>
                  <b>{m.contactName}</b>
                  <small>
                    {bytes(m.bytes)} · {relative(m.createdAt)}
                  </small>
                </button>
              ))}
            </div>
          ) : (
            <div className="empty-state compact">
              <EmptyArt type="library" />
              <h3>Library Anda masih lapang.</h3>
              <p>
                Media yang Anda simpan akan mendapat
                <br />
                tempatnya di sini.
              </p>
              <Link href="/hub/statuses" className="text-link">
                Ke Status Center <ArrowRight size={16} />
              </Link>
            </div>
          )}
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Aktivitas terbaru</h2>
              <p>Yang terjadi di workspace Anda.</p>
            </div>
            <Radio size={18} />
          </div>
          {d.activity.length ? (
            <div className="activity-list">
              {d.activity.map((a) => (
                <ActivityRow key={a.id} item={a} />
              ))}
            </div>
          ) : (
            <div className="small-empty">
              <Clock3 size={30} />
              <h3>Awal yang baru.</h3>
              <p>
                Aktivitas koneksi dan unduhan
                <br />
                akan tercatat di sini.
              </p>
            </div>
          )}
          <Link href="/hub/activity" className="panel-footer-link">
            Semua aktivitas <ArrowUpRight size={16} />
          </Link>
        </section>
      </div>
      <section className="getting-started">
        <div>
          <span className="step-complete">
            <Check size={16} />
          </span>
          <span>
            <b>Workspace dibuat</b>
            <small>Ruang pribadi Anda siap.</small>
          </span>
        </div>
        <ChevronRight size={17} />
        <div>
          <span className={connected ? 'step-complete' : 'step-number'}>
            {connected ? <Check size={16} /> : '2'}
          </span>
          <span>
            <b>Tautkan WhatsApp</b>
            <small>Pemilik akun menyelesaikan penautan.</small>
          </span>
        </div>
        <ChevronRight size={17} />
        <div>
          <span className={d.counts.saved ? 'step-complete' : 'step-number'}>
            {d.counts.saved ? <Check size={16} /> : '3'}
          </span>
          <span>
            <b>Simpan momen pertama</b>
            <small>Pilih media yang boleh Anda simpan.</small>
          </span>
        </div>
      </section>
      {!d.session.worker.online && (
        <div className="notice-box">
          <Info size={18} />
          <span>
            Worker belum aktif. Workspace tetap dapat dibuka, tetapi koneksi dan pengambilan media
            memerlukan worker.
          </span>
        </div>
      )}
      {preview && <Preview mediaId={preview} onClose={() => setPreview(null)} />}
    </>
  );
}
export function CollectionView({ type }: { type: 'statuses' | 'library' }) {
  const h = useHub(),
    library = type === 'library';
  const [q, setQ] = useState(''),
    [search, setSearch] = useState(''),
    [filter, setFilter] = useState('all'),
    [page, setPage] = useState(1),
    [sort, setSort] = useState('newest'),
    [list, setList] = useState(false),
    [preview, setPreview] = useState<{ mediaId?: string; statusId?: string } | null>(null),
    [deleting, setDeleting] = useState<Media | null>(null),
    [busy, setBusy] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(q);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [q]);
  const { data, loading, error } = useResource<PageData<Status | Media>>(
    `${type}?q=${encodeURIComponent(search)}&filter=${filter}&page=${page}&sort=${sort}`,
    h.version,
  );
  async function save(id: string) {
    setBusy(id);
    try {
      const result = await api<{ mediaId?: string }>(`statuses/${id}/download`, {
        method: 'POST',
        csrf: h.csrf,
      });
      h.toast(
        result.mediaId
          ? 'Media ini sudah tersedia di library.'
          : 'Media masuk antrean. Pantau prosesnya di Riwayat unduhan.',
      );
      h.refresh();
    } catch (e) {
      h.toast((e as Error).message, true);
    } finally {
      setBusy('');
    }
  }
  async function remove() {
    if (!deleting) return;
    setBusy(deleting.id);
    try {
      await api(`media/${deleting.id}`, { method: 'DELETE', csrf: h.csrf });
      setDeleting(null);
      h.refresh();
      h.toast('Penghapusan dijadwalkan. Worker akan menghapus file permanen.');
    } catch (e) {
      h.toast((e as Error).message, true);
    } finally {
      setBusy('');
    }
  }
  return (
    <>
      <div className="collection-toolbar">
        <label className="search-input">
          <Search size={18} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={library ? 'Cari nama file…' : 'Cari nama kontak…'}
            aria-label={library ? 'Cari nama file' : 'Cari nama kontak'}
          />
          {q && (
            <button className="icon-btn" onClick={() => setQ('')} aria-label="Hapus pencarian">
              <X size={15} />
            </button>
          )}
        </label>
        <div className="toolbar-buttons">
          {library && (
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setPage(1);
              }}
              aria-label="Urutan media"
            >
              <option value="newest">Terbaru</option>
              <option value="oldest">Terlama</option>
            </select>
          )}
          <div className="view-switch">
            <button aria-label="Tampilan grid" aria-pressed={!list} onClick={() => setList(false)}>
              <Grid2X2 size={17} />
            </button>
            <button aria-label="Tampilan daftar" aria-pressed={list} onClick={() => setList(true)}>
              <List size={18} />
            </button>
          </div>
          <button
            className="btn btn-light refresh-button"
            onClick={h.refresh}
            title="Muat ulang daftar server; bukan meminta semua Status WhatsApp"
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>
      <div className="filter-row">
        <div className="filter-chips" aria-label="Filter media">
          {[
            { value: 'all', label: 'Semua media' },
            { value: 'photo', label: 'Foto', icon: ImageIcon },
            { value: 'video', label: 'Video', icon: Film },
            ...(!library
              ? [
                  { value: 'unsaved', label: 'Belum disimpan' },
                  { value: 'saved', label: 'Tersimpan' },
                ]
              : []),
          ].map((f) => (
            <button
              key={f.value}
              className={filter === f.value ? 'selected' : ''}
              aria-pressed={filter === f.value}
              onClick={() => {
                setFilter(f.value);
                setPage(1);
              }}
            >
              {f.icon && <f.icon size={15} />} {f.label}
            </button>
          ))}
        </div>
        <span className="result-count">{data ? `${data.total} media` : 'Memuat…'}</span>
      </div>
      {!library && (
        <div className="subtle-notice">
          <Info size={15} />
          Hanya status yang diterima sesi Anda. Refresh tidak mengambil riwayat lama.
        </div>
      )}
      {error && <Failure message={error} retry={h.refresh} />}
      <section
        className={`panel collection-panel ${data?.items.length ? 'has-items' : ''}`}
        aria-label={library ? 'Daftar library' : 'Daftar status'}
      >
        {!data && loading ? (
          <Loading />
        ) : data?.items.length ? (
          <div className={`media-grid ${list ? 'list-view' : ''}`}>
            {data.items.map((item) => {
              const media = library ? (item as Media) : null,
                status = !library ? (item as Status) : null,
                mediaId =
                  media?.id ?? (status?.media?.deleteRequestedAt ? undefined : status?.media?.id),
                job = status?.jobs?.[0],
                activeJob = job && ['WAITING', 'PROCESSING'].includes(job.state);
              return (
                <article className="media-card" key={item.id}>
                  <button
                    className="media-thumb"
                    onClick={() => setPreview(mediaId ? { mediaId } : { statusId: item.id })}
                    aria-label={`Pratinjau ${item.contactName}`}
                  >
                    <MediaThumb
                      src={
                        mediaId
                          ? `/api/media/${mediaId}/file`
                          : `/api/statuses/${item.id}/thumbnail`
                      }
                      video={!!mediaId && item.kind === 'VIDEO'}
                      alt={`Media dari ${item.contactName}`}
                    />
                    <span className="media-kind">
                      {item.kind === 'VIDEO' ? <Film size={13} /> : <ImageIcon size={13} />}{' '}
                      {item.kind === 'VIDEO'
                        ? item.duration != null
                          ? `${item.duration} dtk`
                          : 'Video'
                        : 'Foto'}
                    </span>
                    {mediaId && (
                      <span className="saved-mark">
                        <Check size={13} />
                      </span>
                    )}
                    <span className="preview-hover">
                      <Eye size={24} />
                    </span>
                  </button>
                  <div className="media-card-info">
                    <b>{item.contactName}</b>
                    <p title={media?.filename}>
                      {media ? media.filename : relative(status!.postedAt)}
                    </p>
                    <small>
                      {media
                        ? bytes(media.bytes)
                        : `Aktif hingga ${new Date(status!.expiresAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`}
                    </small>
                  </div>
                  <div className="media-card-actions">
                    {mediaId ? (
                      <button
                        className="btn btn-light"
                        onClick={() => downloadFile(mediaId, h.toast)}
                      >
                        <ArrowDownToLine size={15} />
                        Unduh
                      </button>
                    ) : (
                      <button
                        className="btn btn-light"
                        disabled={busy === item.id || !!activeJob}
                        onClick={() => save(item.id)}
                      >
                        {activeJob ? (
                          <LoaderCircle className="spin" size={15} />
                        ) : (
                          <FolderHeart size={15} />
                        )}{' '}
                        {activeJob
                          ? jobLabels[job.state]
                          : job?.state === 'FAILED'
                            ? 'Coba lagi'
                            : 'Simpan'}
                      </button>
                    )}
                    {media && (
                      <button
                        className="icon-btn danger"
                        onClick={() => setDeleting(media)}
                        aria-label={`Hapus ${media.filename}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          !error && (
            <div className="empty-state">
              <EmptyArt type={library ? 'library' : 'status'} />
              <span className="eyebrow">
                {search || filter !== 'all' ? 'BELUM ADA YANG COCOK' : 'SETIAP KOLEKSI PUNYA AWAL'}
              </span>
              <h2>
                {search || filter !== 'all'
                  ? 'Tidak ada media yang cocok.'
                  : library
                    ? 'Momen pilihan Anda, di sini.'
                    : 'Menunggu momen pertama.'}
              </h2>
              <p>
                {search || filter !== 'all'
                  ? 'Coba kata kunci lain atau tampilkan semua media.'
                  : library
                    ? 'Foto dan video yang berhasil Anda simpan akan muncul di library. Pilih momen pertama dari Status Center.'
                    : 'Status baru akan muncul saat diterima oleh sesi WhatsApp yang terhubung. Riwayat lama tidak disinkronkan.'}
              </p>
              {search || filter !== 'all' ? (
                <button
                  className="btn btn-light"
                  onClick={() => {
                    setQ('');
                    setFilter('all');
                    setPage(1);
                  }}
                >
                  Reset filter <RefreshCw size={16} />
                </button>
              ) : (
                <Link href={library ? '/hub/statuses' : '/hub/connect'} className="btn btn-dark">
                  {library ? 'Buka Status Center' : 'Periksa koneksi'}
                  <ArrowUpRight size={17} />
                </Link>
              )}
              <span className="empty-footnote">
                <ShieldCheck size={14} />
                Simpan hanya media yang Anda miliki izin untuk menyimpan.
              </span>
            </div>
          )
        )}
      </section>
      {data && <Pager page={page} pages={data.pages} setPage={setPage} total={data.total} />}
      <div className="notice-box">
        {library ? <HardDrive size={18} /> : <Clock3 size={18} />}
        <span>
          {library
            ? 'File disimpan oleh worker pada volume persisten. Atur masa simpan otomatis di Pengaturan.'
            : 'Status mengikuti masa aktif provider. Media yang sudah disimpan tetap di library hingga dihapus atau masa simpannya berakhir.'}
        </span>
      </div>
      {preview && <Preview {...preview} onClose={() => setPreview(null)} />}{' '}
      {deleting && (
        <Dialog title="Hapus media ini?" onClose={() => !busy && setDeleting(null)}>
          <div className="dialog-body">
            <div className="delete-illustration">
              <Trash2 size={26} />
            </div>
            <h3>Salinan di library akan dihapus.</h3>
            <p className="muted">{deleting.filename}</p>
            <p>
              File akan dihapus permanen oleh worker. Ini tidak menghapus Status asli di WhatsApp.
              Pengambilan ulang hanya mungkin jika sumber masih tersedia.
            </p>
            <div className="dialog-actions">
              <button className="btn btn-light" onClick={() => setDeleting(null)} disabled={!!busy}>
                Batal
              </button>
              <button className="btn btn-danger" onClick={remove} disabled={!!busy}>
                {busy ? 'Memproses…' : 'Ya, hapus media'}
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </>
  );
}
async function downloadFile(id: string, toast: (message: string, error?: boolean) => void) {
  try {
    const response = await fetch(`/api/media/${id}/file?download=1`);
    if (!response.ok) {
      const value = await response.json();
      throw new Error(value.error?.message ?? 'Media tidak tersedia.');
    }
    const blob = await response.blob(),
      url = URL.createObjectURL(blob),
      anchor = document.createElement('a');
    anchor.href = url;
    anchor.download =
      response.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1] ??
      'status-media';
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    toast('File dikirim ke browser. Lokasi penyimpanan mengikuti pengaturan perangkat.');
  } catch (e) {
    toast((e as Error).message, true);
  }
}
function Preview({
  mediaId,
  statusId,
  onClose,
}: {
  mediaId?: string;
  statusId?: string;
  onClose: () => void;
}) {
  const h = useHub(),
    [busy, setBusy] = useState(false),
    [playError, setPlayError] = useState(false);
  type Detail = Omit<Status, 'media'> & { media: Media | null };
  const { data, error, loading } = useResource<Media | Detail>(
    mediaId ? `media/${mediaId}` : `statuses/${statusId}`,
    h.version,
  );
  const status = mediaId ? null : (data as Detail | null),
    media = mediaId
      ? (data as Media | null)
      : status?.media && !status.media.deleteRequestedAt
        ? status.media
        : null,
    job = status?.jobs?.[0];
  async function prepare() {
    setBusy(true);
    try {
      await api(`statuses/${statusId}/download`, { method: 'POST', csrf: h.csrf });
      h.toast('Pratinjau sedang disiapkan. Media akan disimpan ke library.');
      h.refresh();
    } catch (e) {
      h.toast((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog title="Pratinjau media" onClose={onClose} wide>
      <div className="preview-body">
        {error && <Failure message={error} retry={h.refresh} />}{' '}
        {!data && loading ? (
          <Loading />
        ) : media ? (
          <>
            <div className="full-preview">
              {media.kind === 'VIDEO' ? (
                <video
                  src={`/api/media/${media.id}/file`}
                  controls
                  muted
                  playsInline
                  preload="metadata"
                  onError={() => setPlayError(true)}
                />
              ) : (
                <img
                  src={`/api/media/${media.id}/file`}
                  alt={`Media dari ${media.contactName}`}
                  onError={() => setPlayError(true)}
                />
              )}
            </div>
            {playError && (
              <Failure
                message="Media tidak dapat dipratinjau. Periksa worker atau unduh file untuk membukanya di perangkat."
                retry={() => {
                  setPlayError(false);
                  h.refresh();
                }}
              />
            )}
            <div className="preview-meta">
              <div>
                <h3>{media.contactName}</h3>
                <p>
                  {bytes(media.bytes)} · {media.mime}
                  {media.duration != null ? ` · ${media.duration} detik` : ''}
                </p>
                <small>{media.filename}</small>
              </div>
              <button className="btn btn-dark" onClick={() => downloadFile(media.id, h.toast)}>
                <ArrowDownToLine size={17} />
                Unduh file
              </button>
            </div>
          </>
        ) : (
          status && (
            <>
              <div className="prepare-preview">
                <EmptyArt />
                <h3>{status.contactName}</h3>
                <p>
                  Pratinjau penuh mengambil media asli yang tersedia dan menyimpan salinannya ke
                  library pribadi Anda.
                </p>
                {job?.state === 'FAILED' && (
                  <div className="error-box">
                    {errorMessage(job.errorCode ?? 'MEDIA_UNAVAILABLE')}
                  </div>
                )}
                <button
                  className="btn btn-dark"
                  onClick={prepare}
                  disabled={busy || job?.state === 'WAITING' || job?.state === 'PROCESSING'}
                >
                  {busy || job?.state === 'WAITING' || job?.state === 'PROCESSING' ? (
                    <>
                      <LoaderCircle size={17} className="spin" />
                      Menyiapkan media…
                    </>
                  ) : (
                    <>
                      <Eye size={17} />
                      Siapkan & simpan
                    </>
                  )}
                </button>
                <small>
                  Dengan melanjutkan, Anda memastikan memiliki izin menyimpan media ini.
                </small>
              </div>
            </>
          )
        )}
      </div>
    </Dialog>
  );
}
export function ConnectView() {
  const h = useHub(),
    { data: s, error } = useResource<Session>('wa/session', h.version);
  const [method, setMethod] = useState<'qr' | 'code'>('qr'),
    [consent, setConsent] = useState(false),
    [phone, setPhone] = useState(''),
    [busy, setBusy] = useState(false),
    [confirm, setConfirm] = useState(false),
    [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const connected = s?.state === 'CONNECTED',
    pending = s && ['CONNECTING', 'AWAITING_PAIRING'].includes(s.state),
    seconds = s?.challengeExpiresAt
      ? Math.max(0, Math.ceil((new Date(s.challengeExpiresAt).getTime() - now) / 1000))
      : 0;
  async function start() {
    setBusy(true);
    try {
      await api('wa/connect', {
        method: 'POST',
        csrf: h.csrf,
        body: { consent, method, ...(method === 'code' ? { phone } : {}) },
      });
      h.refresh();
      h.toast('Permintaan dikirim. Selesaikan penautan di WhatsApp Anda sendiri.');
    } catch (e) {
      h.toast((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  async function stop() {
    setBusy(true);
    try {
      await api('wa/disconnect', { method: 'POST', csrf: h.csrf });
      setConfirm(false);
      h.refresh();
      h.toast(
        'Kredensial lokal dihapus. Periksa Perangkat tertaut untuk memastikan perangkat dicabut.',
      );
    } catch (e) {
      h.toast((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {error && <Failure message={error} retry={h.refresh} />}
      <div className="connect-grid">
        <section className="panel connect-panel">
          <div className="panel-heading">
            <div>
              <h2>
                <Link2 size={20} />
                Tautkan perangkat
              </h2>
              <p>Gunakan akun milik Anda atau akun yang Anda kelola dengan izin.</p>
            </div>
            <span className={`tag ${connected ? 'success' : ''}`}>
              {s ? stateLabels[s.state] : 'Memuat…'}
            </span>
          </div>
          <div className="connect-content">
            {connected ? (
              <div className="connected-state">
                <div className="connected-orb">
                  <CheckCheck size={42} />
                </div>
                <span className="eyebrow">DIKONFIRMASI OLEH PROVIDER</span>
                <h2>WhatsApp terhubung.</h2>
                <p>
                  Sesi siap menerima event Status yang tersedia. Tidak ada pengambilan riwayat lama
                  secara paksa.
                </p>
                <span className="last-connected">Terhubung sejak {date(s?.lastConnectedAt)}</span>
                <Link href="/hub/statuses" className="btn btn-dark">
                  Buka Status Center <ArrowRight size={17} />
                </Link>
                <button className="text-link danger" onClick={() => setConfirm(true)}>
                  <Unplug size={16} />
                  Putuskan & hapus sesi lokal
                </button>
              </div>
            ) : (
              <>
                <div className="method-tabs" role="tablist" aria-label="Metode penautan">
                  <button
                    role="tab"
                    aria-selected={method === 'qr'}
                    disabled={!!pending}
                    onClick={() => setMethod('qr')}
                  >
                    <QrCode size={18} />
                    Pindai QR
                  </button>
                  <button
                    role="tab"
                    aria-selected={method === 'code'}
                    disabled={!!pending}
                    onClick={() => setMethod('code')}
                  >
                    <Smartphone size={18} />
                    Kode penautan
                  </button>
                </div>
                {s?.error && (
                  <div className="error-box" role="alert">
                    {s.error}
                  </div>
                )}
                <div className={`pairing-stage ${pending ? 'pending' : ''}`}>
                  {s?.challenge && seconds > 0 ? (
                    <>
                      {s.challenge.type === 'qr' ? (
                        <div className="real-qr">
                          <QRCodeSVG value={s.challenge.value} size={204} marginSize={2} />
                        </div>
                      ) : (
                        <>
                          <Smartphone size={32} />
                          <div className="pairing-code" aria-label="Kode penautan WhatsApp">
                            {s.challenge.value}
                          </div>
                        </>
                      )}
                      <h3>
                        {s.challenge.type === 'qr'
                          ? 'Pindai dengan WhatsApp Anda.'
                          : 'Masukkan kode di ponsel Anda.'}
                      </h3>
                      <p>Belum terhubung. Menunggu konfirmasi dari WhatsApp.</p>
                      <span className="tag">
                        <Clock3 size={13} />
                        Kode aktif {seconds} detik
                      </span>
                    </>
                  ) : pending ? (
                    <>
                      <div className="pairing-symbol">
                        <LoaderCircle size={37} className="spin" />
                      </div>
                      <h3>
                        {s?.challengeExpiresAt
                          ? 'Menunggu kode berikutnya…'
                          : 'Menyiapkan penautan…'}
                      </h3>
                      <p>
                        Provider sedang membuka koneksi. Jangan membagikan QR atau kode kepada siapa
                        pun.
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="pairing-symbol">
                        {method === 'qr' ? <QrCode size={42} /> : <Smartphone size={42} />}
                      </div>
                      <h3>
                        {method === 'qr'
                          ? 'QR Anda akan muncul di sini.'
                          : 'Tautkan tanpa memindai QR.'}
                      </h3>
                      <p>
                        {method === 'qr'
                          ? 'Setujui izin di bawah, lalu mulai penautan. QR bukan tanda bahwa sesi sudah terhubung.'
                          : 'Kode dibuat oleh WhatsApp untuk nomor Anda. Masukkan sendiri melalui menu Perangkat tertaut.'}
                      </p>
                    </>
                  )}
                </div>
                {!pending && (
                  <>
                    {method === 'code' && (
                      <label className="phone-field">
                        Nomor WhatsApp Anda
                        <input
                          type="tel"
                          inputMode="numeric"
                          value={phone}
                          onChange={(e) =>
                            setPhone(e.target.value.replace(/[^0-9]/g, '').slice(0, 15))
                          }
                          placeholder="628xxxxxxxxxx"
                          autoComplete="tel"
                        />
                        <small>
                          Kode negara + nomor, hanya angka tanpa +, spasi, atau tanda hubung.
                        </small>
                      </label>
                    )}
                    <label className="consent-label">
                      <input
                        type="checkbox"
                        checked={consent}
                        onChange={(e) => setConsent(e.target.checked)}
                      />
                      <span>
                        Saya pemilik akun ini atau memiliki izin eksplisit untuk mengelolanya. Saya
                        memahami integrasi tidak resmi memiliki risiko pembatasan akun, dan hanya
                        akan menyimpan media dengan izin.
                      </span>
                    </label>
                    <button
                      className="btn btn-dark full"
                      disabled={
                        busy ||
                        !consent ||
                        !s?.worker.online ||
                        !s.enabled ||
                        (method === 'code' && !/^[1-9]\d{7,14}$/.test(phone))
                      }
                      onClick={start}
                    >
                      {busy ? <LoaderCircle size={17} className="spin" /> : <Link2 size={17} />}
                      Mulai penautan
                      <ArrowUpRight size={17} />
                    </button>
                  </>
                )}
                {pending && (
                  <button className="btn btn-light full" onClick={() => setConfirm(true)}>
                    <X size={16} />
                    Batalkan penautan
                  </button>
                )}
                {s && (!s.worker.online || !s.enabled) && (
                  <div className="notice-box">
                    <Info size={17} />
                    <span>
                      {!s.worker.online
                        ? 'Worker offline. Jalankan layanan worker sebelum menautkan.'
                        : 'Integrasi belum diaktifkan. Pengelola perlu mengatur ENABLE_WHATSAPP=true.'}
                    </span>
                  </div>
                )}
                <p className="pairing-note">
                  <LockKeyhole size={14} />
                  QR dan kode hanya ditampilkan kepada pemilik workspace.
                </p>
              </>
            )}
          </div>
        </section>
        <aside className="connect-aside">
          <section className="panel instructions">
            <span className="eyebrow">DI PONSEL ANDA</span>
            <h2>
              Selesaikan sendiri,
              <br />
              langsung di WhatsApp.
            </h2>
            <ol>
              <li>
                <span>1</span>
                <div>
                  <b>Buka WhatsApp</b>
                  <p>
                    Gunakan ponsel dengan akun yang Anda miliki atau diizinkan untuk Anda kelola.
                  </p>
                </div>
              </li>
              <li>
                <span>2</span>
                <div>
                  <b>Perangkat tertaut</b>
                  <p>Buka Setelan atau menu ⋮ → Perangkat tertaut → Tautkan perangkat.</p>
                </div>
              </li>
              <li>
                <span>3</span>
                <div>
                  <b>{method === 'qr' ? 'Pindai QR' : 'Tautkan dengan nomor telepon'}</b>
                  <p>
                    {method === 'qr'
                      ? 'Pindai QR di layar ini. Di satu ponsel, gunakan metode kode penautan.'
                      : 'Pilih tautkan dengan nomor telepon, lalu masukkan kode dari workspace ini.'}
                  </p>
                </div>
              </li>
              <li>
                <span>4</span>
                <div>
                  <b>Tunggu konfirmasi</b>
                  <p>Label “Terhubung” baru muncul setelah provider mengonfirmasi sesi aktif.</p>
                </div>
              </li>
            </ol>
          </section>
          <div className="provider-notice">
            <ShieldCheck size={23} />
            <h3>Ketahui batasannya.</h3>
            <p>
              Baileys bukan API resmi Meta. Dukungan penautan dan penerimaan Status bergantung pada
              protokol WhatsApp saat ini. Koneksi dapat gagal atau akun dapat dibatasi.
            </p>
            <p>Jangan memberikan OTP, QR, atau kode penautan kepada operator.</p>
          </div>
          <section className="panel system-status">
            <h3>Kondisi layanan</h3>
            <div>
              <span>Worker integrasi</span>
              <b className={s?.worker.online ? 'good-text' : ''}>
                <span className="tiny-dot" />
                {s?.worker.online ? 'Aktif' : 'Offline'}
              </b>
            </div>
            <div>
              <span>Penyimpanan worker</span>
              <b>{s?.worker.storageReady && s.worker.online ? 'Siap' : 'Belum siap'}</b>
            </div>
            <div>
              <span>Koneksi terakhir</span>
              <small>{date(s?.lastConnectedAt)}</small>
            </div>
          </section>
        </aside>
      </div>
      {confirm && (
        <Dialog title="Putuskan sesi WhatsApp?" onClose={() => !busy && setConfirm(false)}>
          <div className="dialog-body">
            <p>
              Kredensial, QR/kode, dan descriptor Status akan dihapus dari penyimpanan aktif
              aplikasi. Media library yang sudah disimpan tidak ikut dihapus.
            </p>
            <div className="notice-box">
              <Info size={18} />
              <span>
                Pencabutan perangkat di WhatsApp dilakukan sebisa mungkin. Pastikan perangkat ini
                sudah dikeluarkan melalui WhatsApp → Perangkat tertaut.
              </span>
            </div>
            <div className="dialog-actions">
              <button className="btn btn-light" disabled={busy} onClick={() => setConfirm(false)}>
                Batal
              </button>
              <button className="btn btn-danger" disabled={busy} onClick={stop}>
                {busy ? 'Memproses…' : 'Putuskan & hapus sesi'}
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </>
  );
}
function ActivityRow({ item }: { item: Activity }) {
  return (
    <div className="activity-row">
      <span
        className={`activity-icon ${item.kind.endsWith('FAILED') || item.kind === 'CONNECTION_ERROR' ? 'failed' : ''}`}
      >
        {item.kind === 'DOWNLOAD_COMPLETED' ? (
          <ArrowDownToLine size={16} />
        ) : item.kind === 'CONNECTED' ? (
          <Link2 size={16} />
        ) : item.kind === 'MEDIA_DELETED' ? (
          <Trash2 size={16} />
        ) : (
          <Radio size={16} />
        )}
      </span>
      <div>
        <b>{activityLabels[item.kind] ?? 'Workspace diperbarui'}</b>
        <small title={date(item.createdAt)}>{relative(item.createdAt)}</small>
      </div>
    </div>
  );
}
export function ActivityView() {
  const h = useHub(),
    [page, setPage] = useState(1),
    { data, error, loading } = useResource<PageData<Activity>>(`activity?page=${page}`, h.version);
  return (
    <>
      {error && <Failure message={error} retry={h.refresh} />}
      <section className="panel activity-panel">
        <div className="panel-heading">
          <div>
            <h2>Jejak workspace</h2>
            <p>Aktivitas disimpan hingga 90 hari, tanpa isi pesan.</p>
          </div>
          <button className="icon-btn" aria-label="Refresh aktivitas" onClick={h.refresh}>
            <RefreshCw size={17} />
          </button>
        </div>
        {!data && loading ? (
          <Loading />
        ) : data?.items.length ? (
          <div className="activity-list full-activity">
            {data.items.map((a) => (
              <ActivityRow key={a.id} item={a} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <EmptyArt type="history" />
            <h2>Belum ada jejak aktivitas.</h2>
            <p>
              Penautan sesi, status yang diterima, dan aktivitas media akan tercatat otomatis di
              sini.
            </p>
            <Link href="/hub/connect" className="btn btn-dark">
              Hubungkan WhatsApp <ArrowUpRight size={16} />
            </Link>
          </div>
        )}
      </section>
      {data && <Pager {...data} setPage={setPage} />}
    </>
  );
}
export function HistoryView() {
  const h = useHub(),
    [page, setPage] = useState(1),
    [preview, setPreview] = useState<string | null>(null),
    [busy, setBusy] = useState(''),
    { data, error, loading } = useResource<PageData<Job>>(`history?page=${page}`, h.version);
  async function retry(id: string) {
    setBusy(id);
    try {
      await api(`statuses/${id}/download`, { method: 'POST', csrf: h.csrf });
      h.toast('Media masuk antrean ulang.');
      h.refresh();
    } catch (e) {
      h.toast((e as Error).message, true);
    } finally {
      setBusy('');
    }
  }
  return (
    <>
      <div className="notice-box">
        <Info size={18} />
        <span>
          “Selesai” berarti file berhasil diperoleh dan disimpan di server. Tombol unduh mengirim
          salinannya ke browser Anda.
        </span>
      </div>
      {error && <Failure message={error} retry={h.refresh} />}
      <section className="panel history-panel">
        <div className="panel-heading">
          <div>
            <h2>Proses pengambilan</h2>
            <p>Antrean persisten, percobaan ulang yang aman.</p>
          </div>
          <button className="btn btn-light" onClick={h.refresh}>
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
        {!data && loading ? (
          <Loading />
        ) : data?.items.length ? (
          <div className="history-list">
            {data.items.map((j) => (
              <article className="history-row" key={j.id}>
                <div className="history-file-icon">
                  {j.kind === 'VIDEO' ? <Film size={22} /> : <FileImage size={22} />}
                </div>
                <div className="history-info">
                  <h3>{j.contactName}</h3>
                  <p>
                    {j.kind === 'VIDEO' ? 'Video' : 'Foto'} · {date(j.updatedAt)} · {j.attempts}{' '}
                    percobaan
                  </p>
                  {j.error && <small className="danger">{j.error}</small>}
                </div>
                <span className={`job-state ${j.state.toLowerCase()}`}>
                  {j.state === 'PROCESSING' ? (
                    <LoaderCircle size={13} className="spin" />
                  ) : j.state === 'COMPLETED' ? (
                    <Check size={13} />
                  ) : j.state === 'FAILED' ? (
                    <AlertTriangle size={13} />
                  ) : (
                    <Clock3 size={13} />
                  )}{' '}
                  {jobLabels[j.state]}
                </span>
                <div className="history-actions">
                  {j.state === 'FAILED' && j.statusId && (
                    <button
                      className="btn btn-light"
                      disabled={busy === j.statusId}
                      onClick={() => retry(j.statusId!)}
                    >
                      <RefreshCw size={14} />
                      Coba lagi
                    </button>
                  )}
                  {j.status?.media && !j.status.media.deleteRequestedAt && (
                    <button
                      className="btn btn-light"
                      onClick={() => setPreview(j.status!.media!.id)}
                    >
                      <Eye size={14} />
                      Lihat media
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <EmptyArt type="history" />
            <h2>Belum ada unduhan.</h2>
            <p>
              Media yang Anda siapkan akan muncul di sini, dari antrean pertama sampai file berhasil
              disimpan.
            </p>
            <Link href="/hub/statuses" className="btn btn-dark">
              Jelajahi Status Center <ArrowUpRight size={16} />
            </Link>
          </div>
        )}
      </section>
      {data && <Pager {...data} setPage={setPage} />}{' '}
      {preview && <Preview mediaId={preview} onClose={() => setPreview(null)} />}
    </>
  );
}
export function SettingsView() {
  const [preferenceVersion, setPreferenceVersion] = useState(0);
  const h = useHub(),
    { data, error } = useResource<{ retentionDays: number; notifications: boolean }>(
      'preferences',
      preferenceVersion,
    );
  const [appliedPreferences, setAppliedPreferences] = useState<typeof data>(null);
  const preferencesReady = !!data && appliedPreferences === data;
  const [retention, setRetention] = useState(7),
    [notifications, setNotifications] = useState(true),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (data) {
      setRetention(data.retentionDays);
      setNotifications(data.notifications);
      setAppliedPreferences(data);
    }
  }, [data]);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!preferencesReady || busy) return;
    setBusy(true);
    try {
      await api('preferences', {
        method: 'PATCH',
        csrf: h.csrf,
        body: { retentionDays: retention, notifications },
      });
      h.setNotifications(notifications);
      h.refresh();
      h.toast('Preferensi berhasil disimpan.');
    } catch (e) {
      h.toast((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {error && <Failure message={error} retry={() => setPreferenceVersion((v) => v + 1)} />}
      <div className="settings-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>
                <SettingsIcon />
                Preferensi workspace
              </h2>
              <p>Atur apa yang disimpan dan apa yang diberitahukan.</p>
            </div>
          </div>
          <form className="settings-form" onSubmit={save}>
            <div className="setting-row">
              <div>
                <h3>Hapus media otomatis</h3>
                <p>
                  Media library akan dihapus setelah masa simpan berakhir, dihitung dari waktu file
                  disimpan.
                </p>
              </div>
              <select
                disabled={!preferencesReady || busy}
                value={retention}
                onChange={(e) => setRetention(Number(e.target.value))}
                aria-label="Masa simpan media"
              >
                {[1, 3, 7, 14, 30, 90].map((v) => (
                  <option key={v} value={v}>
                    {v} hari
                  </option>
                ))}
              </select>
            </div>
            <div className="notice-box">
              <Clock3 size={18} />
              <span>
                Mengurangi masa simpan dapat menghapus media lama pada siklus cleanup berikutnya.
                Penghapusan bersifat permanen.
              </span>
            </div>
            <div className="setting-row">
              <div>
                <h3>Notifikasi di aplikasi</h3>
                <p>
                  Tampilkan pemberitahuan koneksi, status baru, dan hasil unduhan saat workspace
                  terbuka.
                </p>
              </div>
              <button
                className={`toggle ${notifications ? 'on' : ''}`}
                type="button"
                disabled={!preferencesReady || busy}
                role="switch"
                aria-checked={notifications}
                aria-label="Notifikasi di aplikasi"
                onClick={() => setNotifications(!notifications)}
              >
                <span />
              </button>
            </div>
            <div className="form-footer">
              <span>Perubahan berlaku untuk akun Anda saja.</span>
              <button className="btn btn-dark" type="submit" disabled={busy || !preferencesReady}>
                {busy ? 'Menyimpan…' : 'Simpan preferensi'}
                <Check size={16} />
              </button>
            </div>
          </form>
        </section>
        <section className="panel account-panel">
          <span className="large-avatar">{h.user.name.slice(0, 1).toUpperCase()}</span>
          <h2>{h.user.name}</h2>
          <p>Administrator workspace</p>
          <span className="tag">
            <LockKeyhole size={12} />
            Personal workspace
          </span>
          <div className="account-detail">
            <ShieldCheck size={18} />
            <p>Setiap permintaan media dan sesi diperiksa berdasarkan pemilik workspace.</p>
          </div>
          <Link href="/hub/connect" className="btn btn-light full">
            Kelola sesi WhatsApp <ArrowUpRight size={16} />
          </Link>
        </section>
        <section className="panel password-panel">
          <div className="panel-heading">
            <div>
              <h2>
                <LockKeyhole size={18} />
                Keamanan akun
              </h2>
              <p>Kata sandi dikelola melalui konfigurasi server.</p>
            </div>
          </div>
          <div className="admin-security-note">
            <p>Login memakai satu kata sandi admin, tanpa akun email atau pendaftaran.</p>
            <p>
              Untuk menggantinya, ubah <code>ADMIN_PASSWORD</code> di konfigurasi service web lalu
              deploy ulang. Sesi login lama otomatis tidak berlaku setelah perubahan.
            </p>
            <div className="notice-box">
              <ShieldCheck size={18} />
              <span>
                Jangan membagikan kata sandi admin. Jangan mengganti ENCRYPTION_KEY untuk mengubah
                kata sandi login.
              </span>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
function SettingsIcon() {
  return <Pause size={18} style={{ transform: 'rotate(90deg)' }} />;
}
