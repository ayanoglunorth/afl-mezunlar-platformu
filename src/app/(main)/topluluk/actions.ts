'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { ForumCategory, ForumReactionTargetType, ForumReactionType, ForumReportReason, Profile } from '@/types/database';

type VerifiedForumUser = Pick<Profile, 'id' | 'role' | 'is_verified'>;

const VALID_REACTIONS: ForumReactionType[] = ['like', 'heart', 'insightful', 'celebrate', 'thanks'];
const VALID_REPORT_REASONS: ForumReportReason[] = ['spam', 'abuse', 'privacy', 'off_topic', 'other'];
const USER_CATEGORY_COLOR = '#2b8950';
const USER_CATEGORY_ICON_KEY = 'chat';

type ForumCategoryOption = Pick<ForumCategory, 'id' | 'slug' | 'name' | 'description' | 'icon' | 'color' | 'icon_key' | 'sort_order' | 'is_active' | 'created_by' | 'is_user_created'>;

function readString(formData: FormData, key: string, maxLength: number) {
  const value = String(formData.get(key) || '').trim();
  return value.slice(0, maxLength);
}

function createCategorySlug(name: string) {
  const normalized = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ğ/g, 'g')
    .replace(/Ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/Ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/Ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/Ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/Ç/g, 'c')
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 56);

  return normalized || 'kategori';
}

function readIds(formData: FormData, key: string) {
  const values = formData.getAll(key).flatMap((entry) => String(entry).split(','));
  return Array.from(
    new Set(
      values
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
}

async function requireVerifiedForumUserForClient(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Topluluk için giriş yapmalısın.');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, is_verified')
    .eq('id', user.id)
    .single();

  if (!profile?.is_verified) {
    throw new Error('Topluluk yalnızca doğrulanmış platform kullanıcılarına açıktır.');
  }

  return profile as VerifiedForumUser;
}

async function requireVerifiedForumUser() {
  const supabase = await createClient();
  const user = await requireVerifiedForumUserForClient(supabase);
  return { supabase, user };
}

async function isPlatformAdmin(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase.rpc('is_platform_admin', { p_user_id: userId });
  return Boolean(data);
}

function isMissingRpcError(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  const message = error.message?.toLowerCase() || '';
  return (
    error.code === 'PGRST202'
    || error.code === '42883'
    || message.includes('could not find the function')
    || message.includes('function public.toggle_forum_reaction')
  );
}

function readBoolean(formData: FormData, key: string) {
  return String(formData.get(key) || '').toLowerCase() === 'true';
}

export async function createForumCategory(formData: FormData): Promise<ForumCategoryOption> {
  const { supabase, user } = await requireVerifiedForumUser();
  const name = readString(formData, 'categoryName', 40);

  if (name.length < 3) {
    throw new Error('Kategori adı en az 3 karakter olmalı.');
  }

  const baseSlug = createCategorySlug(name);
  const { data: existingCategory } = await supabase
    .from('forum_categories')
    .select('id, slug, name, description, icon, color, icon_key, sort_order, is_active, created_by, is_user_created')
    .eq('slug', baseSlug)
    .eq('is_active', true)
    .maybeSingle();

  if (existingCategory) {
    return existingCategory as ForumCategoryOption;
  }

  const { count } = await supabase
    .from('forum_categories')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true);

  const suffix = crypto.randomUUID().slice(0, 8);
  const { data: category, error } = await supabase
    .from('forum_categories')
    .insert({
      slug: `${baseSlug}-${suffix}`,
      name,
      description: 'Topluluk üyelerinin açtığı kanal.',
      color: USER_CATEGORY_COLOR,
      icon_key: USER_CATEGORY_ICON_KEY,
      icon: null,
      sort_order: Math.max(1000, 1000 + (count || 0)),
      is_active: true,
      created_by: user.id,
      is_user_created: true,
    })
    .select('id, slug, name, description, icon, color, icon_key, sort_order, is_active, created_by, is_user_created')
    .single();

  if (error || !category) {
    throw new Error(error?.message || 'Kategori oluşturulamadı.');
  }

  revalidatePath('/topluluk');
  return category as ForumCategoryOption;
}

