import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAdminManager, requirePlatformAdmin } from '@/lib/admin-auth';
import type { AdminAuditLog, AdminPrivilege, Profile, RegistrationReviewReason, UserRole } from '@/types/database';

type AdminAction = 'grant_admin' | 'revoke_admin' | 'grant_manager' | 'revoke_manager' | 'delete_user';

type AdminUserRow = Pick<
  Profile,
  | 'id'
  | 'full_name'
  | 'role'
  | 'student_number'
  | 'university'
  | 'department'
  | 'graduation_year'
  | 'is_profile_complete'
  | 'created_at'
> & {
  registration_review_reason?: RegistrationReviewReason | null;
  registration_registry_entry_id?: number | null;
  admin_privilege: AdminPrivilege | null;
  is_platform_admin: boolean;
  can_manage_admins: boolean;
  email: string | null;
};

const PRIVILEGE_ACTIONS = new Set<string>(['grant_admin', 'revoke_admin', 'grant_manager', 'revoke_manager']);

function readBoundedInteger(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), min), max);
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q')?.trim().toLocaleLowerCase('tr-TR') || '';
  const limit = readBoundedInteger(searchParams.get('limit'), 5000, 1, 5000);
  const offset = readBoundedInteger(searchParams.get('offset'), 0, 0, 10000);

  const context = await requirePlatformAdmin();
  if (!context) {
    return NextResponse.json({ error: 'Y?netici yetkisi gerekli.' }, { status: 403 });
  }

  const supabase = await createClient();
  const profilesQuery = supabase
    .from('profiles')
    .select('id, full_name, role, student_number, university, department, graduation_year, is_profile_complete, registration_review_reason, registration_registry_entry_id, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (query) {
    profilesQuery.or([
      'full_name.ilike.%' + query + '%',
      'student_number.ilike.%' + query + '%',
      'university.ilike.%' + query + '%',
      'department.ilike.%' + query + '%',
    ].join(','));
  }

  const [
    { data: profilesData, count: totalCount },
    { data: privilegesData },
    { data: logsData },
    { count: legacyAdminCount },
  ] = await Promise.all([
    profilesQuery,
    supabase.from('admin_privileges').select('*'),
    supabase.from('admin_audit_logs').select('id, actor_id, target_id, action, created_at').order('created_at', { ascending: false }).limit(50),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin'),
  ]);

  const privilegeByUserId = new Map(
    ((privilegesData || []) as AdminPrivilege[]).map((privilege) => [privilege.user_id, privilege]),
  );

  const users = ((profilesData || []) as AdminUserRow[]).map((profile) => {
    const adminPrivilege = privilegeByUserId.get(profile.id) || null;
    return {
      ...profile,
      admin_privilege: adminPrivilege,
      is_platform_admin: profile.role === 'admin' || Boolean(adminPrivilege),
      can_manage_admins: Boolean(adminPrivilege?.can_manage_admins),
      email: null,
    };
  });

  const logs = (logsData || []) as Pick<AdminAuditLog, 'id' | 'actor_id' | 'target_id' | 'action' | 'created_at'>[];
  const logProfileIds = Array.from(new Set(logs.flatMap((log) => [log.actor_id, log.target_id]).filter(Boolean))) as string[];
  const { data: logProfiles } = logProfileIds.length
    ? await supabase.from('profiles').select('id, full_name').in('id', logProfileIds)
    : { data: [] };
  const profileById = new Map(((logProfiles || []) as Pick<Profile, 'id' | 'full_name'>[]).map((profile) => [profile.id, profile.full_name]));
  const auditLogs = logs.map((log) => ({
    ...log,
    actor_name: log.actor_id ? profileById.get(log.actor_id) || null : null,
    target_name: log.target_id ? profileById.get(log.target_id) || null : null,
  }));

  const nextOffset = offset + users.length;

  return NextResponse.json({
    users,
    auditLogs,
    currentUserId: context.userId,
    canManageAdmins: context.canManageAdmins,
    totalCount: totalCount ?? nextOffset,
    adminCount: Math.max(legacyAdminCount ?? 0, privilegeByUserId.size),
    adminManagerCount: ((privilegesData || []) as AdminPrivilege[]).filter((privilege) => privilege.can_manage_admins).length,
    hasMore: nextOffset < (totalCount ?? nextOffset),
    nextOffset,
  });
}

export async function PATCH(request: NextRequest) {
  const context = await requireAdminManager();
  if (!context) {
    return NextResponse.json({ error: 'Admin y?netme yetkisi gerekli.' }, { status: 403 });
  }

  const body = await request.json();
  const action = body.action as AdminAction;
  const targetUserId = String(body.targetUserId || '');
  const demoteTo = body.demoteTo as UserRole | undefined;

  if (!targetUserId || !action) {
    return NextResponse.json({ error: 'Eksik istek.' }, { status: 400 });
  }

  const supabase = await createClient();

  if (PRIVILEGE_ACTIONS.has(action)) {
    const { data, error } = await supabase.rpc('admin_manage_privilege', {
      p_action: action,
      p_target_user_id: targetUserId,
      p_demote_to: demoteTo || null,
    });

    if (error) {
      console.error('Admin privilege RPC failed:', error.message);
      return NextResponse.json({ error: '??lem tamamlanamad?.' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: '??lem g?venlik kurallar? nedeniyle uygulanamad?.' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  }

  if (action === 'delete_user') {
    const { data, error } = await supabase.rpc('admin_delete_platform_user', {
      p_user_id: targetUserId,
    });

    if (error) {
      console.error('Admin delete user RPC failed:', error.message);
      return NextResponse.json({ error: 'Kullan?c? silinemedi.' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Kullan?c? g?venlik kurallar? nedeniyle silinemedi.' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Ge?ersiz i?lem.' }, { status: 400 });
}
