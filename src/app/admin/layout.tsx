import Link from 'next/link';
import Image from 'next/image';
import { AdminNavActions } from './AdminNavActions';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminShell>{children}</AdminShell>;
}

function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-surface-0">
      <nav className="border-b border-surface-200 bg-surface-50">
        <div className="mx-auto flex min-h-[3.5rem] flex-wrap max-w-[88rem] items-center justify-between gap-x-4 gap-y-3 px-4 py-3 sm:h-14 sm:px-6 sm:py-0">
          <div className="flex items-center gap-2 sm:gap-4">
            <Link href="/" className="flex items-center gap-2">
              <Image src="/afl-logo.svg" alt="AFL Logo" width={841} height={493} loading="eager" className="h-8 w-auto" />
            </Link>
            <div className="h-5 w-px bg-surface-200" />
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-surface-400">Admin Alanı</span>
              <span className="text-sm font-semibold text-surface-800">Yönetim Paneli</span>
            </div>
          </div>
          <AdminNavActions />
        </div>
      </nav>
      <main className="mx-auto max-w-[88rem] px-6 py-8">{children}</main>
    </div>
  );
}
