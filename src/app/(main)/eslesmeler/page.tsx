'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { SocialRequestRow } from '@/components/social/SocialRequestRow';
import type { Match, MentorshipConversation, MentorshipRequest, Profile } from '@/types/database';
import { generateMentorshipRecommendations, type MentorshipRecommendation } from '@/lib/matching-engine';
import { getInitials, timeAgo } from '@/lib/utils';
import { repairTurkishText, sanitizeProfile, sanitizeProfileUpdate } from '@/lib/turkish-text';
import universitiesData from '@/data/universities.json';
import { MultiSearchableSelect } from '@/components/forms/MultiSearchableSelect';
import { SiteNotice, type SiteNoticeType } from '@/components/ui/SiteNotice';

const allUniversities = Object.keys(universitiesData);
const allDepartments = Array.from(new Set(
  Object.values(universitiesData).flatMap((faculties) =>
    Object.values(faculties).flatMap((deps) => deps)
  )
)).sort((a, b) => a.localeCompare(b, 'tr-TR'));

const EXPECTATIONS = [
  'Meslek ve Bölüm Seçimi',
  'YKS Çalışma Düzeni ve Motivasyon',
  'Üniversite, Staj ve Yurt Dışı',
  'Girişimcilik ve Projeler',
  'Sınav Stresi Yönetimi',
  'Genel Fikir Alışverişi',
];

const TARGET_FIELDS = ['Sayısal', 'Eşit Ağırlık', 'Sözel', 'Dil'];
const STUDENT_GRADES = ['9. Sınıf', '10. Sınıf', '11. Sınıf', '12. Sınıf', 'Mezun'];
const YKS_RETAKE_EDUCATION_STATUS = 'Sınava tekrar hazırlanıyorum.';
const EDUCATION_STATUS_OPTIONS = [YKS_RETAKE_EDUCATION_STATUS, 'Hazırlık', '1. Sınıf', '2. Sınıf', '3. Sınıf', '4. Sınıf', '5. Sınıf', '6. Sınıf', 'Yüksek Lisans / Doktora', 'Mezun'];
const PROFILE_CATALOGS = {
  universities: allUniversities,
  departments: allDepartments,
  expectations: EXPECTATIONS,
  targetFields: TARGET_FIELDS,
  educationStatuses: EDUCATION_STATUS_OPTIONS,
  studentGrades: STUDENT_GRADES,
};

type RequestWithProfiles = MentorshipRequest & {
  student_profile?: Profile;
  mentor_profile?: Profile;
  conversation_id?: string;
};

type SocialRequestListItem = Match & {
  other_profile: Profile;
  request_note: string;
};
type MatchingOverviewPayload = {
  currentUserId: string;
  profile: Profile;
  socialRequests?: SocialRequestListItem[];
  mentorSeeker?: {
    mentors?: Profile[];
    requests?: RequestWithProfiles[];
    activeMentorCounts?: Record<string, number>;
  } | null;
  alumni?: {
    requests?: RequestWithProfiles[];
  } | null;
} | null;

function isMissingMatchingOverviewRpc(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  const message = error.message?.toLowerCase() || '';
  return (
    error.code === 'PGRST202'
    || error.code === '42883'
    || message.includes('could not find the function')
    || message.includes('function public.get_matching_overview')
  );
}

function statusLabel(status: MentorshipRequest['status']) {
  const labels = {
    pending: 'İstek gönderildi',
    accepted: 'Kabul edildi',
    rejected: 'Reddedildi',
    cancelled: 'İptal edildi',
    completed: 'Tamamlandı',
  };
  return labels[status];
}

function statusClass(status: MentorshipRequest['status']) {
  if (status === 'accepted') return 'badge-brand';
  if (status === 'pending') return 'bg-amber-500/10 text-amber-600';
  if (status === 'completed') return 'bg-emerald-500/10 text-emerald-600';
  return 'badge-neutral';
}

function isMentorSeeker(profile: Profile) {
  return profile.role === 'student' || profile.education_status === YKS_RETAKE_EDUCATION_STATUS;
}

function isMentorProfile(profile: Profile) {
  return profile.role === 'alumni' && profile.education_status !== YKS_RETAKE_EDUCATION_STATUS;
}

