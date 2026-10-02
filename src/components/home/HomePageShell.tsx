'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ArrowRight,
  CaretRight,
  ChatCircleText,
  GraduationCap,
  Student,
  Target,
  UserCircle,
  UserCircleGear,
  UserPlus,
} from '@phosphor-icons/react/dist/ssr';
import type { Profile } from '@/types/database';
import { useRealtime } from '@/components/realtime/RealtimeProvider';
import { YksTimeline } from '@/components/home/YksTimeline';
import { ProcessExplanation } from '@/components/home/ProcessExplanation';
import { DashboardContactBox } from '@/components/dashboard/DashboardContactBox';
import { DeferredSocialBoard } from '@/components/dashboard/DeferredSocialBoard';

type DashboardProfile = Pick<Profile, 'full_name' | 'role'>;

type DashboardCard = {
  title: string;
  description: string;
  href: string;
  cta: string;
  icon: React.ReactNode;
  accent: string;
};

function getRoleLabel(role: DashboardProfile['role']) {
  if (role === 'student') return 'AFL Öğrencisi';
  if (role === 'alumni') return 'AFL Mezunu';
  if (role === 'teacher') return 'AFL Öğretmeni';
  return 'Yönetici';
}

function getDashboardCards(profile: DashboardProfile): DashboardCard[] {
  if (profile.role === 'student') {
    return [
      {
        title: 'Tercih mentorlarını aç',
        description: 'Hedeflerine göre eşleşen mezunları gör, istek gönder ve görüşmeleri başlat.',
        href: '/eslesmeler',
        cta: 'Eşleşmelere git',
        icon: <Target className="h-5 w-5" weight="duotone" />,
        accent: 'bg-blue-50 text-blue-700 border-blue-100',
      },
      {
        title: 'Profilini güçlendir',
        description: 'Hedef üniversite, bölüm ve beklentilerini güncel tut ki öneriler daha isabetli olsun.',
        href: '/profil',
        cta: 'Profili düzenle',
        icon: <UserCircleGear className="h-5 w-5" weight="duotone" />,
        accent: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      },
      {
        title: 'Mesajlarını takip et',
        description: 'Kabul edilen mentorluk isteklerin ve aktif görüşmelerin tek yerde dursun.',
        href: '/mesajlar',
        cta: 'Mesajlara git',
        icon: <ChatCircleText className="h-5 w-5" weight="duotone" />,
        accent: 'bg-amber-50 text-amber-700 border-amber-100',
      },
    ];
  }

  if (profile.role === 'teacher') {
    return [
      {
        title: 'Profilini güncelle',
        description: 'Öğretmen hesabında görünen temel bilgileri güncel tut.',
        href: '/profil',
        cta: 'Profili düzenle',
        icon: <UserCircleGear className="h-5 w-5" weight="duotone" />,
        accent: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      },
      {
        title: 'Ayarlarını kontrol et',
        description: 'E-posta, şifre ve hesap güvenliği ayarlarını yönet.',
        href: '/ayarlar',
        cta: 'Ayarları aç',
        icon: <GraduationCap className="h-5 w-5" weight="duotone" />,
        accent: 'bg-blue-50 text-blue-700 border-blue-100',
      },
      {
        title: 'Platform akışı',
        description: 'Tercih süreci başladığında ilgili öğrenci ve iletişim akışlarını buradan takip edebileceksin.',
        href: '/profil',
        cta: 'Profiline git',
        icon: <ChatCircleText className="h-5 w-5" weight="duotone" />,
        accent: 'bg-amber-50 text-amber-700 border-amber-100',
      },
    ];
  }

  return [
    {
      title: 'Gelen istekleri yönet',
      description: 'Öğrencilerden gelen mentorluk taleplerini incele, kabul et veya beklemeye al.',
      href: '/eslesmeler',
      cta: 'İstekleri aç',
      icon: <UserPlus className="h-5 w-5" weight="duotone" />,
      accent: 'bg-brand-50 text-brand-700 border-brand-100',
    },
    {
      title: 'Topluluğu aç',
      description: 'Mezunlar ve öğrencilerle konuları takip et, deneyim paylaş ve yeni sorulara yanıt ver.',
      href: '/topluluk',
      cta: 'Topluluğa git',
      icon: <UserCircle className="h-5 w-5" weight="duotone" />,
      accent: 'bg-blue-50 text-blue-700 border-blue-100',
    },
    {
      title: 'Sohbet akışını kontrol et',
      description: 'Kabul ettiğin öğrencilerle aktif konuşmaları hızlıca sürdür.',
      href: '/mesajlar',
      cta: 'Sohbetlere git',
      icon: <ChatCircleText className="h-5 w-5" weight="duotone" />,
      accent: 'bg-amber-50 text-amber-700 border-amber-100',
    },
  ];
}

