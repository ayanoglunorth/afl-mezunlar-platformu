'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { EyeSlash, ShieldCheck } from '@phosphor-icons/react';

const STORAGE_KEY = 'forum-privacy-mode';

type ForumPrivacyContextValue = {
  isAnonymous: boolean;
  setIsAnonymous: (value: boolean) => void;
};

const ForumPrivacyContext = createContext<ForumPrivacyContextValue | null>(null);

export function ForumPrivacyProvider({ children }: { children: React.ReactNode }) {
  const [isAnonymous, setIsAnonymousState] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setIsAnonymousState(window.sessionStorage.getItem(STORAGE_KEY) === 'anonymous');
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function setIsAnonymous(value: boolean) {
    setIsAnonymousState(value);
    window.sessionStorage.setItem(STORAGE_KEY, value ? 'anonymous' : 'normal');
  }

  const value = useMemo(() => ({ isAnonymous, setIsAnonymous }), [isAnonymous]);
  return <ForumPrivacyContext.Provider value={value}>{children}</ForumPrivacyContext.Provider>;
}

export function useForumPrivacy() {
  const context = useContext(ForumPrivacyContext);
  if (!context) throw new Error('ForumPrivacyProvider eksik');
  return context;
}

export function ForumPrivacyToggle() {
  const { isAnonymous, setIsAnonymous } = useForumPrivacy();

  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-surface-200 bg-white p-1 shadow-[0_12px_28px_-24px_rgba(17,17,17,0.45)]" aria-label="Topluluk paylaşım modu">
      <button
        type="button"
        onClick={() => setIsAnonymous(false)}
        aria-pressed={!isAnonymous}
        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-colors ${!isAnonymous ? 'bg-surface-900 text-white' : 'text-surface-500 hover:bg-surface-50 hover:text-surface-900'}`}
      >
        <ShieldCheck className="h-3.5 w-3.5" weight="bold" />
        Normal paylaşım
      </button>
      <button
        type="button"
        onClick={() => setIsAnonymous(true)}
        aria-pressed={isAnonymous}
        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-colors ${isAnonymous ? 'bg-amber-500 text-white' : 'text-surface-500 hover:bg-surface-50 hover:text-surface-900'}`}
      >
        <EyeSlash className="h-3.5 w-3.5" weight="bold" />
        Incognito / Anonim
      </button>
    </div>
  );
}
