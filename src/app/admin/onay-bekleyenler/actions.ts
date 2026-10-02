'use server';

import { createClient } from '@/lib/supabase/server';
import { requirePlatformAdmin } from '@/lib/admin-auth';
import { revalidatePath } from 'next/cache';

export async function approveAlumni(userId: string) {
  const context = await requirePlatformAdmin();
  if (!context) {
    throw new Error('Yetkisiz işlem');
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('admin_approve_pending_alumni', {
    p_user_id: userId,
  });

  if (error || !data) {
    throw new Error('Onay işlemi sırasında bir hata oluştu.');
  }

  revalidatePath('/admin/onay-bekleyenler');
  revalidatePath('/admin');
  return { success: true };
}

export async function rejectAlumni(userId: string) {
  const context = await requirePlatformAdmin();
  if (!context) {
    throw new Error('Yetkisiz işlem');
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('admin_reject_pending_alumni', {
    p_user_id: userId,
  });

  if (error || !data) {
    throw new Error('Kayıt reddedilemedi.');
  }

  revalidatePath('/admin/onay-bekleyenler');
  revalidatePath('/admin');
  return { success: true };
}

export async function reviewProfileNameChange(requestId: string, action: 'approve' | 'reject') {
  const context = await requirePlatformAdmin();
  if (!context) {
    throw new Error('Yetkisiz işlem');
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('admin_review_profile_name_change', {
    p_request_id: requestId,
    p_action: action,
  });

  if (error || !data) {
    throw new Error(action === 'approve' ? 'Ad soyad talebi onaylanamadı.' : 'Ad soyad talebi reddedilemedi.');
  }

  revalidatePath('/admin/onay-bekleyenler');
  revalidatePath('/admin');
  return { success: true };
}
