'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useMemo, useRef, useSyncExternalStore, type MouseEvent as ReactMouseEvent } from 'react';
import { Gear } from '@phosphor-icons/react/dist/ssr';
import { createClient } from '@/lib/supabase/client';
import { getInitials } from '@/lib/utils';
import { SiteNotice } from '@/components/ui/SiteNotice';
import { useRealtime } from '@/components/realtime/RealtimeProvider';

type NavItem = {
  label: string;
  href: string;
  disabled: boolean;
  badge?: string;
  disabledMessage?: string;
};

const NAV_ITEMS: NavItem[] = [
  { label: 'Ana Sayfa', href: '/', disabled: false },
  { label: 'Etkinlik', href: '/etkinlik', disabled: false, badge: 'Yeni' },
  {
    label: 'Topluluk',
    href: '/topluluk',
    disabled: false,
    badge: 'Yeni',
    disabledMessage:
      'Öğrencilerimizin ve mezunlarımızın özgürce paylaşım yapabileceği, tavsiyeler ve kariyer fırsatları paylaşabileceği topluluk alanı.',
  },
  { label: 'Eşleşmeler', href: '/eslesmeler', disabled: false },
  { label: 'Mesajlar', href: '/mesajlar', disabled: false },
];

const disabledFeatureMessage =
  'Bu özellik tercih süreci başladığında erişime açılacaktır.';

