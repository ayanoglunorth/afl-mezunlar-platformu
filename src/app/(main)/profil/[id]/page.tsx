'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useParams } from 'next/navigation';
import type { Profile } from '@/types/database';
import { getInitials, ROLE_LABELS } from '@/lib/utils';
import { UserCircle, GraduationCap, MapPin, Briefcase, Student, Chats, ArrowLeft, LinkedinLogo } from '@phosphor-icons/react/dist/ssr';
import { SiteNotice, type SiteNoticeType } from '@/components/ui/SiteNotice';
import Link from 'next/link';

export default function PublicProfilePage() {
  const router = useRouter();
  const params = useParams();
  const profileId = params.id as string;
  const supabase = useMemo(() => createClient(), []);

  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [matchStatus, setMatchStatus] = useState<string | null>(null); // 'none', 'pending', 'accepted'
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [sendingRequest, setSendingRequest] = useState(false);
  const [notice, setNotice] = useState<{ type: SiteNoticeType; message: string } | null>(null);

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/giris');
        return;
      }

      if (user.id === profileId) {
        // Redirect to own profile editor if they click themselves
        router.replace('/profil');
        return;
      }

      const [{ data: curUser }, { data: targetUser }, { data: match }, { data: adminData }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('profiles').select('*').eq('id', profileId).single(),
        supabase
          .from('matches')
          .select('status')
          .or(`and(user_a.eq.${user.id},user_b.eq.${profileId}),and(user_a.eq.${profileId},user_b.eq.${user.id})`)
          .maybeSingle(),
        supabase.rpc('is_platform_admin'),
      ]);

      if (curUser) setCurrentUser(curUser as Profile);
      if (targetUser) setProfile(targetUser as Profile);
      setIsPlatformAdmin(Boolean(adminData));
      
      if (match) {
        setMatchStatus(match.status);
      } else {
        setMatchStatus('none');
      }

      setLoading(false);
    }

    void loadData();
  }, [profileId, router, supabase]);

  const handleSendRequest = async () => {
    if (!currentUser || !profile) return;
    setSendingRequest(true);
    setNotice(null);

    const userA = currentUser.id < profile.id ? currentUser.id : profile.id;
    const userB = currentUser.id < profile.id ? profile.id : currentUser.id;

    const { error } = await supabase.from('matches').insert({
      user_a: userA,
      user_b: userB,
      status: 'pending',
      requested_by: currentUser.id,
      match_score: 0,
      match_reasons: ['Açık Profil Gösterimi'],
    });

    if (error) {
      setNotice({ type: 'error', message: error.message.includes('duplicate') ? 'Zaten bir eşleşme veya istek mevcut.' : 'Bir hata oluştu.' });
    } else {
      setMatchStatus('pending');
      setNotice({ type: 'success', message: 'Eşleşme isteği başarıyla gönderildi!' });
    }
    
    setSendingRequest(false);
  };

  const handleAdminDirectMessage = async () => {
    if (!profile) return;
    setSendingRequest(true);
    setNotice(null);
    const { data, error } = await supabase.rpc('admin_open_direct_chat', { p_recipient_id: profile.id });
    if (error || !data) {
      setNotice({ type: 'error', message: error?.message || 'Sohbet açılamadı.' });
    } else {
      router.push(`/sohbet/genel/${data}`);
    }
    setSendingRequest(false);
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <svg className="h-8 w-8 animate-spin text-brand-500" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center">
        <UserCircle className="mx-auto h-16 w-16 text-surface-300 mb-4" weight="duotone" />
        <h2 className="text-xl font-bold text-surface-900">Kullanıcı Bulunamadı</h2>
        <p className="mt-2 text-surface-500">Bu profil mevcut değil veya silinmiş olabilir.</p>
        <Link href="/" className="mt-6 inline-flex items-center gap-2 text-brand-600 font-medium hover:text-brand-700">
          <ArrowLeft weight="bold" />
          Ana Sayfaya Dön
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {notice && (
        <div className="mb-6">
          <SiteNotice type={notice.type} message={notice.message} onDismiss={() => setNotice(null)} />
        </div>
      )}
      
      <div className="mb-6 flex items-center">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm font-medium text-surface-500 transition-colors hover:bg-surface-100 hover:text-surface-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30"
        >
          <ArrowLeft weight="bold" className="h-4 w-4" />
          Geri Dön
        </button>
      </div>

      <div className="overflow-hidden rounded-3xl border border-surface-200/80 bg-white shadow-xl shadow-surface-200/20">
        {/* Header Section */}
        <div className="relative h-32 bg-gradient-to-r from-brand-500 to-brand-600 sm:h-48">
          <div className="absolute inset-0 bg-[url('/noise.png')] opacity-10 mix-blend-overlay"></div>
          <div className="absolute left-[15rem] right-10 top-[9rem] hidden min-w-0 -translate-y-1/2 sm:block">
            <h1 className="truncate text-[2rem] font-black leading-tight tracking-tight text-white drop-shadow-sm">{profile.full_name}</h1>
            {profile.nickname && <p className="mt-1 truncate text-base font-semibold leading-snug text-white/80">@{profile.nickname}</p>}
          </div>
        </div>
        
        <div className="relative px-6 pb-8 sm:px-10">
          <div className="-mt-16 flex flex-col sm:-mt-20 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
            <div className="flex items-end gap-5">
              <div className="relative flex h-32 w-32 shrink-0 items-center justify-center rounded-3xl border-4 border-white bg-surface-100 text-3xl font-bold text-surface-600 shadow-lg sm:h-40 sm:w-40 sm:text-5xl">
                {profile.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.avatar_url} alt={profile.full_name} className="h-full w-full rounded-[1.25rem] object-cover" />
                ) : (
                  getInitials(profile.full_name)
                )}
                {/* Role Badge positioned on Avatar */}
                <div className={`absolute -bottom-2 -right-2 flex items-center gap-1.5 rounded-xl border-2 border-white px-3 py-1.5 text-xs font-bold shadow-sm ${
                  profile.role === 'alumni' ? 'bg-emerald-500 text-white' : 
                  profile.role === 'student' ? 'bg-blue-500 text-white' : 
                  'bg-surface-500 text-white'
                }`}>
                  {profile.role === 'alumni' ? <GraduationCap weight="fill" className="h-4 w-4" /> : <Student weight="fill" className="h-4 w-4" />}
                  {ROLE_LABELS[profile.role] || 'Kullanıcı'}
                </div>
              </div>
              
              <div className="mb-2 hidden sm:block">
                {profile.linkedin_url && (
                  <a href={profile.linkedin_url} target="_blank" rel="noopener noreferrer" className="mt-2.5 inline-flex items-center gap-1.5 text-sm font-bold text-[#0A66C2] hover:text-[#004182] transition-colors bg-[#0A66C2]/5 px-3 py-1.5 rounded-lg border border-[#0A66C2]/10">
                    <LinkedinLogo weight="fill" className="h-4 w-4" />
                    LinkedIn Profili
                  </a>
                )}
              </div>
            </div>

            <div className="mt-6 sm:mb-2 sm:mt-0 flex shrink-0">
              {isPlatformAdmin ? (
                <button
                  onClick={handleAdminDirectMessage}
                  disabled={sendingRequest}
                  className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-bold text-white shadow-sm transition-all hover:bg-brand-700 focus-visible:ring-2 focus-visible:ring-brand-500/30 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
                >
                  <Chats weight="bold" className="h-5 w-5" />
                  Mesaj Gönder
                </button>
              ) : matchStatus === 'none' && (
                <button
                  onClick={handleSendRequest}
                  disabled={sendingRequest}
                  className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-bold text-white shadow-sm transition-all hover:bg-brand-700 focus-visible:ring-2 focus-visible:ring-brand-500/30 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
                >
                  {sendingRequest ? (
                    <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <Chats weight="bold" className="h-5 w-5" />
                  )}
                  Eşleşme İsteği Gönder
                </button>
              )}
              {matchStatus === 'pending' && (
                <div className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-50 px-6 py-3 text-sm font-bold text-amber-700 border border-amber-200 sm:w-auto">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  İstek Bekliyor
                </div>
              )}
              {matchStatus === 'accepted' && (
                <Link
                  href="/mesajlar"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-50 px-6 py-3 text-sm font-bold text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors sm:w-auto"
                >
                  <Chats weight="bold" className="h-5 w-5" />
                  Mesaj Gönder
                </Link>
              )}
            </div>
          </div>

          <div className="mt-4 sm:hidden">
            <h1 className="text-2xl font-black text-surface-900 tracking-tight">{profile.full_name}</h1>
            {profile.nickname && <p className="text-base font-medium text-surface-500 mt-0.5">@{profile.nickname}</p>}
            {profile.linkedin_url && (
              <a href={profile.linkedin_url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-[#0A66C2] hover:text-[#004182] transition-colors bg-[#0A66C2]/5 px-3 py-1.5 rounded-lg border border-[#0A66C2]/10">
                <LinkedinLogo weight="fill" className="h-4 w-4" />
                LinkedIn Profili
              </a>
            )}
          </div>

          {/* Details Grid */}
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {/* Bio Section */}
            {profile.bio && (
              <div className="col-span-full rounded-2xl bg-surface-50 p-6">
                <h3 className="text-sm font-bold text-surface-400 uppercase tracking-wider mb-3">Hakkında</h3>
                <p className="text-surface-700 leading-relaxed whitespace-pre-wrap">{profile.bio}</p>
              </div>
            )}

            {/* Academic Info */}
            <div className="rounded-2xl border border-surface-100 p-6">
              <h3 className="text-sm font-bold text-surface-400 uppercase tracking-wider mb-5">Eğitim Bilgileri</h3>
              <ul className="space-y-4">
                {profile.graduation_year && (
                  <li className="flex items-start gap-3">
                    <GraduationCap className="h-5 w-5 text-brand-500 shrink-0 mt-0.5" weight="duotone" />
                    <div>
                      <p className="text-sm font-medium text-surface-900">{profile.graduation_year}</p>
                      <p className="text-xs text-surface-500 mt-0.5">Mezuniyet yılı</p>
                    </div>
                  </li>
                )}
                {profile.university && (
                  <li className="flex items-start gap-3">
                    <GraduationCap className="h-5 w-5 text-brand-500 shrink-0 mt-0.5" weight="duotone" />
                    <div>
                      <p className="text-sm font-medium text-surface-900">{profile.university}</p>
                      <p className="text-xs text-surface-500 mt-0.5">Üniversite</p>
                    </div>
                  </li>
                )}
                {profile.department && (
                  <li className="flex items-start gap-3">
                    <Briefcase className="h-5 w-5 text-brand-500 shrink-0 mt-0.5" weight="duotone" />
                    <div>
                      <p className="text-sm font-medium text-surface-900">{profile.department}</p>
                      <p className="text-xs text-surface-500 mt-0.5">Bölüm</p>
                    </div>
                  </li>
                )}
                {profile.education_status && (
                  <li className="flex items-start gap-3">
                    <Student className="h-5 w-5 text-brand-500 shrink-0 mt-0.5" weight="duotone" />
                    <div>
                      <p className="text-sm font-medium text-surface-900">{profile.education_status}</p>
                      <p className="text-xs text-surface-500 mt-0.5">Sınıf / Durum</p>
                    </div>
                  </li>
                )}
                {profile.target_field && (
                  <li className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-brand-500 shrink-0 mt-0.5" weight="duotone" />
                    <div>
                      <p className="text-sm font-medium text-surface-900">{profile.target_field}</p>
                      <p className="text-xs text-surface-500 mt-0.5">Alan / Hedef</p>
                    </div>
                  </li>
                )}
              </ul>
              {(!profile.graduation_year && !profile.university && !profile.department && !profile.education_status && !profile.target_field) && (
                <p className="text-sm text-surface-500 italic">Eğitim bilgisi girilmemiş.</p>
              )}
            </div>

            {profile.role === 'alumni' && (
              <div className="rounded-2xl border border-surface-100 p-6">
                <h3 className="text-sm font-bold text-surface-400 uppercase tracking-wider mb-5">Kariyer Bilgileri</h3>
                {(profile.company_name || profile.work_title) ? (
                  <ul className="space-y-4">
                    {profile.company_name && (
                      <li className="flex items-start gap-3">
                        <Briefcase className="h-5 w-5 text-brand-500 shrink-0 mt-0.5" weight="duotone" />
                        <div>
                          <p className="text-sm font-medium text-surface-900">{profile.company_name}</p>
                          <p className="text-xs text-surface-500 mt-0.5">Çalıştığı yer</p>
                        </div>
                      </li>
                    )}
                    {profile.work_title && (
                      <li className="flex items-start gap-3">
                        <MapPin className="h-5 w-5 text-brand-500 shrink-0 mt-0.5" weight="duotone" />
                        <div>
                          <p className="text-sm font-medium text-surface-900">{profile.work_title}</p>
                          <p className="text-xs text-surface-500 mt-0.5">Çalışma düzeyi</p>
                        </div>
                      </li>
                    )}
                  </ul>
                ) : (
                  <p className="text-sm text-surface-500 italic">Kariyer bilgisi girilmemiş.</p>
                )}
              </div>
            )}

            {/* Interests & Topics */}
            <div className="rounded-2xl border border-surface-100 p-6">
              <h3 className="text-sm font-bold text-surface-400 uppercase tracking-wider mb-5">
                {profile.role === 'alumni' ? 'Mentorluk Konuları' : 'Beklentiler / İlgi Alanları'}
              </h3>
              
              {profile.interests && profile.interests.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {profile.interests.map((interest, idx) => (
                    <span key={idx} className="inline-flex items-center rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs font-semibold text-brand-700 border border-brand-100">
                      {interest}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-surface-500 italic">Henüz ilgi alanı veya konu seçilmemiş.</p>
              )}
              
            </div>
            
          </div>
        </div>
      </div>
    </div>
  );
}
