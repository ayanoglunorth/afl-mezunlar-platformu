import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { parseStudentNumber } from '@/lib/csv-parser';
import { repairTurkishText } from '@/lib/turkish-text';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

type VerifyRegistryRequest = {
  studentNumber?: unknown;
  fullName?: unknown;
  graduationYear?: unknown;
  verificationMode?: unknown;
};

type VerificationResult = {
  ok?: boolean;
  error?: string;
  entry?: {
    id: number;
    student_number: string;
    graduation_year: number;
    field_of_study: string | null;
  };
};

const GENERIC_INPUT_ERROR = 'Lütfen verdiğiniz bilgilerin doğruluğunu kontrol edin.';
const SERVICE_ERROR = 'Doğrulama şu anda tamamlanamadı.';

function createPublicServerClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

function invalidResponse(status = 400) {
  return NextResponse.json({ ok: false, error: GENERIC_INPUT_ERROR }, { status });
}

function failedVerificationResponse(result: VerificationResult | null) {
  if (result?.error === 'already_registered') {
    return NextResponse.json(
      { ok: false, error: 'Bu okul numarasıyla daha önce bir hesap oluşturulmuş.' },
      { status: 409 },
    );
  }

  return invalidResponse();
}

export async function POST(req: Request) {
  try {
    const rateLimit = checkRateLimit(`registry-verify:${getClientIp(req)}`, 12, 60_000);
    if (!rateLimit.allowed) {
      return NextResponse.json({ ok: false, error: 'Çok fazla deneme yapıldı.' }, { status: 429 });
    }

    const body = (await req.json()) as VerifyRegistryRequest;
    const fullName = repairTurkishText(String(body.fullName || '')).trim();
    const normalizedName = fullName.toLocaleUpperCase('tr-TR');
    const verificationMode = body.verificationMode === 'name-and-year'
      ? 'name-and-year'
      : 'student-number';

    if (fullName.length < 3 || fullName.length > 160) {
      return invalidResponse();
    }

    const supabase = createPublicServerClient();

    // Protects the private alumni registry without depending on service-role
    // secrets. Attack scenario: a missing runtime secret breaks signup, or a
    // public client tries to list registry rows directly.
    if (verificationMode === 'name-and-year') {
      const graduationYear = Number(body.graduationYear);
      const currentYear = new Date().getFullYear();
      if (!Number.isInteger(graduationYear) || graduationYear < 1900 || graduationYear > currentYear) {
        return invalidResponse();
      }

      const { data, error } = await supabase.rpc('verify_registration_by_name_and_year', {
        p_full_name_normalized: normalizedName,
        p_graduation_year: graduationYear,
      });

      if (error) {
        console.error('Registry verification RPC failed:', error.message);
        return NextResponse.json({ ok: false, error: SERVICE_ERROR }, { status: 500 });
      }

      const result = data as VerificationResult | null;
      if (!result?.ok || !result.entry) {
        return failedVerificationResponse(result);
      }

      return NextResponse.json({ ok: true, entry: result.entry });
    }

    const parsed = parseStudentNumber(String(body.studentNumber || ''));
    if (!parsed) {
      return invalidResponse();
    }

    const { data, error } = await supabase.rpc('verify_registration_by_student_number', {
      p_student_number: parsed.studentNumber,
      p_full_name_normalized: normalizedName,
      p_graduation_year: parsed.graduationYear,
    });

    if (error) {
      console.error('Registry verification RPC failed:', error.message);
      return NextResponse.json({ ok: false, error: SERVICE_ERROR }, { status: 500 });
    }

    const result = data as VerificationResult | null;
    if (!result?.ok || !result.entry) {
      return failedVerificationResponse(result);
    }

    return NextResponse.json({ ok: true, entry: result.entry });
  } catch (error) {
    console.error('Registry verification failed:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ ok: false, error: SERVICE_ERROR }, { status: 500 });
  }
}
