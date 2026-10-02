'use client';

import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import Image from 'next/image';
import { SiteNotice } from '@/components/ui/SiteNotice';

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setLoading(true);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/sifre-yenile`,
    });

    if (resetError) {
      setError(resetError.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8 fade-in">
        {/* Logo */}
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <Image src="/afl-logo.svg" alt="AFL Logo" width={841} height={493} loading="eager" className="h-20 w-auto" />
          </Link>
          <h1 className="text-2xl font-bold text-surface-900 mt-6">Şifremi Unuttum</h1>
          <p className="text-surface-500 mt-2">Şifrenizi sıfırlamak için e-posta adresinizi girin</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="card space-y-5">
          {error && (
            <SiteNotice type="error" message={error} onDismiss={() => setError('')} />
          )}

          {success && (
            <SiteNotice type="success" message="Şifre sıfırlama bağlantısı e-posta adresinize gönderildi. Lütfen e-posta kutunuzu kontrol edin." />
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
              disabled={success || loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading || success}
            className="btn-primary w-full py-3"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Gönderiliyor...
              </span>
            ) : (
              'Sıfırlama Bağlantısı Gönder'
            )}
          </button>
        </form>

        <p className="text-center text-sm text-surface-500">
          <Link href="/giris" className="text-brand-400 hover:text-brand-300 font-medium">
            &larr; Giriş sayfasına dön
          </Link>
        </p>
      </div>
    </div>
  );
}
