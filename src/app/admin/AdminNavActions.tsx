'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function AdminNavActions() {
  const pathname = usePathname();
  const isUsersPage = pathname === '/admin/kullanicilar';

  return (
    <div className="flex items-center gap-2">
      <Link
        href={isUsersPage ? '/admin' : '/admin/kullanicilar'}
        className="inline-flex items-center justify-center rounded-lg border border-purple-500/20 bg-purple-600 px-4 py-2 text-xs font-semibold text-white shadow-[0_10px_24px_-16px_rgba(51,31,118,0.75)] transition-[background-color,box-shadow,transform] duration-200 hover:bg-purple-700 hover:shadow-[0_14px_30px_-18px_rgba(51,31,118,0.9)] active:scale-[0.98]"
      >
        {isUsersPage ? 'Yönetim Paneli' : 'Kullanıcıları Yönet'}
      </Link>
      <Link
        href="/"
        className="inline-flex items-center justify-center rounded-lg border border-surface-800 bg-surface-900 px-4 py-2 text-xs font-semibold text-white shadow-[0_10px_24px_-16px_rgba(17,17,17,0.55)] transition-[background-color,border-color,box-shadow,transform] duration-200 hover:border-surface-700 hover:bg-surface-800 hover:shadow-[0_14px_30px_-18px_rgba(17,17,17,0.72)] active:scale-[0.98]"
      >
        Lobiye Dön
      </Link>
    </div>
  );
}
