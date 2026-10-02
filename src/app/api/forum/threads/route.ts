import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { Profile } from '@/types/database';

type VerifiedForumUser = Pick<Profile, 'id' | 'is_verified'>;

function readString(formData: FormData, key: string, maxLength: number) {
  return String(formData.get(key) || '').trim().slice(0, maxLength);
}

function readIds(formData: FormData, key: string) {
  const values = formData.getAll(key).flatMap((entry) => String(entry).split(','));
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function readBoolean(formData: FormData, key: string) {
  return String(formData.get(key) || '').toLowerCase() === 'true';
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

async function requireVerifiedForumUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, user: null, error: 'Topluluk için giriş yapmalısın.' };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, is_verified')
    .eq('id', user.id)
    .single();

  if (!profile?.is_verified) {
    return { supabase, user: null, error: 'Topluluk yalnızca doğrulanmış platform kullanıcılarına açıktır.' };
  }

  return { supabase, user: profile as VerifiedForumUser, error: null };
}

export async function POST(request: Request) {
  const { supabase, error: authError } = await requireVerifiedForumUser();
  if (authError) return jsonError(authError, 401);

  const formData = await request.formData();
  const title = readString(formData, 'title', 140);
  const content = readString(formData, 'content', 8000);
  const categoryId = readString(formData, 'categoryId', 64);
  const tagIds = readIds(formData, 'tagIds').slice(0, 5);
  const mentionIds = readIds(formData, 'mentionIds').slice(0, 12);
  const isAnonymous = readBoolean(formData, 'isAnonymous');

  if (title.length < 6 || content.length < 10 || !categoryId) {
    return jsonError('Başlık, kategori ve içerik alanlarını doldurmalısın.');
  }

  const { data: category } = await supabase
    .from('forum_categories')
    .select('id, slug')
    .eq('id', categoryId)
    .eq('is_active', true)
    .single();

  if (!category) {
    return jsonError('Geçerli bir kategori seçmelisin.');
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
    return jsonError(error?.message || 'Konu oluşturulamadı.', 500);
  }

  const result = data as { thread_id: string; category_slug: string };
  revalidatePath('/topluluk');
  revalidatePath(`/topluluk/${result.category_slug || category.slug}`);

  return NextResponse.json({
    ok: true,
    threadId: result.thread_id,
    href: `/topluluk/konu/${result.thread_id}`,
  });
}
