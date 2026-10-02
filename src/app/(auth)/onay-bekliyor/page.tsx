import Link from 'next/link';

export default function PendingApprovalPage() {
  return (
    <main className="min-h-[100dvh] flex items-center justify-center px-4 py-12">
      <section className="card w-full max-w-md space-y-5 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10">
          <svg className="h-7 w-7 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2A10 10 0 112 12a10 10 0 0120 0z" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Onay bekleniyor</h1>
          <p className="mt-2 text-sm leading-6 text-surface-600">
            Okul numaranızı hatırlamadığınızı belirttiğiniz için hesabınız yönetici onayına alındı.
            Onay tamamlandığında platform özelliklerine erişebileceksiniz.
          </p>
        </div>
        <Link href="/giris" className="btn-secondary inline-flex w-full justify-center py-3">
          Giriş sayfasına dön
        </Link>
      </section>
    </main>
  );
}
