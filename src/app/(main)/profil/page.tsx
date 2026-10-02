'use client';

import { useMemo, useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Profile } from '@/types/database';
import { ROLE_LABELS } from '@/lib/utils';
import { normalizeNickname, repairTurkishText, sanitizeProfile, sanitizeProfileUpdate } from '@/lib/turkish-text';
import universitiesData from '@/data/universities.json';
import { MultiSearchableSelect } from '@/components/forms/MultiSearchableSelect';
import { SearchableSelect } from '@/components/forms/SearchableSelect';
import { CompanyAutocomplete } from '@/components/forms/CompanyAutocomplete';
import { SiteNotice, type SiteNoticeType } from '@/components/ui/SiteNotice';

const allUniversities = Object.keys(universitiesData);
const allDepartments = Array.from(new Set(
  Object.values(universitiesData).flatMap(faculties =>
    Object.values(faculties).flatMap(deps => deps)
  )
)).sort((a, b) => a.localeCompare(b, 'tr-TR'));

const EXPECTATIONS_LIST = [
  'Meslek ve Bölüm Seçimi',
  'YKS Çalışma Düzeni ve Motivasyon',
  'Üniversite, Staj ve Yurt Dışı',
  'Girişimcilik ve Projeler',
  'Sınav Stresi Yönetimi',
  'Genel Fikir Alışverişi',
];

const TARGET_FIELDS = ['Sayısal', 'Eşit Ağırlık', 'Sözel', 'Dil'];

const ALUMNI_TOPICS_LIST = [
  'Üniversite, meslek ve bölüm tanıtımı / tercihler',
  'YKS çalışma düzeni, motivasyon ve taktikler',
  'Sektör tanıtımı ve iş hayatına hazırlık / stajlar',
  'Yurt dışı eğitim imkanları ve Erasmus süreci',
  'Sınav psikolojisi ve stres yönetimi'
];

const STUDENT_GRADES = ['9. Sınıf', '10. Sınıf', '11. Sınıf', '12. Sınıf', 'Mezun'];
const EDUCATION_STATUS_OPTIONS = ['Hazırlık', '1. Sınıf', '2. Sınıf', '3. Sınıf', '4. Sınıf', '5. Sınıf', '6. Sınıf', 'Yüksek Lisans / Doktora', 'Mezun'];
const PROFILE_CATALOGS = {
  universities: allUniversities,
  departments: allDepartments,
  expectations: EXPECTATIONS_LIST,
  targetFields: TARGET_FIELDS,
  educationStatuses: EDUCATION_STATUS_OPTIONS,
  studentGrades: STUDENT_GRADES,
  alumniTopics: ALUMNI_TOPICS_LIST,
};
const PROFILE_SELECT = [
  'id',
  'full_name',
  'nickname',
  'role',
  'university',
  'department',
  'field_of_study',
  'bio',
  'current_grade',
  'target_field',
  'target_departments',
  'target_universities',
  'mentorship_expectations',
  'education_status',
  'is_working',
  'company_name',
  'company_logo',
  'work_title',
  'linkedin_url',
  'mentorship_availability',
  'mentorship_topics',
  'is_verified',
].join(', ');

type PendingNameChange = {
  id: string;
  old_full_name: string;
  requested_full_name: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
};

type ProfileEditPayload = Partial<Profile> & {
  pending_name_change?: PendingNameChange | null;
};

function isMissingCurrentProfileEditRpc(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  const message = error.message?.toLowerCase() || '';
  return (
    error.code === 'PGRST202'
    || error.code === '42883'
    || message.includes('could not find the function')
    || message.includes('function public.get_current_profile_edit')
  );
}

