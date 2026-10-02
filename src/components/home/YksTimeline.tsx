'use client';

import { useState, useEffect } from 'react';
import { CalendarBlank, Flag, FlagCheckered } from '@phosphor-icons/react';

const START_DATE = new Date('2026-07-29T00:00:00+03:00');
const END_DATE = new Date('2026-08-10T23:59:00+03:00');
const TOTAL_PREFERENCE_MS = END_DATE.getTime() - START_DATE.getTime();

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export function YksTimeline({ layout = 'default' }: { layout?: 'default' | 'stacked' | 'compact' }) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [phase, setPhase] = useState<'upcoming' | 'active' | 'ended'>('upcoming');
  const [mounted, setMounted] = useState(false);
  const isStacked = layout === 'stacked' || layout === 'compact';
  const isCompact = layout === 'compact';

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      let target = START_DATE;
      let currentPhase: 'upcoming' | 'active' | 'ended' = 'upcoming';

      if (now >= END_DATE) {
        currentPhase = 'ended';
        target = END_DATE;
      } else if (now >= START_DATE) {
        currentPhase = 'active';
        target = END_DATE;
      }

      setPhase(currentPhase);

      if (currentPhase === 'ended') return { days: 0, hours: 0, minutes: 0, seconds: 0 };

      const difference = target.getTime() - now.getTime();
      return {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60)
      };
    };

    const mountTimer = window.setTimeout(() => {
      setMounted(true);
      setTimeLeft(calculateTimeLeft());
    }, 0);

    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => {
      window.clearTimeout(mountTimer);
      clearInterval(timer);
    };
  }, []);

  if (!mounted) return null; // Avoid hydration mismatch

  // Keep the timeline bar proportional to the real elapsed time in the preference window.
  const now = new Date();
  let progress = 0;

  if (phase === 'active') {
    const elapsedPreferenceMs = now.getTime() - START_DATE.getTime();
    progress = Math.min(100, Math.max(0, (elapsedPreferenceMs / TOTAL_PREFERENCE_MS) * 100));
  } else if (phase === 'ended') {
    progress = 100;
  }

  return (
    <div className={`w-full h-full max-w-5xl mx-auto ${isStacked ? '' : 'px-6 py-16'}`}>
      <div className={`flex flex-col h-full ${isCompact ? 'justify-between' : isStacked ? 'justify-center' : 'md:flex-row'} items-center ${isCompact ? 'gap-5 rounded-[2rem] p-7 sm:p-8 shadow-xl shadow-surface-900/5' : 'gap-10 rounded-[2rem] p-8 sm:p-12 shadow-xl shadow-surface-900/5'} bg-white border border-surface-200/80 backdrop-blur-sm relative overflow-hidden`}>

        {/* Decorative background element */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-brand-50 rounded-full blur-3xl opacity-60 pointer-events-none"></div>

        {/* Countdown Section */}
        <div className={`${isCompact ? 'flex-none' : 'flex-1'} w-full text-center ${isStacked ? '' : 'md:text-left'} relative z-10`}>
          <div className={`inline-flex items-center gap-2 rounded-full border border-surface-200 px-3 py-1.5 shadow-sm bg-surface-50 text-brand-700 ${isCompact ? 'mb-3' : 'mb-6'}`}>
            <CalendarBlank weight="fill" className="text-brand-500 w-3.5 h-3.5" />
            <span className="text-[10px] font-bold tracking-widest uppercase">2026 YKS Tercih Dönemi</span>
          </div>

          <h2 className={`${isCompact ? 'text-2xl sm:text-[1.7rem]' : 'text-3xl sm:text-4xl'} font-semibold text-surface-900 leading-tight ${isCompact ? 'mb-2' : 'mb-3'}`}>
            {phase === 'upcoming' && 'Tercih Sürecinin Başlamasına'}
            {phase === 'active' && 'Tercih Sürecinin Bitmesine'}
            {phase === 'ended' && 'Tercih Süreci Sona Erdi'}
          </h2>

          <p className={`text-surface-500 ${isCompact ? 'text-sm leading-6' : 'text-sm md:text-base'} max-w-md mx-auto ${isStacked ? '' : 'md:mx-0'} ${isCompact ? 'mb-5' : 'mb-8'}`}>
            Hayalindeki üniversiteye giden yolda en önemli dönemeç. Mentörlerinden destek almayı unutma.
          </p>

          {phase !== 'ended' && (
            <div className={`flex items-center justify-center ${isStacked ? '' : 'md:justify-start'} ${isCompact ? 'gap-2.5 sm:gap-4' : 'gap-4 sm:gap-6'}`}>
              <TimeUnit value={timeLeft.days} label="GÜN" compact={isCompact} />
              <div className="text-2xl font-light text-surface-300 pb-6">:</div>
              <TimeUnit value={timeLeft.hours} label="SAAT" compact={isCompact} />
              <div className="text-2xl font-light text-surface-300 pb-6">:</div>
              <TimeUnit value={timeLeft.minutes} label="DAKİKA" compact={isCompact} />
              <div className="hidden sm:block text-2xl font-light text-surface-300 pb-6">:</div>
              <div className="hidden sm:block"><TimeUnit value={timeLeft.seconds} label="SANİYE" compact={isCompact} /></div>
            </div>
          )}
        </div>

        {/* Timeline Visual Section */}
        <div className={`${isCompact ? 'flex-none' : 'flex-1'} w-full relative z-10`}>
          <div className={`relative ${isCompact ? 'pt-3 pb-0' : 'pt-6 pb-2'}`}>
            {/* Background Line */}
            <div className={`absolute rounded-full bg-surface-100 ${isCompact ? 'left-4 right-4 top-[1.875rem] h-1 sm:left-6 sm:right-6' : 'left-6 right-6 top-[2.75rem] h-1.5 sm:left-8 sm:right-8'}`}>
              <div
                className="h-full rounded-full bg-brand-500 transition-all duration-1000 ease-in-out"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className={`relative flex justify-between ${isCompact ? 'px-4 sm:px-6' : 'px-6 sm:px-8'}`}>

              {/* Start Point */}
              <div className="flex flex-col items-center">
                <div className={`${isCompact ? 'h-9 w-9 border-[3px]' : 'h-10 w-10 border-4'} z-10 flex items-center justify-center rounded-full border-white shadow-sm transition-colors ${phase === 'upcoming' ? 'bg-surface-200 text-surface-500' : 'bg-brand-500 text-white'}`}>
                  <Flag weight="bold" className={isCompact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
                </div>
                <div className={`text-center ${isCompact ? 'mt-2.5' : 'mt-4'}`}>
                  <div className={`${isCompact ? 'text-[13px]' : 'text-sm'} font-bold text-surface-900`}>29 Tem</div>
                  <div className={`${isCompact ? 'text-[11px]' : 'text-xs'} font-medium text-surface-500`}>Başlangıç</div>
                </div>
              </div>

              {/* End Point */}
              <div className="flex flex-col items-center">
                <div className={`${isCompact ? 'h-9 w-9 border-[3px]' : 'h-10 w-10 border-4'} z-10 flex items-center justify-center rounded-full border-white shadow-sm transition-colors ${phase === 'ended' ? 'bg-brand-500 text-white' : phase === 'active' ? 'bg-white border-brand-200 text-brand-500 shadow-brand-500/20' : 'bg-white border-surface-200 text-surface-400'}`}>
                  <FlagCheckered weight="bold" className={isCompact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
                </div>
                <div className={`text-center ${isCompact ? 'mt-2.5' : 'mt-4'}`}>
                  <div className={`${isCompact ? 'text-[13px]' : 'text-sm'} font-bold text-surface-900`}>10 Ağu</div>
                  <div className={`${isCompact ? 'text-[11px]' : 'text-xs'} font-medium text-surface-500`}>Bitiş</div>
                </div>
              </div>

            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

function TimeUnit({ value, label, compact = false }: { value: number, label: string, compact?: boolean }) {
  return (
    <div className={`flex flex-col items-center ${compact ? 'min-w-[56px]' : 'min-w-[70px]'}`}>
      <div className={`${compact ? 'h-14 w-14 sm:h-16 sm:w-16' : 'w-16 h-16 sm:w-20 sm:h-20'} bg-surface-50 rounded-2xl border border-surface-200/60 flex items-center justify-center shadow-sm relative overflow-hidden`}>
        <div className="absolute top-0 w-full h-1/2 bg-white/40"></div>
        <span className={`${compact ? 'text-2xl sm:text-3xl' : 'text-3xl sm:text-4xl'} font-bold text-surface-900 z-10 tabular-nums tracking-tighter`}>
          {value.toString().padStart(2, '0')}
        </span>
      </div>
      <span className="text-[10px] font-bold text-surface-500 mt-3 tracking-widest uppercase">{label}</span>
    </div>
  );
}
