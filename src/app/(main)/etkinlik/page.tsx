import Link from 'next/link';
import { ArrowLeft, SoccerBall, WarningCircle } from '@phosphor-icons/react/dist/ssr';

export default function EventPage() {
  return (
    <main className="mx-auto max-w-4xl pb-10 pt-6 fade-in lg:pt-4">
      <section className="overflow-hidden rounded-3xl border border-surface-200 bg-white shadow-[0_24px_64px_-48px_rgba(17,17,17,0.42)]">
        <div className="border-b border-rose-100 bg-rose-50 px-6 py-4 sm:px-9">
          <div className="flex items-center gap-2 text-sm font-bold text-rose-700">
            <WarningCircle className="h-5 w-5" weight="fill" aria-hidden="true" />
            Etkinlik durumu
          </div>
        </div>
        <div className="px-6 py-10 sm:px-9 sm:py-14">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-surface-200 bg-surface-50 text-surface-500">
            <SoccerBall className="h-7 w-7" weight="duotone" aria-hidden="true" />
          </div>
          <p className="mt-8 text-sm font-semibold tracking-wide text-surface-500">AFL MEZUNLAR FUTBOL TURNUVASI</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-surface-900 sm:text-5xl">Etkinlik iptal edildi</h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-surface-600">
            Bu etkinlik için yeni başvuru veya takım kaydı alınmıyor. İlginiz için teşekkür ederiz; yeni etkinlik duyurularını platformdan paylaşacağız.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/" className="btn-primary"><ArrowLeft className="h-4 w-4" weight="bold" />Ana sayfaya dön</Link>
            <Link href="/topluluk" className="btn-secondary">Topluluğa git</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