export async function createForumThread(formData: FormData) {
  const { supabase } = await requireVerifiedForumUser();
  const title = readString(formData, 'title', 140);
  const content = readString(formData, 'content', 8000);
  const categoryId = readString(formData, 'categoryId', 64);
  const tagIds = readIds(formData, 'tagIds').slice(0, 5);
  const mentionIds = readIds(formData, 'mentionIds').slice(0, 12);
  const isAnonymous = readBoolean(formData, 'isAnonymous');

  if (title.length < 6 || content.length < 10 || !categoryId) {
    throw new Error('Başlık, kategori ve içerik alanlarını doldurmalısın.');
  }

  const { data: category } = await supabase
    .from('forum_categories')
    .select('id, slug')
    .eq('id', categoryId)
    .eq('is_active', true)
    .single();

  if (!category) {
    throw new Error('Geçerli bir kategori seçmelisin.');
  }

  const { data, error } = await supabase
    .rpc('create_forum_thread_with_details', {
      p_thread_id: crypto.randomUUID(),
      p_category_id: category.id,
      p_title: title,
      p_content: content,
      p_is_anonymous: isAnonymous,
      p_tag_ids: tagIds,
      p_mention_ids: mentionIds,
    })
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Konu oluşturulamadı.');
  }

  const result = data as { thread_id: string; category_slug: string };

  revalidatePath('/topluluk');
  revalidatePath(`/topluluk/${result.category_slug || category.slug}`);
  return {
    ok: true,
    threadId: result.thread_id,
    href: `/topluluk/konu/${result.thread_id}`,
  };
}

export async function createForumPost(formData: FormData) {
  const { supabase } = await requireVerifiedForumUser();
  const threadId = readString(formData, 'threadId', 64);
  const parentPostId = readString(formData, 'parentPostId', 64) || null;
  const content = readString(formData, 'content', 8000);
  const mentionIds = readIds(formData, 'mentionIds').slice(0, 12);
  const isAnonymous = readBoolean(formData, 'isAnonymous');

  if (!threadId || content.length < 2) {
    throw new Error('Yanıt içeriği boş olamaz.');
  }

  const { data: thread } = await supabase
    .from('forum_threads_public')
    .select('id, is_locked, is_hidden, status')
    .eq('id', threadId)
    .single();

  if (!thread || thread.is_locked || thread.is_hidden || thread.status !== 'open') {
    throw new Error('Bu konuya yanıt yazılamaz.');
  }

  const { data, error } = await supabase
    .rpc('create_forum_post_with_mentions', {
      p_post_id: crypto.randomUUID(),
      p_thread_id: threadId,
      p_parent_post_id: parentPostId,
      p_content: content,
      p_is_anonymous: isAnonymous,
      p_mention_ids: mentionIds,
    })
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Yanıt gönderilemedi.');
  }

  revalidatePath(`/topluluk/konu/${threadId}`);
  return { ok: true, postId: (data as { post_id: string }).post_id };
}

export async function editForumThread(formData: FormData) {
  const { supabase } = await requireVerifiedForumUser();
  const threadId = readString(formData, 'threadId', 64);
  const title = readString(formData, 'title', 140);
  const content = readString(formData, 'content', 8000);
  const mentionIds = readIds(formData, 'mentionIds').slice(0, 12);

  if (!threadId || title.length < 6 || content.length < 10) {
    throw new Error('Başlık ve içerik alanlarını doldurmalısın.');
  }

  const { data, error } = await supabase
    .rpc('edit_forum_thread_content', {
      p_thread_id: threadId,
      p_title: title,
      p_content: content,
      p_mention_ids: mentionIds,
    })
    .single();

  if (error) throw new Error(error.message || 'Konu düzenlenemedi.');
  const result = data as { thread_id?: string } | null;
  revalidatePath('/topluluk');
  revalidatePath(`/topluluk/konu/${result?.thread_id || threadId}`);
  return { ok: true };
}