export function Navbar() {
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);
  const { profile, loading, isPlatformAdmin, unreadMessages, pendingMatches, unreadNotifications } = useRealtime();
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [notice, setNotice] = useState('');
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );

  const showProfile = mounted && Boolean(profile);
  const showAdminLink = mounted && Boolean(profile) && isPlatformAdmin;

  useEffect(() => {
    function handleOutsideClick(event: globalThis.MouseEvent) {
      if (!profileMenuRef.current?.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setProfileMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  async function handleSignOut() {
    setSigningOut(true);
    setProfileMenuOpen(false);
    const { error } = await supabase.auth.signOut();
    if (error) {
      setSigningOut(false);
      return;
    }
    setSigningOut(false);
    setMobileMenuOpen(false);
    window.location.assign('/');
  }

  function handleDisabledItem(event: ReactMouseEvent<HTMLAnchorElement>, message = disabledFeatureMessage) {
    event.preventDefault();
    setNotice(message);
    window.setTimeout(() => setNotice(''), 3500);
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-surface-200/80 bg-white/94 shadow-[0_1px_0_rgba(17,17,17,0.025)] backdrop-blur-sm">
      {notice && (
        <div className="fixed right-4 top-20 z-[60] w-[min(24rem,calc(100vw-2rem))]">
          <SiteNotice type="info" message={notice} onDismiss={() => setNotice('')} />
        </div>
      )}
      <div className="mx-auto flex h-[72px] w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="group flex min-w-0 items-center gap-2 sm:gap-3 rounded-xl py-2 pr-2 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-500/30"
          aria-label="AFL Mezun Platformu ana sayfa"
        >
          <Image
            src="/afl-logo.svg"
            alt="AFL Logo"
            width={841}
            height={493}
            loading="eager"
            className="h-10 sm:h-11 md:h-12 w-auto shrink-0 transition-transform duration-200 group-hover:scale-[0.97]"
          />
          <span className="flex min-w-0 flex-col justify-center leading-none">
            <span className="text-[8px] sm:text-[10px] font-semibold uppercase tracking-[0.18em] text-surface-500">Akhisar Fen Lisesi</span>
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="truncate text-[13px] sm:text-[15px] md:text-base font-semibold tracking-[-0.015em] text-surface-900">
                Mezunlar Platformu
              </span>
              <span
                className="group/beta relative inline-flex shrink-0 cursor-help rounded-md border border-brand-100 bg-brand-50 px-1.5 py-0.5 text-[9px] font-bold uppercase leading-none tracking-[0.08em] text-brand-700"
              >
                beta
                <span className="pointer-events-none absolute left-1/2 top-full z-[80] mt-2 hidden w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 whitespace-nowrap rounded-xl border border-surface-200 bg-white px-3 py-2 text-left text-xs font-medium normal-case leading-5 tracking-normal text-surface-600 shadow-[0_18px_40px_-24px_rgba(17,17,17,0.45)] group-hover/beta:block group-focus-visible/beta:block">
                  Platformu geliştirmeye devam ediyoruz. <br />
                  Görüş, öneri ve geri bildirimlerinizle bize <br />
                  destek olabilirsiniz.
                </span>
              </span>
            </span>
          </span>
        </Link>

        <div className="hidden min-w-0 flex-1 items-center justify-end gap-4 lg:flex">
          <div className="flex items-center gap-1 rounded-xl border border-transparent bg-transparent p-1">
            {NAV_ITEMS.map((item) => {
              const isActive = !item.disabled && (item.href === '/' ? pathname === '/' : pathname.startsWith(item.href));

              return (
                <Link
                  key={item.href}
                  href={item.disabled ? '#' : item.href}
                  onClick={item.disabled ? (event) => handleDisabledItem(event, item.disabledMessage) : undefined}
                  aria-disabled={item.disabled}
                  className={`group relative inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium outline-none transition-[background-color,color,border-color] duration-200 focus-visible:ring-2 focus-visible:ring-brand-500/30 ${
                    item.disabled
                      ? 'cursor-help text-surface-400'
                      : isActive
                        ? 'bg-brand-50 text-brand-700'
                        : 'text-surface-600 hover:bg-surface-100 hover:text-surface-900'
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    <span>{item.label}</span>
                    {item.badge && !item.disabled && (
                      <span className="absolute -right-3 -top-0.5 inline-flex h-3.5 items-center rounded-[4px] border border-brand-100 bg-brand-50 px-1 text-[8px] font-bold uppercase leading-none tracking-[0.04em] text-brand-700 shadow-[0_4px_10px_-8px_rgba(17,17,17,0.45)]">
                        {item.badge}
                      </span>
                    )}
                    {item.disabled && (
                      <span className="inline-flex h-5 items-center self-center rounded-md border border-surface-200 bg-surface-50 px-1.5 text-[10px] font-semibold uppercase leading-none tracking-[0.08em] text-surface-500">
                        Yakında
                      </span>
                    )}
                  </span>
                  {showProfile && item.href === '/mesajlar' && unreadMessages > 0 && (
                    <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-brand-500 px-1.5 text-[10px] font-bold leading-5 text-white">
                      {unreadMessages}
                    </span>
                  )}
                  {showProfile && item.href === '/eslesmeler' && pendingMatches > 0 && (
                    <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-brand-500 px-1.5 text-[10px] font-bold leading-5 text-white">
                      {pendingMatches}
                    </span>
                  )}
                  {showProfile && item.href === '/topluluk' && unreadNotifications > 0 && (
                    <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold leading-5 text-white">{unreadNotifications}</span>
                  )}
                  {item.disabled && (
                    <span className="pointer-events-none absolute left-0 top-full z-50 mt-2 hidden w-[17rem] rounded-xl border border-surface-200 bg-white px-3 py-2 text-left text-xs leading-5 text-surface-600 shadow-[0_16px_32px_-24px_rgba(17,17,17,0.45)] group-hover:block group-focus-visible:block">
                      {item.disabledMessage || disabledFeatureMessage}
                    </span>
                  )}
                </Link>
              );
            })}

            {showAdminLink && (
              <Link
                href="/admin"
                className="inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium text-amber-600 outline-none transition-colors duration-200 hover:bg-amber-50 hover:text-amber-700 focus-visible:ring-2 focus-visible:ring-amber-500/30"
              >
                Yönetim Paneli
              </Link>
            )}
          </div>


          {mounted && !loading && (
            <div className="flex items-center">
              {showProfile && profile ? (
                <div ref={profileMenuRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setProfileMenuOpen((current) => !current)}
                    className="group inline-flex h-10 cursor-pointer items-center gap-3 rounded-xl border border-transparent px-2.5 pr-3 outline-none transition-colors duration-200 hover:bg-surface-100 focus-visible:ring-2 focus-visible:ring-brand-500/30"
                    aria-label="Profil menüsü"
                    aria-expanded={profileMenuOpen}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-brand-500/20 bg-brand-50 transition-colors duration-200 group-hover:border-brand-500/40">
                      <span className="text-xs font-bold text-brand-600">{getInitials(profile.full_name)}</span>
                    </span>
                    <span className="hidden max-w-40 truncate text-sm font-medium text-surface-700 xl:inline">
                      {profile.full_name}
                    </span>
                    <svg
                      className={`h-4 w-4 text-surface-500 transition-transform duration-200 ${profileMenuOpen ? 'rotate-180' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {profileMenuOpen && (
                    <div className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-surface-200 bg-white p-2 shadow-[0_24px_48px_-24px_rgba(17,17,17,0.28)]">
                      <Link
                        href="/profil"
                        onClick={() => setProfileMenuOpen(false)}
                        className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 text-sm font-medium text-surface-700 outline-none transition-colors duration-200 hover:bg-surface-100 hover:text-surface-900 focus-visible:ring-2 focus-visible:ring-brand-500/30"
                      >
                        <svg className="h-4 w-4 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4a4 4 0 110 8 4 4 0 010-8zm0 10c-3.314 0-6 2.239-6 5v1h12v-1c0-2.761-2.686-5-6-5z" />
                        </svg>
                        <span>Profil</span>
                      </Link>

                      <Link
                        href="/ayarlar"
                        onClick={() => setProfileMenuOpen(false)}
                        className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 text-sm font-medium text-surface-700 outline-none transition-colors duration-200 hover:bg-surface-100 hover:text-surface-900 focus-visible:ring-2 focus-visible:ring-brand-500/30"
                      >
                        <Gear className="h-4 w-4 text-surface-500" weight="bold" aria-hidden="true" />
                        <span>Ayarlar</span>
                      </Link>

                      <button
                        type="button"
                        onClick={handleSignOut}
                        disabled={signingOut}
                        className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-xl px-3 text-sm font-medium text-red-600 outline-none transition-[background-color,color,transform] duration-200 hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-red-500/25 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {signingOut ? (
                          <>
                            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>Çıkış yapılıyor...</span>
                          </>
                        ) : (
                          <>
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            <span>Çıkış Yap</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Link
                    href="/giris"
                    className="inline-flex h-10 items-center rounded-lg px-3 text-sm font-medium text-surface-600 outline-none transition-colors duration-200 hover:bg-surface-100 hover:text-surface-900 focus-visible:ring-2 focus-visible:ring-brand-500/30"
                  >
                    Giriş Yap
                  </Link>
                  <Link href="/kayit" className="btn-primary h-10 px-4 text-sm">
                    Kayıt Ol
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-surface-600 outline-none transition-colors duration-200 hover:bg-surface-100 hover:text-surface-900 focus-visible:ring-2 focus-visible:ring-brand-500/30 lg:hidden"
          aria-label={mobileMenuOpen ? 'Menüyü kapat' : 'Menüyü aç'}
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          )}
        </button>
      </div>

      {mobileMenuOpen && (
        <div className="absolute top-[72px] left-0 right-0 border-b border-surface-200 bg-white shadow-[0_14px_30px_-26px_rgba(17,17,17,0.45)] lg:hidden">
          <div className="mx-auto w-full max-w-7xl space-y-4 px-4 py-4 sm:px-6">
            <div className="space-y-2 border-b border-surface-200 pb-4">
                {NAV_ITEMS.map((item) => {
                  const isActive = !item.disabled && (item.href === '/' ? pathname === '/' : pathname.startsWith(item.href));

                  return (
                    <Link
                      key={item.href}
                      href={item.disabled ? '#' : item.href}
                      onClick={(event) => {
                        if (item.disabled) {
                          handleDisabledItem(event, item.disabledMessage);
                        } else {
                          setMobileMenuOpen(false);
                        }
                      }}
                      aria-disabled={item.disabled}
                      className={`group relative flex min-h-11 items-center justify-between gap-3 rounded-lg px-3 text-sm font-medium outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-brand-500/30 ${
                        item.disabled
                          ? 'cursor-help text-surface-400'
                          : isActive
                            ? 'bg-brand-50 text-brand-700'
                            : 'text-surface-700 hover:bg-surface-100 hover:text-surface-900'
                      }`}
                    >
                      <span className="inline-flex items-center gap-2">
                        <span>{item.label}</span>
                        {item.badge && !item.disabled && (
                          <span className="absolute right-0.5 top-2.5 inline-flex h-3.5 shrink-0 items-center rounded-[4px] border border-brand-100 bg-brand-50 px-1 text-[8px] font-bold uppercase leading-none tracking-[0.04em] text-brand-700">
                            {item.badge}
                          </span>
                        )}
                        {item.disabled && (
                          <span className="inline-flex h-5 shrink-0 items-center self-center rounded-md border border-surface-200 bg-surface-50 px-1.5 text-[10px] font-semibold uppercase leading-none tracking-[0.08em] text-surface-500">
                            Yakında
                          </span>
                        )}
                      </span>
                      {showProfile && item.href === '/mesajlar' && unreadMessages > 0 && (
                        <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-brand-500 px-1.5 text-[10px] font-bold leading-5 text-white">
                          {unreadMessages}
                        </span>
                      )}
                      {showProfile && item.href === '/eslesmeler' && pendingMatches > 0 && (
                        <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-brand-500 px-1.5 text-[10px] font-bold leading-5 text-white">
                          {pendingMatches}
                        </span>
                      )}
                      {showProfile && item.href === '/topluluk' && unreadNotifications > 0 && (
                        <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold leading-5 text-white">{unreadNotifications}</span>
                      )}
                    </Link>
                  );
                })}

                {showAdminLink && (
                  <Link
                    href="/admin"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-amber-600 outline-none transition-colors duration-200 hover:bg-amber-50 hover:text-amber-700 focus-visible:ring-2 focus-visible:ring-amber-500/30"
                  >
                    Yönetim Paneli
                  </Link>
                )}
            </div>

            <div className="space-y-3">
              {showProfile && profile ? (
                <div className="rounded-xl border border-surface-200 bg-surface-50 p-2">
                  <div className="flex min-h-11 items-center gap-3 rounded-lg px-2 text-sm font-medium text-surface-800">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-brand-500/20 bg-brand-50">
                      <span className="text-xs font-bold text-brand-600">{getInitials(profile.full_name)}</span>
                    </span>
                    <span className="truncate">{profile.full_name}</span>
                  </div>
                  <Link
                    href="/profil"
                    onClick={() => setMobileMenuOpen(false)}
                    className="mt-2 flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm font-medium text-surface-700 outline-none transition-colors duration-200 hover:bg-surface-100 hover:text-surface-900 focus-visible:ring-2 focus-visible:ring-brand-500/30"
                  >
                    <svg className="h-4 w-4 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4a4 4 0 110 8 4 4 0 010-8zm0 10c-3.314 0-6 2.239-6 5v1h12v-1c0-2.761-2.686-5-6-5z" />
                    </svg>
                    <span>Profil</span>
                  </Link>
                  <Link
                    href="/ayarlar"
                    onClick={() => setMobileMenuOpen(false)}
                    className="mt-2 flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm font-medium text-surface-700 outline-none transition-colors duration-200 hover:bg-surface-100 hover:text-surface-900 focus-visible:ring-2 focus-visible:ring-brand-500/30"
                  >
                    <Gear className="h-4 w-4 text-surface-500" weight="bold" aria-hidden="true" />
                    <span>Ayarlar</span>
                  </Link>
                  <button
                    onClick={handleSignOut}
                    disabled={signingOut}
                    className="mt-2 flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-sm font-medium text-red-600 outline-none transition-[background-color,color,transform] duration-200 hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-red-500/25 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {signingOut ? (
                      <>
                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Çıkış yapılıyor...</span>
                      </>
                    ) : (
                      <>
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        <span>Çıkış Yap</span>
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="grid gap-2">
                  <Link
                    href="/giris"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex min-h-11 items-center justify-center rounded-lg px-3 text-sm font-medium text-surface-700 outline-none transition-colors duration-200 hover:bg-surface-100 hover:text-surface-900 focus-visible:ring-2 focus-visible:ring-brand-500/30"
                  >
                    Giriş Yap
                  </Link>
                  <Link href="/kayit" onClick={() => setMobileMenuOpen(false)} className="btn-primary min-h-11 px-4 text-sm">
                    Kayıt Ol
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