export default function MatchingPage() {
  const supabase = useMemo(() => createClient(), []);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [recommendations, setRecommendations] = useState<MentorshipRecommendation[]>([]);
  const [requests, setRequests] = useState<RequestWithProfiles[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingTargets, setSavingTargets] = useState(false);
  const [selectedMentor, setSelectedMentor] = useState<MentorshipRecommendation | null>(null);
  const [requestMessage, setRequestMessage] = useState('');
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [socialRequests, setSocialRequests] = useState<SocialRequestListItem[]>([]);
  const [pendingSocialAction, setPendingSocialAction] = useState<string | null>(null);
  const [targetDepartments, setTargetDepartments] = useState<string[]>([]);
  const [targetUniversities, setTargetUniversities] = useState<string[]>([]);
  const [expectations, setExpectations] = useState<string[]>([]);
  const [notice, setNotice] = useState<{ type: SiteNoticeType; message: string } | null>(null);

  const requestByMentor = useMemo(() => {
    return new Map(requests.map((request) => [request.mentor_id, request]));
  }, [requests]);

  const loadData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    const { data: overviewData, error: overviewError } = await supabase.rpc('get_matching_overview');
    if (!overviewError && overviewData) {
      const overview = overviewData as MatchingOverviewPayload;
      if (!overview?.profile) {
        setLoading(false);
        return;
      }

      const currentProfile = sanitizeProfile(overview.profile, PROFILE_CATALOGS);
      setProfile(currentProfile);
      setTargetDepartments(currentProfile.target_departments || []);
      setTargetUniversities(currentProfile.target_universities || []);
      setExpectations(currentProfile.mentorship_expectations || []);
      setSocialRequests((overview.socialRequests || []).map((request) => ({
        ...request,
        other_profile: sanitizeProfile(request.other_profile, PROFILE_CATALOGS),
      })).filter((item) => item.other_profile));

      if (isMentorSeeker(currentProfile)) {
        const activeCounts = new Map<string, number>(
          Object.entries(overview.mentorSeeker?.activeMentorCounts || {}),
        );
        const cleanedMentors = (overview.mentorSeeker?.mentors || [])
          .map((mentor) => sanitizeProfile(mentor, PROFILE_CATALOGS))
          .filter(isMentorProfile);
        setRecommendations(generateMentorshipRecommendations(currentProfile, cleanedMentors, activeCounts));
        setRequests((overview.mentorSeeker?.requests || []) as RequestWithProfiles[]);
      } else if (currentProfile.role === 'alumni') {
        const nextRequests = (overview.alumni?.requests || []).map((request) => ({
          ...request,
          student_profile: request.student_profile ? sanitizeProfile(request.student_profile, PROFILE_CATALOGS) : undefined,
        }));
        const pendingRequestIds = nextRequests
          .filter((request) => request.status === 'pending')
          .map((request) => request.id);
        if (pendingRequestIds.length > 0) {
          void fetch('/api/notifications/cancel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sourceIds: pendingRequestIds }),
          });
        }
        setRecommendations([]);
        setRequests(nextRequests);
      } else {
        setRecommendations([]);
        setRequests([]);
      }

      setLoading(false);
      return;
    }

    if (overviewError && !isMissingMatchingOverviewRpc(overviewError)) {
      setNotice({ type: 'error', message: overviewError.message });
      setLoading(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (!profileData) {
      setLoading(false);
      return;
    }

    const currentProfile = sanitizeProfile(profileData as Profile, PROFILE_CATALOGS);
    setProfile(currentProfile);
    setTargetDepartments(currentProfile.target_departments || []);
    setTargetUniversities(currentProfile.target_universities || []);
    setExpectations(currentProfile.mentorship_expectations || []);

    const { data: socialRequestsData } = await supabase
      .from('matches')
      .select('id, user_a, user_b, status, match_score, match_reasons, requested_by, created_at, responded_at')
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
      .eq('status', 'pending')
      .neq('requested_by', user.id)
      .order('created_at', { ascending: false });

    const pendingSocialRequests = (socialRequestsData || []) as Match[];
    const socialRequestOtherIds = pendingSocialRequests.map((request) => (
      request.user_a === user.id ? request.user_b : request.user_a
    ));
    const { data: socialRequestProfilesData } = socialRequestOtherIds.length > 0
      ? await supabase.from('profiles').select('*').in('id', socialRequestOtherIds)
      : { data: [] };
    const socialRequestProfileById = new Map(
      ((socialRequestProfilesData || []) as Profile[]).map((item) => [
        item.id,
        sanitizeProfile(item, PROFILE_CATALOGS),
      ]),
    );
    setSocialRequests(pendingSocialRequests.map((request) => {
      const otherId = request.user_a === user.id ? request.user_b : request.user_a;
      const requestNote = request.match_reasons.find((reason) => reason.startsWith('Mesaj:'))?.replace(/^Mesaj:\s*/, '').trim()
        || 'Seninle iletişime geçmek istiyor.';

      return {
        ...request,
        other_profile: socialRequestProfileById.get(otherId) as Profile,
        request_note: requestNote,
      };
    }).filter((item) => item.other_profile));

    if (isMentorSeeker(currentProfile)) {
      const [{ data: mentorsData }, { data: requestData }, { data: activeData }, { data: conversationsData }] = await Promise.all([
        supabase.from('profiles').select('*').eq('role', 'alumni'),
        supabase.from('mentorship_requests').select('*').eq('student_id', user.id).order('created_at', { ascending: false }),
        supabase.from('mentorship_requests').select('mentor_id').eq('status', 'accepted'),
        supabase.from('mentorship_conversations').select('*').eq('student_id', user.id),
      ]);

      const activeCounts = new Map<string, number>();
      (activeData || []).forEach((row: { mentor_id: string }) => {
        activeCounts.set(row.mentor_id, (activeCounts.get(row.mentor_id) || 0) + 1);
      });

      const conversationByRequest = new Map(
        ((conversationsData || []) as MentorshipConversation[]).map((conversation) => [conversation.request_id, conversation.id])
      );

      const cleanedMentors = ((mentorsData || []) as Profile[])
        .map((mentor) => sanitizeProfile(mentor, PROFILE_CATALOGS))
        .filter(isMentorProfile);
      setRecommendations(generateMentorshipRecommendations(currentProfile, cleanedMentors, activeCounts));
      setRequests(((requestData || []) as MentorshipRequest[]).map((request) => ({
        ...request,
        conversation_id: conversationByRequest.get(request.id),
      })));
    } else if (currentProfile.role === 'alumni') {
      const [{ data: requestData }, { data: conversationsData }] = await Promise.all([
        supabase
          .from('mentorship_requests')
          .select('*')
          .eq('mentor_id', user.id)
          .in('status', ['pending', 'accepted'])
          .order('created_at', { ascending: false }),
        supabase.from('mentorship_conversations').select('*').eq('mentor_id', user.id),
      ]);

      const requests = (requestData || []) as MentorshipRequest[];
      const pendingRequestIds = requests
        .filter((request) => request.status === 'pending')
        .map((request) => request.id);
      if (pendingRequestIds.length > 0) {
        void fetch('/api/notifications/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourceIds: pendingRequestIds }),
        });
      }
      const studentIds = Array.from(new Set(requests.map((request) => request.student_id)));
      const { data: studentsData } = studentIds.length > 0
        ? await supabase.from('profiles').select('*').in('id', studentIds)
        : { data: [] };
      const studentById = new Map(
        ((studentsData || []) as Profile[]).map((student) => [
          student.id,
          sanitizeProfile(student, PROFILE_CATALOGS),
        ]),
      );
      const conversationByRequest = new Map(
        ((conversationsData || []) as MentorshipConversation[]).map((conversation) => [conversation.request_id, conversation.id])
      );

      setRequests(requests.map((request) => ({
        ...request,
        student_profile: studentById.get(request.student_id),
        conversation_id: conversationByRequest.get(request.id),
      })));
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [loadData]);

  useEffect(() => {
    let refreshTimer: number | null = null;
    const scheduleRefresh = () => {
      if (refreshTimer) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => void loadData(false), 180);
    };
    const channel = supabase
      .channel('matching-live-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mentorship_requests' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mentorship_conversations' }, scheduleRefresh)
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') scheduleRefresh();
      });

    const catchUp = () => {
      if (document.visibilityState === 'visible') scheduleRefresh();
    };
    document.addEventListener('visibilitychange', catchUp);
    window.addEventListener('focus', catchUp);
    return () => {
      if (refreshTimer) window.clearTimeout(refreshTimer);
      document.removeEventListener('visibilitychange', catchUp);
      window.removeEventListener('focus', catchUp);
      void supabase.removeChannel(channel);
    };
  }, [loadData, supabase]);

  async function saveTargets() {
    if (!profile) return;
    setSavingTargets(true);
    const updates = sanitizeProfileUpdate({
      target_departments: targetDepartments,
      target_universities: targetUniversities,
      mentorship_expectations: expectations,
    }, PROFILE_CATALOGS);

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', profile.id);

    if (!error) await loadData();
    else setNotice({ type: 'error', message: error.message });
    setSavingTargets(false);
  }

  async function sendRequest() {
    if (!profile || !selectedMentor || !requestMessage.trim()) return;
    setSubmittingRequest(true);
    const cleanedMessage = repairTurkishText(requestMessage).trim();
    const { error } = await supabase.from('mentorship_requests').insert({
      student_id: profile.id,
      mentor_id: selectedMentor.mentor.id,
      request_message: cleanedMessage,
      status: 'pending',
      match_reasons: selectedMentor.reasons,
      match_score: selectedMentor.score,
    });

    if (error) {
      setNotice({ type: 'error', message: error.message.includes('duplicate') ? 'Bu mentora zaten açık bir isteğin var.' : error.message });
    } else {
      void fetch('/api/mentorship/request-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mentorId: selectedMentor.mentor.id,
          studentName: profile.full_name,
          requestMessage: cleanedMessage,
        }),
      });
      setSelectedMentor(null);
      setRequestMessage('');
      await loadData();
    }
    setSubmittingRequest(false);
  }

  async function respondToRequest(requestId: string, action: 'accepted' | 'rejected' | 'cancelled') {

    if (profile?.role === 'alumni') {
      void fetch('/api/notifications/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceIds: [requestId] }),
      });
    }

    if (action === 'accepted') {
      const { data: conversationId, error } = await supabase.rpc('accept_mentorship_request', { request_id: requestId });
      if (error) {
        setNotice({ type: 'error', message: error.message.includes('capacity') ? 'Aktif öğrenci kapasiten dolu.' : error.message });
      } else {
        const acceptedRequest = requests.find((r) => r.id === requestId);
        const acceptedAt = new Date().toISOString();
        if (conversationId) {
          setRequests((current) => current.map((request) => (
            request.id === requestId
              ? { ...request, status: 'accepted', responded_at: acceptedAt, conversation_id: String(conversationId) }
              : request
          )));
        }
        if (acceptedRequest && conversationId) {
          void fetch('/api/mentorship/accept-notification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              studentId: acceptedRequest.student_id,
              mentorName: profile?.full_name || 'Mentor',
              conversationId,
            }),
          });
        }
      }
    } else {
      const { error } = await supabase
        .from('mentorship_requests')
        .update({ status: action, responded_at: new Date().toISOString() })
        .eq('id', requestId);
      if (error) setNotice({ type: 'error', message: error.message });
    }
    await loadData();
  }

  async function respondToSocialRequest(matchId: string, action: 'accepted' | 'rejected') {
    setPendingSocialAction(`${action}:${matchId}`);
    void fetch('/api/notifications/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceIds: [matchId] }),
    });

    const { error } = await supabase
      .from('matches')
      .update({ status: action, responded_at: new Date().toISOString() })
      .eq('id', matchId);

    setPendingSocialAction(null);
    if (error) {
      setNotice({ type: 'error', message: error.message });
      return;
    }

    await loadData(false);
  }

  async function setAvailability(value: Profile['mentorship_availability']) {
    if (!profile) return;
    const { error } = await supabase
      .from('profiles')
      .update({ mentorship_availability: value })
      .eq('id', profile.id);
    if (!error) {
      setProfile({ ...profile, mentorship_availability: value });
      return;
    }

    const isMissingAvailabilityColumn =
      error.message.includes('mentorship_availability') &&
      error.message.includes('schema cache');

    setNotice({
      type: 'error',
      message: isMissingAvailabilityColumn
        ? 'Uygunluk durumu kaydedilemedi. Supabase veritabanında mentorship_availability kolonu eksik ya da schema cache yenilenmemiş.'
        : error.message,
    });
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-8 w-56" />
        <div className="skeleton h-56" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((item) => <div key={item} className="skeleton h-48" />)}
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const socialRequestsSection = socialRequests.length > 0 ? (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-bold text-surface-900">Sosyal mesaj istekleri</h2>
        <p className="mt-1 text-sm text-surface-500">Sosyal panelden gelen tanışma isteklerini buradan da yönetebilirsin.</p>
      </div>
      <div className="space-y-2">
        {socialRequests.map((request) => (
          <SocialRequestRow
            key={request.id}
            request={request}
            actionLoading={pendingSocialAction === `accepted:${request.id}` || pendingSocialAction === `rejected:${request.id}`}
            onAccept={() => { void respondToSocialRequest(request.id, 'accepted'); }}
            onReject={() => { void respondToSocialRequest(request.id, 'rejected'); }}
          />
        ))}
      </div>
    </section>
  ) : null;

  if (profile.role === 'teacher' || profile.role === 'admin') {
    return (
      <div className="space-y-6 fade-in">
        {notice && <SiteNotice type={notice.type} message={notice.message} onDismiss={() => setNotice(null)} />}
        {socialRequestsSection}
        <div className="card py-10 text-center">
          <h1 className="text-xl font-bold text-surface-900">Tercih mentorluğu öğrenci ve mezun hesaplarına açıktır</h1>
          <p className="mx-auto mt-2 max-w-[54ch] text-sm leading-6 text-surface-500">
            Öğretmen hesabınla profil ve hesap ayarlarını yönetebilirsin. Tercih süreci başladığında öğretmenlere özel takip akışları buradan ayrıca açılabilir.
          </p>
          <Link href="/profil" className="btn-primary mt-5 px-5 py-3 text-sm">
            Profile dön
          </Link>
        </div>
      </div>
    );
  }

  if (profile.role === 'alumni' && !isMentorSeeker(profile)) {
    const activeCount = requests.filter((request) => request.status === 'accepted').length;
    return (
      <div className="space-y-8 fade-in">
        {notice && <SiteNotice type={notice.type} message={notice.message} onDismiss={() => setNotice(null)} />}
        {socialRequestsSection}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-surface-900">Tercih Mentorluğu İstekleri</h1>
            <p className="text-surface-500 mt-1">29 Temmuz-10 Ağustos 2026 YKS tercih döneminde gelen öğrenci isteklerini yönet.</p>
          </div>
          <div className="card py-4">
            <p className="text-xs text-surface-500">Aktif öğrenci</p>
            <p className="text-xl font-bold text-surface-900">{activeCount}/5</p>
          </div>
        </div>

        <div className="card flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-surface-900">Uygunluk durumu</h2>
            <p className="text-sm text-surface-500 mt-1">Uygun değilken öğrenciler seni listede görür, ama kartında bu durum açıkça belirtilir.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setAvailability('active')} className={profile.mentorship_availability === 'active' ? 'btn-primary' : 'btn-secondary'}>
              Aktif
            </button>
            <button onClick={() => setAvailability('unavailable')} className={profile.mentorship_availability === 'unavailable' ? 'btn-primary' : 'btn-secondary'}>
              Şu an uygun değilim
            </button>
          </div>
        </div>

        {requests.length === 0 ? (
          <div className="card text-center py-12">
            <h3 className="text-base font-semibold text-surface-900">Henüz gelen istek yok</h3>
            <p className="text-sm text-surface-500 mt-1.5">Öğrenciler hedeflerini güncelledikçe uygun mentor listelerinde görüneceksin.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => (
              <div key={request.id} className="card space-y-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-brand-500/10 flex items-center justify-center">
                      <span className="text-sm font-bold text-brand-500">{getInitials(request.student_profile?.full_name || 'Öğrenci')}</span>
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-surface-900">
                        <Link href={`/profil/${request.student_id}`} className="hover:underline">
                          {request.student_profile?.full_name || 'Öğrenci'}
                        </Link>
                      </h2>
                      <p className="text-xs text-surface-500">{request.student_profile?.current_grade || 'Sınıf belirtilmemiş'} · {timeAgo(request.created_at)}</p>
                    </div>
                  </div>
                  <span className={`badge ${statusClass(request.status)}`}>{statusLabel(request.status)}</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <Info label="Hedef bölümler" value={(request.student_profile?.target_departments || []).join(', ')} />
                  <Info label="Hedef üniversiteler" value={(request.student_profile?.target_universities || []).join(', ')} />
                  <Info label="Beklentiler" value={(request.student_profile?.mentorship_expectations || []).join(', ')} />
                </div>

                <div className="rounded-xl bg-surface-100 border border-surface-200 p-4">
                  <p className="text-xs font-semibold text-surface-500 mb-1">Zorunlu istek mesajı</p>
                  <p className="text-sm text-surface-800 whitespace-pre-wrap">{request.request_message}</p>
                </div>

                {request.status === 'pending' ? (
                  <div className="flex flex-wrap gap-2">
                    <button disabled={activeCount >= 5} onClick={() => respondToRequest(request.id, 'accepted')} className="btn-primary">
                      Kabul et
                    </button>
                    <button onClick={() => respondToRequest(request.id, 'rejected')} className="btn-secondary">
                      Reddet
                    </button>
                    <button onClick={() => respondToRequest(request.id, 'cancelled')} className="btn-ghost">
                      Şu an uygun değilim
                    </button>
                    {activeCount >= 5 && <span className="badge bg-red-500/10 text-red-500">Kapasite dolu</span>}
                  </div>
                ) : request.conversation_id ? (
                  <Link href={`/sohbet/${request.conversation_id}`} className="btn-primary">
                    Sohbete git
                  </Link>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8 fade-in">
      {notice && <SiteNotice type={notice.type} message={notice.message} onDismiss={() => setNotice(null)} />}
      {socialRequestsSection}
      <div>
        <h1 className="text-2xl font-bold text-surface-900">YKS 2026 Tercih Mentorluğu</h1>
        <p className="text-surface-500 mt-1">Hedeflerini güncelle; mentor önerileri her açılışta canlı profil kriterlerine göre yeniden hesaplansın.</p>
      </div>

      <div className="card space-y-5">
        <div>
          <h2 className="text-base font-semibold text-surface-900">Tercih Hedeflerim</h2>
          <p className="text-sm text-surface-500 mt-1">Değişiklikler eski istek ve sohbetlerini korur; yalnızca yeni öneri sıralamasını etkiler.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Beklentiler</label>
            <div className="relative">
              <select
                value=""
                onChange={(event) => {
                  if (event.target.value && !expectations.includes(event.target.value)) {
                    setExpectations([...expectations, event.target.value]);
                  }
                }}
                className="input appearance-none bg-white pr-11 cursor-pointer"
              >
                <option value="">Beklenti ekle</option>
                {EXPECTATIONS.map((expectation) => <option key={expectation} value={expectation}>{expectation}</option>)}
              </select>
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-surface-400">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                </svg>
              </div>
            </div>
          </div>
        </div>
        <div>
          <label className="label">Hedef bölümler</label>
          <MultiSearchableSelect id="target_departments" options={allDepartments} value={targetDepartments} onChange={setTargetDepartments} placeholder="Bölüm ara..." maxSelections={6} />
        </div>
        <div>
          <label className="label">Hedef üniversiteler</label>
          <MultiSearchableSelect id="target_universities" options={allUniversities} value={targetUniversities} onChange={setTargetUniversities} placeholder="Üniversite ara..." maxSelections={8} />
        </div>
        {expectations.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {expectations.map((expectation) => (
              <button key={expectation} type="button" onClick={() => setExpectations(expectations.filter((item) => item !== expectation))} className="badge badge-brand cursor-pointer">
                {expectation} ×
              </button>
            ))}
          </div>
        )}
        <button onClick={saveTargets} disabled={savingTargets} className="btn-primary">
          {savingTargets ? 'Kaydediliyor...' : 'Hedefleri kaydet ve önerileri yenile'}
        </button>
      </div>

      <div>
        <h2 className="text-base font-semibold text-surface-900 mb-4">Mentor Önerileri</h2>
        {recommendations.length === 0 ? (
          <div className="card text-center py-12">
            <h3 className="text-base font-semibold text-surface-900">Henüz uygun mentor bulunamadı</h3>
            <p className="text-sm text-surface-500 mt-1.5">Hedef bölüm, üniversite veya beklenti alanlarını genişletmeyi deneyebilirsin.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recommendations.map((recommendation) => {
              const existingRequest = requestByMentor.get(recommendation.mentor.id);
              return (
                <div key={recommendation.mentor.id} className="card space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-brand-500/10 flex items-center justify-center">
                        <span className="text-sm font-bold text-brand-500">{getInitials(recommendation.mentor.full_name)}</span>
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-surface-900">
                          <Link href={`/profil/${recommendation.mentor.id}`} className="hover:underline">
                            {recommendation.mentor.full_name}
                          </Link>
                        </h3>
                        <p className="text-xs text-surface-500">{recommendation.mentor.university || 'Üniversite belirtilmemiş'}</p>
                      </div>
                    </div>
                    {existingRequest && <span className={`badge ${statusClass(existingRequest.status)}`}>{statusLabel(existingRequest.status)}</span>}
                  </div>

                  <p className="text-sm text-surface-600">{recommendation.mentor.department || 'Bölüm belirtilmemiş'}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {recommendation.reasons.map((reason) => <span key={reason} className="badge badge-neutral">{reason}</span>)}
                  </div>
                  {recommendation.mentor.mentorship_topics?.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {recommendation.mentor.mentorship_topics.slice(0, 3).map((topic) => <span key={topic} className="text-xs px-2 py-1 rounded-lg bg-brand-500/10 text-brand-600">{topic}</span>)}
                    </div>
                  ) : null}

                  <div className="flex items-center justify-between gap-3 pt-2">
                    <span className={recommendation.isAtCapacity ? 'badge bg-red-500/10 text-red-500' : 'badge badge-brand'}>
                      {recommendation.isAtCapacity ? 'Kapasite dolu' : `${5 - recommendation.activeStudentCount} eşleşme`}
                    </span>
                    {existingRequest?.status === 'accepted' && existingRequest.conversation_id ? (
                      <Link href={`/sohbet/${existingRequest.conversation_id}`} className="btn-primary">Sohbete git</Link>
                    ) : (
                      <button
                        disabled={Boolean(existingRequest && ['pending', 'accepted'].includes(existingRequest.status)) || recommendation.isAtCapacity}
                        onClick={() => setSelectedMentor(recommendation)}
                        className="btn-primary"
                      >
                        İstek gönder
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedMentor && (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card w-full max-w-lg space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-surface-900">{selectedMentor.mentor.full_name} için istek mesajı</h2>
              <p className="text-sm text-surface-500 mt-1">Boş mesajla istek gönderilemez. Neyi sormak istediğini kısa ve net yaz.</p>
            </div>
            <textarea
              value={requestMessage}
              onChange={(event) => setRequestMessage(event.target.value)}
              className="input min-h-36 resize-none"
              placeholder="Merhaba, tercih döneminde özellikle şu bölüm/üniversite kararım için deneyimlerinizi dinlemek isterim..."
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setSelectedMentor(null)} className="btn-ghost">Vazgeç</button>
              <button onClick={sendRequest} disabled={submittingRequest || !requestMessage.trim()} className="btn-primary">
                {submittingRequest ? 'Gönderiliyor...' : 'İsteği gönder'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-xl border border-surface-200 bg-surface-50 p-3">
      <p className="text-xs font-semibold text-surface-500">{label}</p>
      <p className="text-sm text-surface-900 mt-1">{value || 'Belirtilmemiş'}</p>
    </div>
  );
}