export async function editForumPost(formData: FormData) {
  const { supabase } = await requireVerifiedForumUser();
  const postId = readString(formData, 'postId', 64);
  const content = readString(formData, 'content', 8000);
  const mentionIds = readIds(formData, 'mentionIds').slice(0, 12);

  if (!postId || content.length < 2) {
    throw new Error('Yanıt içeriği boş olamaz.');
  }

  const { data, error } = await supabase
    .rpc('edit_forum_post_content', {
      p_post_id: postId,
      p_content: content,
      p_mention_ids: mentionIds,
    })
    .single();

  if (error) throw new Error(error.message || 'Yanıt düzenlenemedi.');
  const result = data as { thread_id?: string } | null;
  if (result?.thread_id) {
    revalidatePath(`/topluluk/konu/${result.thread_id}`);
  }
  return { ok: true };
}

export async function toggleForumReaction(input: {
  targetType: ForumReactionTargetType;
  targetId: string;
  reactionType: ForumReactionType;
}) {
  const supabase = await createClient();

  if (!VALID_REACTIONS.includes(input.reactionType)) {
    throw new Error('Geçersiz reaksiyon.');
  }

  const targetColumn = input.targetType === 'thread' ? 'target_thread_id' : 'target_post_id';
  const { data: rpcData, error: rpcError } = await supabase
    .rpc('toggle_forum_reaction', {
      p_target_type: input.targetType,
      p_target_id: input.targetId,
      p_reaction_type: input.reactionType,
    })
    .single();
  const rpcResult = rpcData as { active?: boolean } | null;
  const shouldFallback = isMissingRpcError(rpcError);

  if (!rpcError && typeof rpcResult?.active === 'boolean') {
    return { active: rpcResult.active };
  }

  if (!shouldFallback) {
    throw new Error(rpcError?.message || 'İfade güncellenemedi.');
  }

  const user = await requireVerifiedForumUserForClient(supabase);
  const { data: existing } = await supabase
    .from('forum_reactions')
    .select('id')
    .eq('user_id', user.id)
    .eq('reaction_type', input.reactionType)
    .eq(targetColumn, input.targetId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from('forum_reactions').delete().eq('id', existing.id);
    if (error) throw new Error('İfade kaldırılamadı.');
  } else {
    const { error } = await supabase.from('forum_reactions').insert({
      user_id: user.id,
      target_type: input.targetType,
      target_thread_id: input.targetType === 'thread' ? input.targetId : null,
      target_post_id: input.targetType === 'post' ? input.targetId : null,
      reaction_type: input.reactionType,
    });
    if (error) throw new Error('İfade bırakılamadı.');
  }

  return {
    active: !existing,
  };
}

export async function reportForumContent(formData: FormData) {
  const { supabase, user } = await requireVerifiedForumUser();
  const targetType = readString(formData, 'targetType', 16) as ForumReactionTargetType;
  const targetId = readString(formData, 'targetId', 64);
  const reason = readString(formData, 'reason', 24) as ForumReportReason;
  const note = readString(formData, 'note', 1000) || null;

  if (!['thread', 'post'].includes(targetType) || !targetId || !VALID_REPORT_REASONS.includes(reason)) {
    throw new Error('Geçerli bir rapor nedeni seçmelisin.');
  }

  const { error } = await supabase.from('forum_reports').insert({
    reporter_id: user.id,
    target_type: targetType,
    target_thread_id: targetType === 'thread' ? targetId : null,
    target_post_id: targetType === 'post' ? targetId : null,
    reason,
    note,
    status: 'open',
  });

  if (error) {
    if (error.message.includes('duplicate') || error.code === '23505') {
      throw new Error('Bu içeriği zaten raporladın.');
    }
    throw new Error('Rapor gönderilemedi.');
  }

  revalidatePath('/admin');
}

