'use client';

import { useEffect, useState } from 'react';
import { SocialBoard } from '@/components/dashboard/SocialBoard';

export function DeferredSocialBoard() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), 700);
    return () => window.clearTimeout(timer);
  }, []);

  if (!ready) {
    return (
      <aside
        className="flex h-[34rem] max-h-[calc(100dvh-6rem)] self-start flex-col overflow-hidden rounded-2xl border border-surface-200/80 bg-white/95 p-4 shadow-[0_1px_2px_rgba(17,17,17,0.04),0_18px_42px_-36px_rgba(17,17,17,0.28)]"
        aria-label="Sosyal board yükleniyor"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="skeleton h-5 w-20 rounded-lg" />
            <div className="skeleton mt-2 h-4 w-40 rounded-lg" />
          </div>
          <div className="skeleton h-7 w-20 rounded-full" />
        </div>
        <div className="mt-4 space-y-2">
          {[1, 2, 3, 4, 5].map((item) => (
            <div key={item} className="skeleton h-14 rounded-xl" />
          ))}
        </div>
      </aside>
    );
  }

  return <SocialBoard />;
}
