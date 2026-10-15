'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { Brand } from './brand';
import { Orbit } from './illustrations';
import { api } from '@/lib/client';

export function AuthForm() {
  const router = useRouter();
  const [visible, setVisible] = useState(false),
    [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false),
    [checking, setChecking] = useState(true);
  const [error, setError] = useState(''),
    [setupError, setSetupError] = useState('');
  const checkSetup = useCallback(async () => {
    setChecking(true);
    setReady(false);
    setSetupError('');
    try {
      await api('auth/config');
      setReady(true);
    } catch (e) {
      setSetupError(e instanceof Error ? e.message : 'Konfigurasi layanan belum siap.');
    } finally {
      setChecking(false);
    }
  }, []);
  useEffect(() => {
    void api('auth/me')
      .then(() => router.replace('/hub'))
      .catch(() => {});
    void checkSetup();
  }, [router, checkSetup]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError('');
    const data = new FormData(event.currentTarget);
    try {
      await api('auth/login', { method: 'POST', body: { password: String(data.get('password')) } });
      router.push('/hub');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Tidak dapat masuk. Coba lagi.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main id="main" className="auth-page">
      <aside className="auth-aside">
        <Brand dark />
        <div>
          <span className="eyebrow">A PLACE FOR YOUR MOMENTS</span>
          <h1>
            Yang singkat,
            <br />
            bisa tetap
            <br />
            <em>dekat.</em>
          </h1>
          <p>
            Satu workspace pribadi.
            <br />
            Untuk momen yang layak disimpan.
          </p>
        </div>
        <Orbit compact />
        <span className="auth-footnote">
          <ShieldCheck size={16} />
          Kredensial sesi dienkripsi saat tersimpan.
        </span>
      </aside>
      <section className="auth-main">
        <Link href="/" className="back-link">
          <ArrowLeft size={16} />
          Kembali ke beranda
        </Link>
        <div className="auth-card admin-auth-card">
          <span className="eyebrow">
            <LockKeyhole size={13} />
            AKSES PRIBADI
          </span>
          <h2>Login admin.</h2>
          <p>Satu kata sandi. Langsung ke workspace Anda.</p>
          <div className="admin-login-note">
            <ShieldCheck size={18} />
            <span>Tanpa email, pendaftaran, atau kode undangan.</span>
          </div>
          {setupError && (
            <div className="error-box admin-setup-error" role="alert">
              <span>{setupError}</span>
              <button type="button" onClick={checkSetup} disabled={checking}>
                <RefreshCw size={14} />
                Periksa lagi
              </button>
            </div>
          )}
          <form onSubmit={submit}>
            <label>
              Kata sandi admin
              <div className="password-input">
                <input
                  type={visible ? 'text' : 'password'}
                  name="password"
                  autoComplete="current-password"
                  placeholder="Masukkan kata sandi admin"
                  minLength={12}
                  maxLength={128}
                  required
                />
                <button
                  type="button"
                  onClick={() => setVisible(!visible)}
                  aria-label={visible ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                >
                  {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
            {error && (
              <p className="error-box" role="alert">
                {error}
              </p>
            )}
            <button
              type="submit"
              className="btn btn-dark full"
              disabled={busy || !ready || checking}
            >
              {busy || checking ? <span className="spinner" /> : null}
              {checking ? 'Memeriksa layanan…' : busy ? 'Memproses…' : 'Masuk sebagai admin'}
              <ArrowRight size={18} />
            </button>
          </form>
          <p className="admin-password-help">
            Gunakan kata sandi yang Anda atur pada <code>ADMIN_PASSWORD</code> di service web. Tidak
            ada kata sandi bawaan.
          </p>
          <p className="auth-note">
            <LockKeyhole size={15} />
            Ini bukan OTP atau kata sandi WhatsApp.
          </p>
        </div>
        <p className="auth-bottom">Hanya untuk pemilik atau pengelola yang diizinkan. · v2.0.0</p>
      </section>
    </main>
  );
}