export async function moderateForumContent(formData: FormData) {
  const { supabase, user } = await requireVerifiedForumUser();
  const admin = await isPlatformAdmin(supabase, user.id);
  if (!admin) throw new Error('Bu işlem için admin yetkisi gerekir.');

  const targetType = readString(formData, 'targetType', 16);
  const targetId = readString(formData, 'targetId', 64);
  const action = readString(formData, 'action', 24);
  if (!['thread', 'post'].includes(targetType) || !targetId || !['toggle_pin', 'toggle_lock', 'archive', 'restore_archive', 'delete'].includes(action)) {
    throw new Error('Geçersiz moderasyon işlemi.');
  }
  let threadIdToRevalidate = targetType === 'thread' ? targetId : '';

  const { data, error } = await supabase
    .rpc('admin_moderate_forum_content', {
      p_target_type: targetType,
      p_target_id: targetId,
      p_action: action,
    })
    .single();

  if (error) {
    throw new Error(error.message || 'Moderasyon işlemi tamamlanamadı.');
  }
  const moderationResult = data as { thread_id?: string; deleted?: boolean } | null;
  threadIdToRevalidate = moderationResult?.thread_id || threadIdToRevalidate;

  revalidatePath('/topluluk');
  if (threadIdToRevalidate) {
    revalidatePath(`/topluluk/konu/${threadIdToRevalidate}`);
  }
  return {
    ok: true,
    threadId: threadIdToRevalidate || null,
    deleted: Boolean(moderationResult?.deleted),
    targetType,
  };
}

export async function getForumReactionPeople(input: {
  targetType: ForumReactionTargetType;
  targetId: string;
  reactionType: ForumReactionType;
}) {
  const { supabase } = await requireVerifiedForumUser();
  const targetColumn = input.targetType === 'thread' ? 'target_thread_id' : 'target_post_id';
  const { data, error } = await supabase
    .from('forum_reactions')
    .select('user_id, profiles:user_id(id, full_name, role)')
    .eq(targetColumn, input.targetId)
    .eq('reaction_type', input.reactionType);
  if (error) throw new Error('İfadeyi bırakan kişiler alınamadı.');
  return (data || []).flatMap((row: { profiles?: { id: string; full_name: string; role: Profile['role'] }[] | null }) => row.profiles || []);
}

export async function reviewForumReport(formData: FormData) {
  const { supabase, user } = await requireVerifiedForumUser();
  const admin = await isPlatformAdmin(supabase, user.id);
  if (!admin) throw new Error('Bu işlem için admin yetkisi gerekir.');

  const reportId = readString(formData, 'reportId', 64);
  const status = readString(formData, 'status', 24);
  if (!['resolved', 'dismissed', 'reviewing'].includes(status)) {
    throw new Error('Geçerli bir rapor durumu seçmelisin.');
  }

  const { error } = await supabase
    .from('forum_reports')
    .update({
      status,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', reportId);
  if (error) throw new Error('Rapor durumu güncellenemedi.');

  revalidatePath('/admin');
}

export async function searchForumMentionUsers(query: string) {
  const { supabase } = await requireVerifiedForumUser();
  const cleanQuery = query.trim();

  if (cleanQuery.length < 2) return [];

  const terms = Array.from(new Set([
    cleanQuery,
    cleanQuery.toLocaleUpperCase('tr-TR'),
    cleanQuery.toLocaleLowerCase('tr-TR'),
    cleanQuery.toLocaleUpperCase('en-US'),
    cleanQuery.toLocaleLowerCase('en-US'),
  ])).slice(0, 5);
  const filters = terms.flatMap((term) => {
    const escaped = term.replaceAll('%', '\\%').replaceAll('_', '\\_');
    return [`full_name.ilike.%${escaped}%`, `nickname.ilike.%${escaped}%`];
  }).join(',');

  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('is_verified', true)
    .or(filters)
    .order('full_name', { ascending: true })
    .limit(8);

  return (data || []) as Pick<Profile, 'id' | 'full_name' | 'role'>[];
}
