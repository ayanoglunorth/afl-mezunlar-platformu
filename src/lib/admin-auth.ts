import 'server-only';

import { createClient } from '@/lib/supabase/server';
import type { AdminPrivilege, Profile } from '@/types/database';

export type AdminContext = {
  userId: string;
  profile: Pick<Profile, 'id' | 'full_name' | 'role'>;
  privilege: AdminPrivilege | null;
  isPlatformAdmin: boolean;
  canManageAdmins: boolean;
};

function isMissingAdminContextRpc(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  const message = error.message?.toLowerCase() || '';
  return (
    error.code === 'PGRST202'
    || error.code === '42883'
    || message.includes('could not find the function')
    || message.includes('function public.admin_get_context')
  );
}

export async function getAdminContext(): Promise<AdminContext | null> {
  const supabase = await createClient();
  const { data: rpcData, error: rpcError } = await supabase.rpc('admin_get_context');

  if (!rpcError && rpcData) {
    const context = rpcData as AdminContext;
    if (!context.profile) return null;
    return {
      userId: context.userId,
      profile: context.profile,
      privilege: context.privilege || null,
      isPlatformAdmin: Boolean(context.isPlatformAdmin),
      canManageAdmins: Boolean(context.canManageAdmins),
    };
  }

  if (rpcError && !isMissingAdminContextRpc(rpcError)) {
    return null;
  }

  const { data } = await supabase.auth.getClaims();

  const userId = data?.claims.sub;
  if (!userId) return null;

  const [{ data: profile }, { data: privilege }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('id', userId)
      .single(),
    supabase
      .from('admin_privileges')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle(),
  ]);

  if (!profile) return null;

  const typedPrivilege = (privilege || null) as AdminPrivilege | null;
  const isPlatformAdmin = profile.role === 'admin' || Boolean(typedPrivilege);

  return {
    userId,
    profile: profile as Pick<Profile, 'id' | 'full_name' | 'role'>,
    privilege: typedPrivilege,
    isPlatformAdmin,
    canManageAdmins: Boolean(typedPrivilege?.can_manage_admins),
  };
}

export async function requirePlatformAdmin() {
  const context = await getAdminContext();
  if (!context?.isPlatformAdmin) return null;
  return context;
}

export async function requireAdminManager() {
  const context = await getAdminContext();
  if (!context?.isPlatformAdmin || !context.canManageAdmins) return null;
  return context;
}