function LandingHero({ heroSerifClassName }: { heroSerifClassName: string }) {
  return (
    <>
      <main className="flex-1 flex items-center pt-32 pb-24">
        <div className="max-w-7xl mx-auto px-6 w-full">
          <div className="grid lg:grid-cols-12 gap-16 lg:gap-12 items-center">
            <div className="lg:col-span-5 space-y-8 relative z-10 animate-fade-in-up">
              <h1 className={`${heroSerifClassName} text-5xl sm:text-[3.5rem] md:text-[4.5rem] lg:text-[5rem] font-medium tracking-tight text-surface-900 leading-[1.05]`}>
                Okulundan <br />
                <span className="italic text-brand-700">güç al.</span>
              </h1>

              <p className="text-lg text-surface-600 leading-relaxed max-w-[42ch]">
                Akhisar Fen Lisesi mezunlarıyla tanış, üniversite tercihlerin için ilk elden mentorluk al ve kariyerine net bir yön ver.
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-4 pt-4">
                <Link href="/kayit" className="btn-primary text-base px-8 py-3.5 w-full sm:w-auto group">
                  Ağa Katıl
                  <CaretRight weight="bold" className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Link>
                <Link href="/giris" className="btn-secondary text-base px-8 py-3.5 w-full sm:w-auto">
                  Giriş Yap
                </Link>
              </div>
            </div>

            <div className="lg:col-span-7 relative z-10 lg:pl-12">
              <ProcessExplanation />
            </div>
          </div>
        </div>
      </main>

      <div className="bg-surface-0 border-t border-surface-200">
        <YksTimeline />
        <div className="pb-8">
          <DashboardContactBox mode="registration" />
        </div>
      </div>
    </>
  );
}

