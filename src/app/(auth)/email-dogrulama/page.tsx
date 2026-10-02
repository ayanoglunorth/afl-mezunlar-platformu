import Link from 'next/link';

export default function EmailVerificationPage() {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center space-y-6 fade-in">
        <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center mx-auto">
          <svg className="w-8 h-8 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-surface-900">E-postanı Doğrula</h1>
        <p className="text-surface-500 leading-relaxed">
          Kayıt olduğun e-posta adresine bir doğrulama bağlantısı gönderdik. 
          Lütfen e-posta kutunu kontrol et ve bağlantıya tıkla.
        </p>
        <div className="card text-left space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-brand-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-xs font-bold text-brand-400">1</span>
            </div>
            <p className="text-sm text-surface-600">E-posta kutunu kontrol et</p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-brand-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-xs font-bold text-brand-400">2</span>
            </div>
            <p className="text-sm text-surface-600">Doğrulama bağlantısına tıkla</p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-brand-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-xs font-bold text-brand-400">3</span>
            </div>
            <p className="text-sm text-surface-600">Hesabına giriş yap</p>
          </div>
        </div>
        <p className="text-xs text-surface-500">
          E-posta gelmediyse spam klasörünü kontrol et.
        </p>
        <Link href="/giris" className="btn-secondary inline-flex">
          Giriş Sayfasına Dön
        </Link>
      </div>
    </div>
  );
}
