import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import type { Profile } from '@/types/database';

const STUDENT_FIELDS = new Set<keyof Profile>([
  'full_name',
  'nickname',
  'student_number',
  'current_grade',
  'field_of_study',
  'target_field',
  'target_departments',
  'target_universities',
  'mentorship_expectations',
  'is_profile_complete',
]);

const ALUMNI_FIELDS = new Set<keyof Profile>([
  'full_name',
  'nickname',
  'student_number',
  'field_of_study',
  'graduation_year',
  'university',
  'department',
  'education_status',
  'is_working',
  'company_name',
  'company_logo',
  'work_title',
  'linkedin_url',
  'mentorship_capacity',
  'mentorship_topics',
  'mentorship_availability',
  'is_profile_complete',
]);

function pickAllowedUpdates(updates: Record<string, unknown>, allowedFields: Set<keyof Profile>) {
  return Object.fromEntries(
    Object.entries(updates).filter(([key]) => allowedFields.has(key as keyof Profile)),
  );
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, updates, registryEntryId } = body;

    if (!userId || !updates || typeof updates !== 'object' || Array.isArray(updates)) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }

    const authClient = await createClient();
    const {
      data: { user: authenticatedUser },
    } = await authClient.auth.getUser();

    if (!authenticatedUser || authenticatedUser.id !== userId) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const rateLimit = checkRateLimit(`register-update:${authenticatedUser.id}:${getClientIp(req)}`, 5, 60_000);
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: 'Too many attempts.' }, { status: 429 });
    }

    let profile: Pick<Profile, 'id' | 'role' | 'is_profile_complete'> | null = null;
    let retries = 3;

    while (retries > 0) {
      const { data } = await authClient
        .from('profiles')
        .select('id, role, is_profile_complete')
        .eq('id', userId)
        .single();

      if (data) {
        profile = data as Pick<Profile, 'id' | 'role' | 'is_profile_complete'>;
        break;
      }

      retries -= 1;
      if (retries > 0) await new Promise((resolve) => setTimeout(resolve, 500));
    }

    if (!profile) {
      return NextResponse.json({ error: 'Profile not created yet.' }, { status: 404 });
    }

    if (profile.is_profile_complete) {
      return NextResponse.json({ error: 'Profile already complete.' }, { status: 400 });
    }

    if (profile.role === 'admin') {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    const allowedFields = profile.role === 'alumni' ? ALUMNI_FIELDS : STUDENT_FIELDS;
    const sanitizedUpdates = pickAllowedUpdates(updates as Record<string, unknown>, allowedFields);

    if (Object.keys(sanitizedUpdates).length === 0) {
      return NextResponse.json({ error: 'No allowed fields provided.' }, { status: 400 });
    }

    // Protects signup completion from mass assignment; attack scenario: a client
    // sends role/is_verified/admin fields and the server writes them.
    const { error: updateError } = await authClient
      .from('profiles')
      .update(sanitizedUpdates)
      .eq('id', userId);

    if (updateError) {
      console.error('Error updating profile:', updateError.message);
      return NextResponse.json({ error: 'Failed to update profile.' }, { status: 500 });
    }

    if (profile.role === 'alumni' && registryEntryId) {
      console.warn('register-update registry claim skipped; signup trigger owns registry claims.');
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Register update error:', err instanceof Error ? err.message : 'unknown error');
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
