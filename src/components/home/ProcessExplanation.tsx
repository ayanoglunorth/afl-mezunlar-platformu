'use client';

import { useState, useTransition } from 'react';
import { Student, GraduationCap, Target, UsersThree, ChatTeardropText, Briefcase, Handshake } from '@phosphor-icons/react';

export function ProcessExplanation({ variant = 'default' }: { variant?: 'default' | 'compact' }) {
  const [activeTab, setActiveTab] = useState<'student' | 'alumni'>('student');
  const [, startTransition] = useTransition();
  const isCompact = variant === 'compact';
  const panelClassName = isCompact
    ? 'relative z-10 flex h-full min-h-0 w-full flex-col overflow-hidden rounded-3xl border border-surface-200 bg-white shadow-xl shadow-surface-900/5'
    : 'relative z-10 flex h-full min-h-[440px] w-full flex-col overflow-hidden rounded-3xl border border-surface-200 bg-white shadow-xl shadow-surface-900/5';
  const tabButtonBase = `relative z-10 flex w-full cursor-pointer select-none items-center justify-center gap-2 rounded-2xl px-3 py-3 text-center text-xs font-semibold leading-snug transition-all duration-300 sm:text-sm ${isCompact ? 'min-h-14 sm:min-h-16 sm:px-5' : 'min-h-16 sm:px-5 sm:py-4'}`;
  const contentClassName = isCompact ? 'relative flex h-full flex-1 flex-col p-5 sm:p-6' : 'relative flex-1 p-6 flex flex-col h-full';
  const stepsClassName = isCompact
    ? 'animate-in fade-in slide-in-from-bottom-2 flex flex-1 flex-col justify-center gap-7 duration-500'
    : 'animate-in fade-in slide-in-from-bottom-2 flex-1 flex flex-col justify-between py-2 duration-500';
  const stepIconClassName = isCompact
    ? 'mt-1 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl border'
    : 'mt-1 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl border';
  const stepTitleClassName = isCompact
    ? 'mb-1 text-[15px] font-bold text-surface-900'
    : 'mb-1 text-base font-bold text-surface-900';
  const stepTextClassName = isCompact
    ? 'text-sm leading-6 text-surface-600'
    : 'text-sm leading-relaxed text-surface-600';
  const highlightClassName = 'rounded bg-brand-50 px-1 font-semibold text-brand-700';

  return (
    <div className={panelClassName}>
      <div className="grid grid-cols-2 gap-2 border-b border-surface-100 bg-surface-50/50 p-2">
        <button
          onClick={() => startTransition(() => setActiveTab('student'))}
          className={`${tabButtonBase} ${
            activeTab === 'student'
              ? 'border border-surface-200/80 bg-white text-brand-700 shadow-sm shadow-surface-900/5'
              : 'border border-transparent text-surface-500 hover:bg-surface-100/60 hover:text-surface-700'
          }`}
        >
          <Student weight={activeTab === 'student' ? 'fill' : 'regular'} className="h-5 w-5 flex-shrink-0" />
          <span className="min-w-0 whitespace-normal leading-snug">AFL Öğrencisiyim</span>
        </button>
        <button
          onClick={() => startTransition(() => setActiveTab('alumni'))}
          className={`${tabButtonBase} ${
            activeTab === 'alumni'
              ? 'border border-surface-200/80 bg-white text-brand-700 shadow-sm shadow-surface-900/5'
              : 'border border-transparent text-surface-500 hover:bg-surface-100/60 hover:text-surface-700'
          }`}
        >
          <GraduationCap weight={activeTab === 'alumni' ? 'fill' : 'regular'} className="h-5 w-5 flex-shrink-0" />
          <span className="min-w-0 whitespace-normal leading-snug">AFL Mezunuyum</span>
        </button>
      </div>

      <div className={contentClassName}>
        {activeTab === 'student' && (
          <div className={stepsClassName}>
            <div className="flex items-start gap-4">
              <div className={`${stepIconClassName} border-blue-100 bg-blue-50`}>
                <Target weight="duotone" className={`${isCompact ? 'h-5 w-5' : 'h-6 w-6'} text-blue-600`} />
              </div>
              <div>
                <h4 className={stepTitleClassName}>1. Hedefini Belirle</h4>
                <p className={stepTextClassName}>
                  Profilini oluştur. Özellikle <strong className={highlightClassName}>tercih dönemindeysen</strong>{' '}ilgilendiğin üniversite ve bölümleri mutlaka ekle.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className={`${stepIconClassName} border-purple-100 bg-purple-50`}>
                <UsersThree weight="duotone" className={`${isCompact ? 'h-5 w-5' : 'h-6 w-6'} text-purple-600`} />
              </div>
              <div>
                <h4 className={stepTitleClassName}>2. Doğru Mezunla Eşleş</h4>
                <p className={stepTextClassName}>
                  Sistemin seni, hedeflerine en uygun AFL mezunlarıyla eşleştirmesine izin ver. Tek tıkla mentorluk isteği gönder.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className={`${stepIconClassName} border-brand-100 bg-brand-50`}>
                <ChatTeardropText weight="duotone" className={`${isCompact ? 'h-5 w-5' : 'h-6 w-6'} text-brand-600`} />
              </div>
              <div>
                <h4 className={stepTitleClassName}>3. Tercihlerini Şansa Bırakma</h4>
                <p className={stepTextClassName}>
                  Şu anki <strong className={highlightClassName}>tercih döneminde</strong>{' '}aklındaki tüm soruları doğrudan o üniversitede okuyan mezunlarımıza sor, geleceğine net bir yön ver.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'alumni' && (
          <div className={stepsClassName}>
            <div className="flex items-start gap-4">
              <div className={`${stepIconClassName} border-emerald-100 bg-emerald-50`}>
                <GraduationCap weight="duotone" className={`${isCompact ? 'h-5 w-5' : 'h-6 w-6'} text-emerald-600`} />
              </div>
              <div>
                <h4 className={stepTitleClassName}>1. Tecrübeni Aktar</h4>
                <p className={stepTextClassName}>
                  Eğitim ve iş bilgilerini ekle. Özellikle <strong className={highlightClassName}>tercih dönemindeki</strong>{' '}AFL&apos;li gençlerin doğru karar vermesine yardımcı ol.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className={`${stepIconClassName} border-amber-200 bg-amber-50`}>
                <Briefcase weight="duotone" className={`${isCompact ? 'h-5 w-5' : 'h-6 w-6'} text-amber-600`} />
              </div>
              <div>
                <h4 className={stepTitleClassName}>2. Sadece Mentor Olma, <span className="text-brand-700">Mentee Ol!</span></h4>
                <p className={stepTextClassName}>
                  Üniversitedeysen üst sınıflardan, yeni mezunsan sektördeki tecrübeli (Senior) AFL mezunlarından kariyer tavsiyeleri al.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className={`${stepIconClassName} border-blue-100 bg-blue-50`}>
                <Handshake weight="duotone" className={`${isCompact ? 'h-5 w-5' : 'h-6 w-6'} text-blue-600`} />
              </div>
              <div>
                <h4 className={stepTitleClassName}>3. Güçlü Bir Network Kur</h4>
                <p className={stepTextClassName}>
                  Farklı sektörlerdeki AFL mezunlarıyla bağlantıda kal. Staj, iş imkanları ve yeni projeler için okulunun gücünü kullan.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