function FieldGroup({
  title,
  icon,
  isEditing,
  onEdit,
  onCancel,
  onSave,
  displayContent,
  editContent,
  saving
}: {
  title: string;
  icon?: React.ReactNode;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  displayContent: React.ReactNode;
  editContent: React.ReactNode;
  saving: boolean;
}) {
  return (
    <div className="relative p-5 sm:p-6 rounded-3xl border border-surface-200/80 bg-white/60 hover:bg-white shadow-[0_2px_8px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.1)] transition-all duration-300 group/field backdrop-blur-md">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3.5">
          {icon && (
            <div className="flex items-center justify-center w-11 h-11 rounded-2xl bg-surface-50 text-surface-600">
              {icon}
            </div>
          )}
          <h3 className="text-[17px] font-bold text-surface-900 tracking-tight">{title}</h3>
        </div>
        {!isEditing && (
          <button
            type="button"
            onClick={onEdit}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-surface-500 hover:text-brand-600 hover:bg-brand-50 rounded-xl transition-all opacity-100 sm:opacity-0 group-hover/field:opacity-100 focus:opacity-100 border border-transparent hover:border-brand-100"
            title="Düzenle"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            <span className="hidden sm:inline">Düzenle</span>
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-5 animate-in fade-in slide-in-from-top-2 duration-300">
          {editContent}
          <div className="flex justify-end gap-3 pt-4 border-t border-surface-100">
            <button type="button" onClick={onCancel} className="btn-ghost text-sm px-5 py-2.5 rounded-xl font-medium" disabled={saving}>İptal</button>
            <button type="button" onClick={onSave} className="btn-primary text-sm px-5 py-2.5 rounded-xl font-medium shadow-md shadow-brand-500/20" disabled={saving}>
              {saving ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Kaydediliyor...
                </span>
              ) : 'Kaydet'}
            </button>
          </div>
        </div>
      ) : (
        <div className="text-surface-700 text-[15px] leading-relaxed">
          {displayContent}
        </div>
      )}
    </div>
  );
}

const DisplayRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex flex-col sm:flex-row sm:items-start py-2.5 border-b border-surface-100/50 last:border-0 last:pb-0 first:pt-0">
    <span className="w-full sm:w-1/3 text-surface-500 font-medium text-sm mb-1 sm:mb-0 pt-0.5">{label}</span>
    <div className="w-full sm:w-2/3 font-medium text-surface-900">{value || <span className="text-surface-400 font-normal italic">Belirtilmemiş</span>}</div>
  </div>
);

