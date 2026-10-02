'use client';

import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { SiteNotice } from '@/components/ui/SiteNotice';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showResend, setShowResend] = useState(false);
  const [resendStatus, setResendStatus] = useState<'idle' | 'loading' | 'success'>('idle');
  const router = useRouter();
  const searchParams = useSearchParams();
  const successMessage = searchParams.get('message');
  const supabase = useMemo(() => createClient(), []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setShowResend(false);
    setResendStatus('idle');
    setLoading(true);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      if (authError.message.includes('Email not confirmed')) {
        setError('E-posta adresiniz henüz doğrulanmamış. Doğrulama linkinin süresi dolmuş olabilir.');
        setShowResend(true);
      } else if (authError.message.includes('Invalid login credentials')) {
        setError('E-posta veya şifre hatalı.');
      } else {
        setError(authError.message);
      }
      setLoading(false);
      return;
    }

    window.sessionStorage.setItem('show-dashboard-loading', '1');
    router.push('/');
    router.refresh();
  }

  async function handleResendVerification() {
    setResendStatus('loading');
    setError('');
    
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setResendStatus('idle');
    } else {
      setResendStatus('success');
      setShowResend(false);
    }
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8 fade-in">
        {/* Logo */}
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <Image src="/afl-logo.svg" alt="AFL Logo" width={841} height={493} loading="eager" className="h-20 w-auto" />
          </Link>
          <h1 className="text-2xl font-bold text-surface-900 mt-6">Tekrar Hoş Geldin</h1>
          <p className="text-surface-500 mt-2">Hesabına giriş yap</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="card space-y-5">
          {error && (
            <SiteNotice type="error" message={error} onDismiss={() => setError('')} />
          )}

          {successMessage && (
            <SiteNotice type="success" message={successMessage} />
          )}
          
          {resendStatus === 'success' && (
            <SiteNotice type="success" message="Doğrulama maili yeniden gönderildi! Lütfen e-posta kutunuzu (ve spam/gereksiz klasörünü) kontrol edin." onDismiss={() => setResendStatus('idle')} />
          )}

          {showResend && resendStatus !== 'success' && (
            <div className="bg-brand-50 border border-brand-100 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in">
              <p className="text-sm text-brand-800">
                Yeni bir doğrulama maili almak ister misiniz?
              </p>
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={resendStatus === 'loading'}
                className="shrink-0 btn-secondary py-1.5 px-3 text-xs w-full sm:w-auto"
              >
                {resendStatus === 'loading' ? 'Gönderiliyor...' : 'Tekrar Gönder'}
              </button>
            </div>
          )}

          <div>
            <label htmlFor="email" className="label">E-posta</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ornek@email.com"
              required
              className="input"
            />
          </div>

          <div>
            <label htmlFor="password" className="label">Şifre</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              className="input"
            />
            <div className="flex justify-end mt-1">
              <Link href="/sifremi-unuttum" className="text-sm text-brand-400 hover:text-brand-300 font-medium inline-block py-1 px-2 -mr-2 relative z-10 cursor-pointer">
                Şifremi unuttum
              </Link>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-3"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Giriş yapılıyor...
              </span>
            ) : (
              'Giriş Yap'
            )}
          </button>
        </form>

        <p className="text-center text-sm text-surface-500">
          Hesabın yok mu?{' '}
          <Link href="/kayit" className="text-brand-400 hover:text-brand-300 font-medium">
            Kayıt Ol
          </Link>
        </p>
      </div>
    </div>
  );
}
