import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { PendingAlumniList } from './PendingAlumniList';
import { PendingNameChangeList, type PendingNameChangeItem } from './PendingNameChangeList';
import { SiteNotice } from '@/components/ui/SiteNotice';

export default async function OnayBekleyenlerPage() {
  const supabase = await createClient();

  const [
    { data: pendingAlumni, error },
    { data: pendingNameChanges, error: nameChangeError },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('*')
      .eq('role', 'alumni')
      .eq('is_verified', false)
      .order('created_at', { ascending: false }),
    supabase.rpc('admin_list_profile_name_changes', { p_status: 'pending' }),
  ]);

  if (error) {
    return (
      <SiteNotice type="error" message={`Kullanıcılar yüklenirken bir hata oluştu: ${error.message}`} />
    );
  }

  return (
    <div className="space-y-6 fade-in">
      <div className="flex items-center gap-4">
        <Link href="/admin" className="p-2 -ml-2 rounded-lg hover:bg-surface-100 text-surface-500 transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Onay Bekleyen Mezunlar</h1>
          <p className="mt-1 text-surface-500">Okul numarasını hatırlamadığı veya nakil ile ayrıldığı için manuel onay gerektiren mezun kayıtları.</p>
        </div>
      </div>

      {nameChangeError && (
        <SiteNotice type="error" message={`Ad soyad talepleri yüklenirken bir hata oluştu: ${nameChangeError.message}`} />
      )}

      <div className="card">
        <PendingAlumniList initialAlumni={pendingAlumni || []} />
      </div>

      <div className="card space-y-4">
        <div>
          <h2 className="text-base font-semibold text-surface-900">Ad Soyad Değişikliği Talepleri</h2>
          <p className="mt-1 text-sm text-surface-500">
            Profil sayfasından gönderilen isim değişiklikleri admin onayından sonra uygulanır.
          </p>
        </div>
        <PendingNameChangeList initialRequests={(pendingNameChanges || []) as PendingNameChangeItem[]} />
      </div>
    </div>
  );
}
