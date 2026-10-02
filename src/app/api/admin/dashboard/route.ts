import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requirePlatformAdmin } from '@/lib/admin-auth';
import type { ActiveStudentRegistryEntry, AdminAuditLog, AlumniRegistryEntry, EventInterest, Profile } from '@/types/database';

type AlumniRegistryRow = AlumniRegistryEntry & { has_account: boolean };
type ActiveRegistryRow = Pick<
  ActiveStudentRegistryEntry,
  'id' | 'student_number' | 'school_number' | 'full_name' | 'current_grade' | 'class_section' | 'expected_graduation_year' | 'is_claimed'
>;
type EventInterestRow = EventInterest & {
  profiles?: Pick<Profile, 'full_name' | 'role'> | Pick<Profile, 'full_name' | 'role'>[] | null;
};

const FOOTBALL_EVENT_KEY = 'football-2026';

export async function GET() {
  const context = await requirePlatformAdmin();
  if (!context) {
    return NextResponse.json({ error: 'Y?netici yetkisi gerekli.' }, { status: 403 });
  }

  const supabase = await createClient();

  const [
    { count: totalUsers },
    { count: students },
    { count: alumni },
    { count: teachers },
    { data: alumniRegistryCount },
    { count: activeStudentRegistryCount },
    { count: claimedActiveStudentRegistryCount },
    { count: pendingAlumni },
    { data: mentorshipStatsData },
    { count: totalThreads },
    { count: privilegeAdmins },
    { count: activeSocialMatches },
    { count: pendingSocialMatches },
    { data: verifiedEmailsCount },
    { count: openForumReports },
    { data: recentAdminActions },
    { data: dashboardFeedbacks },
    { count: footballInterestCount },
    { count: footballTeamInterestCount },
    { data: footballInterests },
    { data: directoryUsers },
    { data: alumniRegistryEntries },
    { data: activeStudentRegistryEntries },
    { count: pendingMentorshipRequests },
  ] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'alumni'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'teacher'),
    supabase.rpc('admin_count_alumni_registry'),
    supabase.from('active_student_registry').select('id', { count: 'exact', head: true }),
    supabase.from('active_student_registry').select('id', { count: 'exact', head: true }).eq('is_claimed', true),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'alumni').eq('is_verified', false),
    supabase.rpc('admin_get_mentorship_dashboard_stats'),
    supabase.from('forum_threads_public').select('id', { count: 'exact', head: true }),
    supabase.from('admin_privileges').select('user_id', { count: 'exact', head: true }),
    supabase.from('chat_rooms').select('id', { count: 'exact', head: true }).eq('is_expired', false),
    supabase.from('matches').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.rpc('admin_count_verified_emails'),
    supabase.from('forum_reports').select('id', { count: 'exact', head: true }).in('status', ['open', 'reviewing']),
    supabase.from('admin_audit_logs').select('id, actor_id, target_id, action, created_at').order('created_at', { ascending: false }).limit(8),
    supabase.from('dashboard_feedback').select('id, sender_name, sender_email, sender_role, message, status, created_at').order('created_at', { ascending: false }).limit(12),
    supabase.from('event_interests').select('id', { count: 'exact', head: true }).eq('event_key', FOOTBALL_EVENT_KEY),
    supabase.from('event_interests').select('id', { count: 'exact', head: true }).eq('event_key', FOOTBALL_EVENT_KEY).eq('interest_type', 'team'),
    supabase
      .from('event_interests')
      .select('id, event_key, user_id, interest_type, team_name, estimated_player_count, note, created_at, updated_at, profiles:user_id(full_name, role)')
      .eq('event_key', FOOTBALL_EVENT_KEY)
      .order('updated_at', { ascending: false })
      .limit(12),
    supabase.from('profiles').select('id, full_name, role, student_number, university, department, graduation_year, registration_review_reason, registration_registry_entry_id').order('full_name', { ascending: true }).limit(5000),
    supabase.rpc('admin_list_alumni_registry', { p_limit: 5000 }),
    supabase
      .from('active_student_registry')
      .select('id, student_number, school_number, full_name, current_grade, class_section, expected_graduation_year, is_claimed')
      .order('current_grade', { ascending: true })
      .order('class_section', { ascending: true })
      .order('full_name', { ascending: true })
      .limit(5000),
    supabase.from('mentorship_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
  ]);

  const logs = (recentAdminActions || []) as Pick<AdminAuditLog, 'id' | 'actor_id' | 'target_id' | 'action' | 'created_at'>[];
  const logProfileIds = Array.from(new Set(logs.flatMap((log) => [log.actor_id, log.target_id]).filter(Boolean))) as string[];
  const { data: logProfiles } = logProfileIds.length
    ? await supabase.from('profiles').select('id, full_name').in('id', logProfileIds)
    : { data: [] };
  const profileById = new Map(((logProfiles || []) as Pick<Profile, 'id' | 'full_name'>[]).map((profile) => [profile.id, profile.full_name]));
  const mentorshipStats = Array.isArray(mentorshipStatsData) ? mentorshipStatsData[0] : null;
  const claimedAlumniRegistryCount = ((alumniRegistryEntries || []) as AlumniRegistryRow[]).filter((entry) => entry.has_account).length;
  const footballRows = (footballInterests || []) as EventInterestRow[];

  const activeRows = (activeStudentRegistryEntries || []) as ActiveRegistryRow[];
  const registryEntries = [
    ...((alumniRegistryEntries || []) as AlumniRegistryRow[]).map((entry) => ({
      ...entry,
      registry_kind: 'alumni' as const,
    })),
    ...activeRows.map((entry) => ({
      id: entry.id,
      student_number: entry.student_number,
      school_number: entry.school_number,
      full_name: entry.full_name,
      full_name_normalized: entry.full_name,
      graduation_year: entry.expected_graduation_year,
      expected_graduation_year: entry.expected_graduation_year,
      field_of_study: null,
      current_grade: entry.current_grade,
      class_section: entry.class_section,
      is_claimed: entry.is_claimed,
      uploaded_at: '',
      uploaded_by: null,
      has_account: entry.is_claimed,
      registry_kind: 'active_student' as const,
    })),
  ];

  return NextResponse.json({
    totalUsers: totalUsers ?? 0,
    students: students ?? 0,
    alumni: alumni ?? 0,
    teachers: teachers ?? 0,
    registryCount: Number(alumniRegistryCount ?? 0) + (activeStudentRegistryCount ?? 0),
    alumniRegistryCount: Number(alumniRegistryCount ?? 0),
    activeStudentRegistryCount: activeStudentRegistryCount ?? 0,
    claimedRegistryCount: claimedAlumniRegistryCount + (claimedActiveStudentRegistryCount ?? 0),
    pendingAlumni: pendingAlumni ?? 0,
    activeMentorships: Number(mentorshipStats?.active_conversation_count ?? 0),
    totalMentorshipRequests: pendingMentorshipRequests ?? 0,
    totalThreads: totalThreads ?? 0,
    privilegeAdmins: privilegeAdmins ?? 0,
    activeSocialMatches: activeSocialMatches ?? 0,
    pendingSocialMatches: pendingSocialMatches ?? 0,
    verifiedEmailsCount: Number(verifiedEmailsCount ?? 0),
    openForumReports: openForumReports ?? 0,
    directoryUsers: directoryUsers || [],
    registryEntries,
    recentAdminActions: logs.map((log) => ({
      ...log,
      actor_name: log.actor_id ? profileById.get(log.actor_id) || null : null,
      target_name: log.target_id ? profileById.get(log.target_id) || null : null,
    })),
    dashboardFeedbacks: dashboardFeedbacks || [],
    footballInterestCount: footballInterestCount ?? 0,
    footballTeamInterestCount: footballTeamInterestCount ?? 0,
    footballInterests: footballRows.map((interest) => {
      const profile = Array.isArray(interest.profiles) ? interest.profiles[0] : interest.profiles;
      return {
        id: interest.id,
        user_id: interest.user_id,
        user_name: profile?.full_name || null,
        user_role: profile?.role || null,
        interest_type: interest.interest_type,
        team_name: interest.team_name,
        estimated_player_count: interest.estimated_player_count,
        note: interest.note,
        updated_at: interest.updated_at,
      };
    }),
    conversationReviews: [],
    messageReports: [],
    archivedForumContent: [],
    forumReports: [],
  });
}