function AuthDashboard({ profile }: { profile: DashboardProfile }) {
  const cards = getDashboardCards(profile);

  return (
    <main className="flex-1 pt-28 pb-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6">
        <section className="grid items-stretch gap-6 xl:grid-cols-[minmax(0,1fr)_25rem]">
          <div className="space-y-6">
            <div className="rounded-2xl border border-surface-200 bg-white px-7 py-8 shadow-[0_20px_50px_-40px_rgba(17,17,17,0.35)]">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-brand-100 bg-brand-50 text-brand-700">
                    {profile.role === 'student' ? <Student className="h-6 w-6" weight="duotone" /> : <GraduationCap className="h-6 w-6" weight="duotone" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-surface-500">{getRoleLabel(profile.role)}</p>
                    <h1 className="text-3xl font-bold tracking-tight text-surface-900">{profile.full_name}</h1>
                  </div>
                </div>

                <p className="max-w-[56ch] text-base leading-7 text-surface-600">
                  {profile.role === 'student'
                    ? 'Bugün platformda en kısa yol: hedeflerini güncelle, doğru mentorla eşleş ve aktif görüşmelerini buradan sürdür.'
                    : profile.role === 'teacher'
                      ? 'Bugün platformda en kısa yol: profilini güncel tut ve platform akışını öğretmen hesabınla takip et.'
                      : 'Gelen istekleri gözden geçir, mezunlar ve öğrencilerle sohbet akışını canlı tut.'}
                </p>

                <div className="flex flex-wrap gap-3 pt-2">
                  <Link href={profile.role === 'student' ? '/eslesmeler' : profile.role === 'teacher' ? '/profil' : '/topluluk'} className="btn-primary px-5 py-3 text-sm">
                    {profile.role === 'student' ? 'Mentor önerilerini aç' : profile.role === 'teacher' ? 'Profilini aç' : 'Topluluğu aç'}
                  </Link>
                  <Link href="/mesajlar" className="btn-secondary px-5 py-3 text-sm">
                    Mesajlara git
                  </Link>
                </div>
              </div>
            </div>

            <section className="grid gap-4 lg:grid-cols-3">
              {cards.map((card) => (
                <Link
                  key={card.title}
                  href={card.href}
                  className="group flex min-h-56 flex-col rounded-2xl border border-surface-200 bg-white p-6 shadow-[0_16px_40px_-36px_rgba(17,17,17,0.45)] transition duration-200 hover:-translate-y-0.5 hover:border-surface-300 hover:shadow-[0_24px_48px_-32px_rgba(17,17,17,0.28)]"
                >
                  <div className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border ${card.accent}`}>
                    {card.icon}
                  </div>
                  <h3 className="mt-5 text-lg font-bold tracking-tight text-surface-900">{card.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-surface-600">{card.description}</p>
                  <div className="mt-auto inline-flex items-center gap-2 pt-5 text-sm font-semibold text-brand-700">
                    {card.cta}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" weight="bold" />
                  </div>
                </Link>
              ))}
            </section>
          </div>

          <DeferredSocialBoard />
        </section>

        <section className="grid items-stretch gap-8 lg:grid-cols-12 lg:gap-12">
          <div className="flex h-[27rem] lg:col-span-7 xl:col-span-7 -mx-6 lg:mx-0">
            <YksTimeline layout="compact" />
          </div>
          <div className="relative z-10 flex h-[27rem] pt-4 lg:col-span-5 lg:pt-0 xl:col-span-5">
            <ProcessExplanation variant="compact" />
          </div>
        </section>

        <DashboardContactBox />
        
      </div>
    </main>
  );
}

function DashboardLoading() {
  return (
    <main className="flex min-h-[calc(100dvh-72px)] flex-1 items-center justify-center bg-surface-0 px-6 pt-24" aria-label="Dashboard yükleniyor">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-brand-100 bg-white text-brand-600 shadow-[0_18px_42px_-32px_rgba(17,17,17,0.3)]">
        <div className="relative h-6 w-6">
          <span className="absolute inset-0 rounded-full border-2 border-brand-100" />
          <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-brand-600" />
        </div>
      </div>
    </main>
  );
}

export function HomePageShell({ heroSerifClassName }: { heroSerifClassName: string }) {
  const { profile, loading } = useRealtime();
  const [showTransitionLoader, setShowTransitionLoader] = useState(
    () => typeof window !== 'undefined' && window.sessionStorage.getItem('show-dashboard-loading') === '1',
  );

  useEffect(() => {
    if (!showTransitionLoader || !profile) return;
    window.sessionStorage.removeItem('show-dashboard-loading');
    const timer = window.setTimeout(() => setShowTransitionLoader(false), 0);
    return () => window.clearTimeout(timer);
  }, [profile, showTransitionLoader]);

  useEffect(() => {
    if (!showTransitionLoader || loading || profile) return;
    const timer = window.setTimeout(() => {
      window.sessionStorage.removeItem('show-dashboard-loading');
      setShowTransitionLoader(false);
    }, 3500);
    return () => window.clearTimeout(timer);
  }, [loading, profile, showTransitionLoader]);

  if (loading || (showTransitionLoader && !profile)) {
    return showTransitionLoader ? <DashboardLoading /> : null;
  }

  return profile ? <AuthDashboard profile={profile} /> : <LandingHero heroSerifClassName={heroSerifClassName} />;
}