const TagList = ({ items, emptyText = 'Belirtilmemiş', theme = 'default' }: { items: string[]; emptyText?: string; theme?: 'default' | 'brand' }) => {
  if (!items || items.length === 0) return <span className="text-surface-400 font-normal italic">{emptyText}</span>;
  return (
    <div className="flex flex-wrap gap-2 pt-0.5">
      {items.map(item => (
        <span key={item} className={`px-3 py-1.5 text-xs font-medium rounded-xl border ${theme === 'brand' ? 'bg-brand-50 text-brand-700 border-brand-100/50' : 'bg-surface-50 text-surface-700 border-surface-200/60'}`}>
          {item}
        </span>
      ))}
    </div>
  );
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ type: SiteNoticeType; message: string } | null>(null);

  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [fullName, setFullName] = useState('');
  const [nickname, setNickname] = useState('');
  const [pendingNameChange, setPendingNameChange] = useState<PendingNameChange | null>(null);

  // Alumni States
  const [educationStatus, setEducationStatus] = useState('');
  const [university, setUniversity] = useState('');
  const [department, setDepartment] = useState('');
  const [isWorking, setIsWorking] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [companyLogo, setCompanyLogo] = useState('');
  const [workTitle, setWorkTitle] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [mentorshipAvailability, setMentorshipAvailability] = useState<Profile['mentorship_availability']>('active');
  const [alumniMentorshipTopics, setAlumniMentorshipTopics] = useState<string[]>([]);

  // Student States
  const [currentGrade, setCurrentGrade] = useState('');
  const [targetField, setTargetField] = useState('');
  const [targetUniversities, setTargetUniversities] = useState<string[]>([]);
  const [targetDepartments, setTargetDepartments] = useState<string[]>([]);
  const [expectations, setExpectations] = useState<string[]>([]);

  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const persistRepairPatch = useMemo(
    () => async (rawProfile: Profile, cleanedProfile: Profile) => {
      const candidatePatch = sanitizeProfileUpdate({
        nickname: rawProfile.nickname,
        university: rawProfile.university,
        department: rawProfile.department,
        field_of_study: rawProfile.field_of_study,
        bio: rawProfile.bio,
        current_grade: rawProfile.current_grade,
        target_field: rawProfile.target_field,
        target_departments: rawProfile.target_departments,
        target_universities: rawProfile.target_universities,
        mentorship_expectations: rawProfile.mentorship_expectations,
        education_status: rawProfile.education_status,
        company_name: rawProfile.company_name,
        work_title: rawProfile.work_title,
        mentorship_topics: rawProfile.mentorship_topics,
      }, PROFILE_CATALOGS);

      const repairPatch = Object.fromEntries(
        Object.entries(candidatePatch).filter(([key, value]) => {
          const rawValue = rawProfile[key as keyof Profile];
          const cleanedValue = cleanedProfile[key as keyof Profile];
          return JSON.stringify(rawValue) !== JSON.stringify(value) && JSON.stringify(cleanedValue) === JSON.stringify(value);
        }),
      ) as Partial<Profile>;

      if (!Object.keys(repairPatch).length) return;
      await supabase.from('profiles').update(repairPatch).eq('id', rawProfile.id);
    },
    [supabase],
  );

  useEffect(() => {
    async function loadProfile() {
      let data: ProfileEditPayload | null = null;
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_current_profile_edit');

      if (!rpcError && rpcData) {
        data = rpcData as ProfileEditPayload;
      } else {
        if (rpcError && !isMissingCurrentProfileEditRpc(rpcError)) {
          setNotice({ type: 'error', message: rpcError.message });
          setLoading(false);
          return;
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }

        const fallback = await supabase
          .from('profiles')
          .select(PROFILE_SELECT)
          .eq('id', user.id)
          .single();
        data = fallback.data as ProfileEditPayload | null;
      }

      if (data) {
        const cleanedProfile = sanitizeProfile(data as Profile, PROFILE_CATALOGS);
        setProfile(cleanedProfile);
        setPendingNameChange(data.pending_name_change || null);
        resetStates(cleanedProfile);
        void persistRepairPatch(data as Profile, cleanedProfile);
      }
      setLoading(false);
    }
    loadProfile();
  }, [persistRepairPatch, supabase]);

  function resetStates(data: Profile) {
    setFullName(data.full_name || '');
    setNickname(data.nickname || '');

    if (data.role === 'alumni') {
      setEducationStatus(data.education_status || '');
      setUniversity(data.university || '');
      setDepartment(data.department || '');
      setIsWorking(data.is_working || false);
      setCompanyName(data.company_name || '');
      setCompanyLogo(data.company_logo || '');
      setWorkTitle(data.work_title || '');
      setLinkedinUrl(data.linkedin_url || '');
      setMentorshipAvailability(data.mentorship_availability || 'active');
      setAlumniMentorshipTopics(data.mentorship_topics || []);
    } else if (data.role === 'student') {
      setCurrentGrade(data.current_grade || '');
      setTargetField(data.target_field || data.field_of_study || '');
      setTargetUniversities(data.target_universities || []);
      setTargetDepartments(data.target_departments || []);
      setExpectations(data.mentorship_expectations || []);
    }
  }

  const handleEdit = (section: string) => {
    if (profile) resetStates(profile); // Reset form to current saved state
    setEditingSection(section);
  };

  const handleCancel = () => {
    if (profile) resetStates(profile);
    setEditingSection(null);
  };

  const saveIdentity = async () => {
    if (!profile) return;

    const rawNickname = nickname.trim();
    const cleanedNickname = normalizeNickname(rawNickname);
    const cleanedFullName = repairTurkishText(fullName);
    const currentFullName = repairTurkishText(profile.full_name);
    const shouldSubmitNameChange = cleanedFullName !== currentFullName;
    const shouldSaveNickname = cleanedNickname !== (profile.nickname || null);

    if (rawNickname && !cleanedNickname) {
      setNotice({ type: 'error', message: 'Nickname 3-32 karakter olmalı; harf, rakam, nokta ve alt çizgi kullanabilirsin.' });
      return;
    }

    if (shouldSubmitNameChange && (cleanedFullName.length < 3 || cleanedFullName.length > 120)) {
      setNotice({ type: 'error', message: 'Ad soyad 3-120 karakter olmalı.' });
      return;
    }

    if (!shouldSubmitNameChange && !shouldSaveNickname) {
      setEditingSection(null);
      return;
    }

    setIsSaving(true);
    setNotice(null);

    if (shouldSaveNickname) {
      const sanitizedUpdates = sanitizeProfileUpdate({ nickname: cleanedNickname }, PROFILE_CATALOGS);
      const { error } = await supabase
        .from('profiles')
        .update(sanitizedUpdates)
        .eq('id', profile.id);

      if (error) {
        const isDuplicateNickname =
          error.code === '23505' || error.message.toLocaleLowerCase('tr-TR').includes('duplicate');
        setNotice({
          type: 'error',
          message: isDuplicateNickname
            ? 'Bu nickname başka bir kullanıcı tarafından kullanılıyor.'
            : `Kaydedilirken bir hata oluştu: ${error.message}`,
        });
        setIsSaving(false);
        return;
      }

      setProfile(prev => prev ? sanitizeProfile({ ...prev, ...sanitizedUpdates }, PROFILE_CATALOGS) : null);
    }

    if (shouldSubmitNameChange) {
      const { data, error } = await supabase.rpc('submit_profile_name_change', {
        p_requested_full_name: cleanedFullName,
      });

      if (error) {
        setNotice({ type: 'error', message: `Ad soyad talebi oluşturulamadı: ${error.message}` });
        setIsSaving(false);
        return;
      }

      setPendingNameChange((data as PendingNameChange | null) || null);
    }

    setEditingSection(null);
    setNotice({
      type: 'success',
      message: shouldSubmitNameChange
        ? 'Profil bilgilerin kaydedildi. Ad soyad değişikliği admin onayından sonra uygulanacak.'
        : 'Profil bilgilerin güncellendi.',
    });
    router.refresh();
    setIsSaving(false);
  };

  const saveSection = async (updates: Partial<Profile>) => {
    if (!profile) return;
    setIsSaving(true);
    setNotice(null);
    const sanitizedUpdates = sanitizeProfileUpdate(updates, PROFILE_CATALOGS);

    const { error } = await supabase
      .from('profiles')
      .update(sanitizedUpdates)
      .eq('id', profile.id);

    if (!error) {
      setProfile(prev => prev ? sanitizeProfile({ ...prev, ...sanitizedUpdates }, PROFILE_CATALOGS) : null);
      setEditingSection(null);
      setNotice({ type: 'success', message: 'Profil bilgilerin güncellendi.' });
      router.refresh();
    } else {
      const isMissingNicknameColumn =
        error.message.includes('nickname') &&
        (error.message.includes('schema cache') || error.message.includes('column'));
      const isDuplicateNickname =
        error.code === '23505' || error.message.toLocaleLowerCase('tr-TR').includes('duplicate');

      if (isMissingNicknameColumn) {
        setNotice({ type: 'error', message: 'Nickname kaydedilemedi. Supabase veritabanında nickname kolonu eksik ya da schema cache yenilenmemiş.' });
        setIsSaving(false);
        return;
      }

      if (isDuplicateNickname) {
        setNotice({ type: 'error', message: 'Bu nickname başka bir kullanıcı tarafından kullanılıyor.' });
        setIsSaving(false);
        return;
      }
      setNotice({ type: 'error', message: `Kaydedilirken bir hata oluştu: ${error.message}` });
    }
    setIsSaving(false);
  };

  if (loading) {
    return (
      <div className="mx-auto flex min-h-[55dvh] max-w-3xl items-center justify-center" aria-live="polite">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-surface-200 bg-white text-brand-600 shadow-sm" aria-label="Profil yükleniyor">
          <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" aria-hidden="true">
            <circle className="opacity-20" cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="3" />
            <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="3" />
          </svg>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-8 fade-in pb-12">
      {/* Header Profile Card */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 p-6 sm:p-8 rounded-[2rem] bg-white border border-surface-200/80 shadow-sm">
        <div className="w-24 h-24 rounded-3xl bg-surface-100 flex items-center justify-center border border-surface-200/50">
          <span className="text-3xl font-black text-surface-900 tracking-tighter">
            {profile.full_name.split(' ').map(w => w[0]).slice(0, 2).join('')}
          </span>
        </div>
        <div className="flex-1">
          <h1 className="text-3xl font-extrabold text-surface-900 tracking-tight mb-2">{profile.full_name}</h1>
          <div className="flex flex-wrap items-center gap-3">
            <span className={`px-3 py-1 rounded-xl text-xs font-bold uppercase tracking-wider ${
              profile.role === 'student' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
              profile.role === 'alumni' ? 'bg-brand-50 text-brand-700 border border-brand-100' :
              profile.role === 'teacher' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
              'bg-purple-50 text-purple-700 border border-purple-100'
            }`}>
              {ROLE_LABELS[profile.role]}
            </span>
            <span className="text-surface-500 text-sm font-medium">AFL Mentörlük Ağı</span>
          </div>
        </div>
        
        <div className="self-start sm:self-center ml-auto">
          <Link
            href="/ayarlar"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-surface-600 bg-surface-50 hover:bg-surface-100 hover:text-surface-900 rounded-xl border border-surface-200 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Ayarlar
          </Link>
        </div>
      </div>

      {profile.role === 'alumni' && !profile.is_verified && (
        <SiteNotice
          type="warning"
          message="Hesabınız onay bekliyor. Kayıt sırasında okul numaranızı hatırlamadığınızı belirttiğiniz için kaydınızın tamamlanması yönetici onayına bağlıdır. Onay sürecinden sonra tüm platform özelliklerine erişebilirsiniz."
        />
      )}

      <div className="space-y-6">
        {notice && (
          <SiteNotice
            type={notice.type}
            message={notice.message}
            onDismiss={() => setNotice(null)}
          />
        )}

        <FieldGroup
          title="Profil Bilgileri"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4a4 4 0 110 8 4 4 0 010-8zm0 10c-3.314 0-6 2.239-6 5v1h12v-1c0-2.761-2.686-5-6-5z" />
            </svg>
          }
          isEditing={editingSection === 'profile_identity'}
          onEdit={() => handleEdit('profile_identity')}
          onCancel={handleCancel}
          saving={isSaving}
          onSave={() => void saveIdentity()}
          displayContent={
            <div className="flex flex-col">
              <DisplayRow label="Ad Soyad" value={profile.full_name} />
              {pendingNameChange && (
                <DisplayRow
                  label="Bekleyen Talep"
                  value={`${pendingNameChange.requested_full_name} (admin onayı bekliyor)`}
                />
              )}
              <DisplayRow label="Nickname" value={profile.nickname ? `@${profile.nickname}` : null} />
            </div>
          }
          editContent={
            <div>
              <div className="mb-4">
                <label className="label" htmlFor="profileFullName">Ad Soyad</label>
                <input
                  id="profileFullName"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Ad Soyad"
                  className="input"
                  minLength={3}
                  maxLength={120}
                />
                <p className="mt-1.5 text-xs text-surface-500">Değişiklik admin onayından sonra profilinde yayınlanır.</p>
              </div>
              <label className="label" htmlFor="profileNickname">Nickname</label>
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-surface-400">@</span>
                <input
                  id="profileNickname"
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value.replace(/^@+/, '').toLocaleLowerCase('en-US'))}
                  placeholder="ornek.nickname"
                  className="input pl-8"
                  minLength={3}
                  maxLength={32}
                  pattern="[a-z0-9][a-z0-9._]{1,30}[a-z0-9]"
                />
              </div>
              <p className="mt-1.5 text-xs text-surface-500">Boş bırakabilirsin. Harf, rakam, nokta ve alt çizgi desteklenir.</p>
            </div>
          }
        />

        {profile.role === 'alumni' && (
          <>
            <FieldGroup
              title="Eğitim Bilgileri"
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path d="M12 14l9-5-9-5-9 5 9 5z" />
                  <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
                </svg>
              }
              isEditing={editingSection === 'alumni_education'}
              onEdit={() => handleEdit('alumni_education')}
              onCancel={handleCancel}
              saving={isSaving}
              onSave={() => saveSection({
                education_status: educationStatus,
                university,
                department,
                is_profile_complete: !!(university && department)
              })}
              displayContent={
                <div className="flex flex-col">
                  <DisplayRow label="Lisans Durumu" value={profile.education_status} />
                  <DisplayRow label="Üniversite" value={profile.university} />
                  <DisplayRow label="Bölüm" value={profile.department} />
                </div>
              }
              editContent={
                <div className="space-y-4">
                  <div>
                    <label className="label">Önümüzdeki güz döneminde lisans kaçıncı sınıfta olacaksınız?</label>
                    <select value={educationStatus} onChange={e => setEducationStatus(e.target.value)} className="input bg-surface-50 focus:bg-white">
                      <option value="">Seçiniz</option>
                      <option value="Hazırlık">Hazırlık</option>
                      <option value="1. Sınıf">1. Sınıf</option>
                      <option value="2. Sınıf">2. Sınıf</option>
                      <option value="3. Sınıf">3. Sınıf</option>
                      <option value="4. Sınıf">4. Sınıf</option>
                      <option value="5. Sınıf">5. Sınıf</option>
                      <option value="6. Sınıf">6. Sınıf</option>
                      <option value="Yüksek Lisans / Doktora">Yüksek Lisans / Doktora</option>
                      <option value="Mezun">Mezun</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Üniversite</label>
                      <SearchableSelect id="university" options={allUniversities} value={university} onChange={setUniversity} placeholder="Üniversite Ara..." />
                    </div>
                    <div>
                      <label className="label">Bölüm</label>
                      <SearchableSelect id="department" options={allDepartments} value={department} onChange={setDepartment} placeholder="Bölüm Ara..." />
                    </div>
                  </div>
                </div>
              }
            />

            <FieldGroup
              title="Kariyer Bilgileri"
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              }
              isEditing={editingSection === 'alumni_career'}
              onEdit={() => handleEdit('alumni_career')}
              onCancel={handleCancel}
              saving={isSaving}
              onSave={() => saveSection({
                is_working: isWorking,
                company_name: isWorking ? companyName : null,
                company_logo: isWorking ? companyLogo : null,
                work_title: isWorking ? workTitle : null,
              })}
              displayContent={
                <div className="flex flex-col">
                  <DisplayRow
                    label="Çalışma Durumu"
                    value={
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${profile.is_working ? 'bg-emerald-50 text-emerald-700' : 'bg-surface-100 text-surface-600'}`}>
                        {profile.is_working ? 'Çalışıyor' : 'Çalışmıyor'}
                      </span>
                    }
                  />
                  {profile.is_working && (
                    <>
                      <DisplayRow
                        label="Şirket"
                        value={
                          <div className="flex items-center gap-2">
                            {profile.company_logo && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={profile.company_logo} alt="logo" className="w-5 h-5 rounded-sm object-contain bg-white" />
                            )}
                            <span>{profile.company_name}</span>
                          </div>
                        }
                      />
                      <DisplayRow label="Çalışma Düzeyi" value={profile.work_title} />
                    </>
                  )}
                </div>
              }
              editContent={
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-xl border border-surface-200 bg-surface-50/50">
                    <div>
                      <div className="text-sm font-semibold text-surface-900">Aktif Olarak Çalışıyor musunuz?</div>
                      <div className="text-xs text-surface-500 mt-0.5">Bir şirkette veya kurumda çalışıyorsanız işaretleyin</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer scale-110">
                      <input type="checkbox" className="sr-only peer" checked={isWorking} onChange={(e) => setIsWorking(e.target.checked)} />
                      <div className="w-11 h-6 bg-surface-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-surface-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-500"></div>
                    </label>
                  </div>
                  {isWorking && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-top-2 pt-2">
                      <div>
                        <label className="label">Şirket Adı</label>
                        <CompanyAutocomplete value={companyName} logo={companyLogo} onChange={(n, l) => { setCompanyName(n); setCompanyLogo(l); }} />
                      </div>
                      <div>
                        <label className="label">Çalışma Düzeyi</label>
                        <select value={workTitle} onChange={e => setWorkTitle(e.target.value)} className="input bg-surface-50 focus:bg-white">
                          <option value="">Seçiniz</option>
                          <option value="Stajyer">Stajyer</option>
                          <option value="Yeni Mezun / Junior">Yeni Mezun / Junior</option>
                          <option value="Uzman / Mid-Level">Uzman / Mid-Level</option>
                          <option value="Kıdemli / Senior">Kıdemli / Senior</option>
                          <option value="Yönetici / Manager">Yönetici / Manager</option>
                          <option value="Kurucu / Founder">Kurucu / Founder</option>
                          <option value="Freelance / Bağımsız">Freelance / Bağımsız</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              }
            />

            <FieldGroup
              title="Bağlantılar"
              icon={
                <svg className="w-5 h-5 text-[#0A66C2]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
              }
              isEditing={editingSection === 'alumni_links'}
              onEdit={() => handleEdit('alumni_links')}
              onCancel={handleCancel}
              saving={isSaving}
              onSave={() => saveSection({ linkedin_url: linkedinUrl || null })}
              displayContent={
                <div className="flex flex-col">
                  <DisplayRow
                    label="LinkedIn Profili"
                    value={
                      profile.linkedin_url ? (
                        <a href={profile.linkedin_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0A66C2]/10 text-[#0A66C2] font-semibold hover:bg-[#0A66C2]/20 transition-colors w-fit">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                          Profili Görüntüle
                        </a>
                      ) : null
                    }
                  />
                </div>
              }
              editContent={
                <div>
                  <label className="label">LinkedIn Profil Linki</label>
                  <input type="url" value={linkedinUrl} onChange={e => setLinkedinUrl(e.target.value)} className="input bg-surface-50 focus:bg-white" placeholder="https://linkedin.com/in/username" />
                </div>
              }
            />

            <FieldGroup
              title="Mentörlük Tercihleri"
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              }
              isEditing={editingSection === 'alumni_mentorship'}
              onEdit={() => handleEdit('alumni_mentorship')}
              onCancel={handleCancel}
              saving={isSaving}
              onSave={() => saveSection({
                mentorship_capacity: 5,
                mentorship_availability: mentorshipAvailability,
                mentorship_topics: alumniMentorshipTopics
              })}
              displayContent={
                <div className="flex flex-col">
                  <DisplayRow label="Kapasite" value="En fazla 5 aktif öğrenci" />
                  <DisplayRow label="Uygunluk" value={profile.mentorship_availability === 'unavailable' ? 'Şu an uygun değil' : 'Aktif'} />
                  <DisplayRow label="Mentorluk Konuları" value={<TagList items={profile.mentorship_topics || []} theme="brand" />} />
                </div>
              }
              editContent={
                <div className="space-y-5">
                  <div className="rounded-xl border border-surface-200 bg-surface-50 p-4">
                    <p className="text-sm font-semibold text-surface-900">Tercih mentorluğu kapasitesi</p>
                    <p className="text-xs text-surface-500 mt-1">2026 tercih mentorluğu için kapasite en fazla 5 aktif öğrenci olarak uygulanır.</p>
                  </div>
                  <div>
                    <label className="label">Uygunluk durumu</label>
                    <select value={mentorshipAvailability} onChange={e => setMentorshipAvailability(e.target.value as Profile['mentorship_availability'])} className="input w-full sm:w-64 bg-surface-50 focus:bg-white">
                      <option value="active">Aktif</option>
                      <option value="unavailable">Şu an uygun değil</option>
                    </select>
                  </div>
                  <div>
                    <label className="label mb-3">Hangi Konularda Mentörlük Verebilirsiniz?</label>
                    <div className="grid grid-cols-1 gap-2.5">
                      {ALUMNI_TOPICS_LIST.map((topic) => (
                        <label key={topic} className="flex items-center gap-3 p-3.5 rounded-xl border border-surface-200 cursor-pointer hover:bg-surface-50 hover:border-surface-300 transition-all group/checkbox">
                          <input
                            type="checkbox"
                            checked={alumniMentorshipTopics.includes(topic)}
                            onChange={(e) => {
                              if (e.target.checked) setAlumniMentorshipTopics([...alumniMentorshipTopics, topic]);
                              else setAlumniMentorshipTopics(alumniMentorshipTopics.filter(t => t !== topic));
                            }}
                            className="w-5 h-5 rounded-[6px] border-surface-300 text-brand-500 focus:ring-brand-500/30 transition-colors"
                          />
                          <span className="text-sm font-medium text-surface-700 group-hover/checkbox:text-surface-900">{topic}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              }
            />
          </>
        )}

        {profile.role === 'student' && (
          <>
            <FieldGroup
              title="Eğitim Durumu"
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
                </svg>
              }
              isEditing={editingSection === 'student_grade'}
              onEdit={() => handleEdit('student_grade')}
              onCancel={handleCancel}
              saving={isSaving}
              onSave={() => saveSection({ current_grade: currentGrade })}
              displayContent={
                <div className="flex flex-col">
                  <DisplayRow label="Mevcut Sınıf" value={profile.current_grade} />
                </div>
              }
              editContent={
                <div>
                  <label className="label">Kaçıncı Sınıftasın?</label>
                  <select value={currentGrade} onChange={e => setCurrentGrade(e.target.value)} className="input w-full sm:w-64 bg-surface-50 focus:bg-white">
                    <option value="">Seçiniz</option>
                    <option value="Hazırlık">Hazırlık</option>
                    <option value="9. Sınıf">9. Sınıf</option>
                    <option value="10. Sınıf">10. Sınıf</option>
                    <option value="11. Sınıf">11. Sınıf</option>
                    <option value="12. Sınıf">12. Sınıf</option>
                    <option value="Mezun (Sınava Hazırlanıyor)">Mezun (Sınava Hazırlanıyor)</option>
                  </select>
                </div>
              }
            />

            <FieldGroup
              title="Akademik Hedefler"
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
              isEditing={editingSection === 'student_targets'}
              onEdit={() => handleEdit('student_targets')}
              onCancel={handleCancel}
              saving={isSaving}
              onSave={() => saveSection({
                target_field: targetField,
                field_of_study: targetField,
                target_universities: targetUniversities,
                target_departments: targetDepartments
              })}
              displayContent={
                <div className="flex flex-col">
                  <DisplayRow label="Hedef Alan" value={profile.target_field || profile.field_of_study} />
                  <DisplayRow label="Hedef Üniversiteler" value={<TagList items={profile.target_universities || []} theme="brand" />} />
                  <DisplayRow label="Hedef Bölümler" value={<TagList items={profile.target_departments || []} />} />
                </div>
              }
              editContent={
                <div className="space-y-5">
                  <div>
                    <label className="label">Hedef Alan</label>
                    <select value={targetField} onChange={e => setTargetField(e.target.value)} className="input w-full sm:w-64 bg-surface-50 focus:bg-white">
                      <option value="">Seçiniz</option>
                      {TARGET_FIELDS.map(field => <option key={field} value={field}>{field}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Hedef Üniversiteler</label>
                    <MultiSearchableSelect id="target_universities" options={allUniversities} value={targetUniversities} onChange={setTargetUniversities} placeholder="Üniversite ara..." />
                  </div>
                  <div>
                    <label className="label">Hedef Bölümler</label>
                    <MultiSearchableSelect id="target_departments" options={allDepartments} value={targetDepartments} onChange={setTargetDepartments} placeholder="Bölüm ara..." />
                  </div>
                </div>
              }
            />

            <FieldGroup
              title="Mentörlük Beklentileri"
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              }
              isEditing={editingSection === 'student_expectations'}
              onEdit={() => handleEdit('student_expectations')}
              onCancel={handleCancel}
              saving={isSaving}
              onSave={() => saveSection({ mentorship_expectations: expectations })}
              displayContent={
                <div className="flex flex-col">
                  <DisplayRow label="Beklentiler" value={<TagList items={profile.mentorship_expectations || []} theme="brand" />} />
                </div>
              }
              editContent={
                <div className="space-y-3">
                  <label className="label mb-2">Mentorluk Beklentisi</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {EXPECTATIONS_LIST.map((exp) => (
                      <label key={exp} className="flex items-center gap-3 p-3.5 rounded-xl border border-surface-200 cursor-pointer hover:bg-surface-50 hover:border-surface-300 transition-all group/checkbox">
                        <input
                          type="checkbox"
                          checked={expectations.includes(exp)}
                          onChange={() => setExpectations(prev => prev.includes(exp) ? prev.filter(e => e !== exp) : [...prev, exp])}
                          className="w-5 h-5 rounded-[6px] border-surface-300 text-brand-500 focus:ring-brand-500/30 transition-colors"
                        />
                        <span className="text-sm font-medium text-surface-700 group-hover/checkbox:text-surface-900">{exp}</span>
                      </label>
                    ))}
                  </div>
                </div>
              }
            />
          </>
        )}
      </div>
    </div>
  );
}
