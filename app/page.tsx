import Link from 'next/link';
import {
  ArrowUpRight,
  ArrowRight,
  ShieldCheck,
  ScanLine,
  Images,
  FolderHeart,
  LockKeyhole,
  Check,
  CircleArrowDown,
} from 'lucide-react';
import { Brand } from '@/components/brand';
import { Orbit } from '@/components/illustrations';
export default function Landing() {
  return (
    <div className="landing">
      <header className="landing-nav">
        <Brand />
        <nav aria-label="Navigasi utama">
          <a href="#how">Cara kerja</a>
          <a href="#privacy">Privasi</a>
          <Link href="/login" className="btn btn-dark">
            Buka workspace <ArrowUpRight size={17} />
          </Link>
        </nav>
      </header>
      <main id="main">
        <section className="landing-hero">
          <div className="hero-copy">
            <span className="eyebrow">
              <span className="tiny-dot" />
              PERSONAL STATUS WORKSPACE
            </span>
            <h1>
              Momen singkat.
              <br />
              <span>Tersimpan rapi.</span>
            </h1>
            <p>
              Ruang pribadi untuk Status WhatsApp Anda. Pilih momen yang ingin disimpan, nikmati
              media aslinya, dan temukan kembali dengan mudah.
            </p>
            <div className="hero-actions">
              <Link href="/login" className="btn btn-dark btn-lg">
                Masuk admin <ArrowUpRight size={20} />
              </Link>
              <a href="#how" className="text-link">
                Lihat cara kerjanya <ArrowRight size={17} />
              </a>
            </div>
            <div className="hero-assurance">
              <ShieldCheck size={17} />
              <span>Akun Anda. Izin Anda. Kendali Anda.</span>
            </div>
          </div>
          <div className="hero-visual">
            <span className="visual-kicker">LESS CLUTTER. MORE MOMENTS.</span>
            <Orbit />
            <div className="visual-caption">
              <span>01 / A LITTLE SPACE FOR YOUR STORIES</span>
              <ArrowUpRight size={24} />
            </div>
          </div>
        </section>
        <div className="landing-strip">
          <span>
            <Check size={17} /> Foto & video yang tersedia
          </span>
          <span>
            <LockKeyhole size={17} /> Workspace terlindungi
          </span>
          <span>
            <FolderHeart size={17} /> Library pribadi
          </span>
          <span>
            <CircleArrowDown size={17} /> Tanpa konversi kualitas
          </span>
        </div>
        <section id="how" className="how-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">SEDERHANA, DARI AWAL.</span>
              <h2>
                Dari status ke koleksi.
                <br />
                Tanpa kehilangan kendali.
              </h2>
            </div>
            <p>
              Tidak ada feed buatan. Tidak ada akses tersembunyi.
              <br />
              Hanya media yang benar-benar diterima sesi Anda.
            </p>
          </div>
          <div className="steps-grid">
            {[
              {
                icon: ScanLine,
                no: '01',
                title: 'Tautkan akun Anda',
                text: 'Pindai QR atau masukkan kode melalui menu Perangkat tertaut di WhatsApp Anda sendiri.',
              },
              {
                icon: Images,
                no: '02',
                title: 'Pilih momennya',
                text: 'Telusuri status foto dan video yang diterima saat terhubung. Simpan hanya dengan izin pemiliknya.',
              },
              {
                icon: FolderHeart,
                no: '03',
                title: 'Rapikan koleksi',
                text: 'Pratinjau, unduh, dan atur masa simpan. Media tersimpan terpisah dari masa aktif Status.',
              },
            ].map((s) => (
              <article className="step-card" key={s.no}>
                <div>
                  <s.icon size={26} />
                  <span>{s.no}</span>
                </div>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </article>
            ))}
          </div>
        </section>
        <section id="privacy" className="privacy-section">
          <ShieldCheck size={38} />
          <div>
            <span className="eyebrow">TRANSPARAN SEJAK AWAL</span>
            <h2>Personal, bukan tanpa batas.</h2>
            <p>
              IM Status Hub menggunakan Baileys, integrasi WhatsApp Web tidak resmi. Tidak ada
              jaminan seluruh Status atau riwayat lama tersedia. Perubahan protokol dan pembatasan
              akun dapat terjadi. Gunakan hanya akun milik Anda atau yang secara eksplisit
              mengizinkan Anda.
            </p>
          </div>
          <Link href="/login" className="text-link">
            Masuk dengan aman <ArrowUpRight size={18} />
          </Link>
        </section>
      </main>
      <footer className="landing-footer">
        <Brand />
        <p>Built for moments worth keeping.</p>
        <span>Tidak berafiliasi dengan WhatsApp atau Meta.</span>
      </footer>
    </div>
  );
}
