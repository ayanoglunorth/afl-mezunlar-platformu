'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { EventInterestType } from '@/types/database';

const EVENT_KEY = 'football-2026';
const VALID_INTEREST_TYPES: EventInterestType[] = ['team', 'player', 'support'];

export type FootballInterestActionState = {
  type: 'idle' | 'success' | 'error';
  message: string;
};

function readString(formData: FormData, key: string, maxLength: number) {
  return String(formData.get(key) || '').trim().slice(0, maxLength);
}

export async function submitFootballInterest(formData: FormData): Promise<FootballInterestActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { type: 'error', message: 'Başvuru iletmek için giriş yapmanız gerekmektedir.' };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, is_verified')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile?.is_verified) {
    return { type: 'error', message: 'Başvuru iletmek için hesabınızın onaylanmış olması gerekmektedir.' };
  }

  const interestType = (readString(formData, 'interestType', 16) || 'team') as EventInterestType;
  const teamName = readString(formData, 'teamName', 80) || null;
  const note = readString(formData, 'note', 500) || null;
  const estimatedPlayerCountValue = readString(formData, 'estimatedPlayerCount', 2);
  const estimatedPlayerCount = estimatedPlayerCountValue ? Number(estimatedPlayerCountValue) : null;

  if (!VALID_INTEREST_TYPES.includes(interestType)) {
    return { type: 'error', message: 'Geçerli bir başvuru türü seçilmelidir.' };
  }

  if (estimatedPlayerCount !== null && (!Number.isInteger(estimatedPlayerCount) || estimatedPlayerCount < 1 || estimatedPlayerCount > 20)) {
    return { type: 'error', message: 'Tahmini oyuncu sayısı 1 ile 20 arasında olmalıdır.' };
  }

  const { error } = await supabase.from('event_interests').upsert(
    {
      event_key: EVENT_KEY,
      user_id: user.id,
      interest_type: interestType,
      team_name: teamName,
      estimated_player_count: estimatedPlayerCount,
      note,
    },
    { onConflict: 'event_key,user_id' },
  );

  if (error) {
    console.error('Football interest upsert failed:', error.message);
    return { type: 'error', message: 'Başvurunuz kaydedilemedi. Lütfen daha sonra tekrar deneyiniz.' };
  }

  revalidatePath('/etkinlik');
  revalidatePath('/admin');

  return { type: 'success', message: 'Başvurunuz iletildi.' };
}

export async function withdrawFootballInterest(): Promise<FootballInterestActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { type: 'error', message: 'Başvuruyu geri almak için giriş yapmanız gerekmektedir.' };
  }

  const { error } = await supabase
    .from('event_interests')
    .delete()
    .eq('event_key', EVENT_KEY)
    .eq('user_id', user.id);

  if (error) {
    console.error('Football interest delete failed:', error.message);
    return { type: 'error', message: 'Başvurunuz geri alınamadı. Lütfen daha sonra tekrar deneyiniz.' };
  }

  revalidatePath('/etkinlik');
  revalidatePath('/admin');

  return { type: 'success', message: 'Başvurunuz geri alındı.' };
}
