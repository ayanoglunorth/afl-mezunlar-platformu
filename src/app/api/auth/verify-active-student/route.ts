import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { repairTurkishText } from '@/lib/turkish-text';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

type VerifyActiveStudentRequest = {
  schoolNumber?: unknown;
  fullName?: unknown;
  currentGrade?: unknown;
  classSection?: unknown;
};

type VerificationResult = {
  ok?: boolean;
  error?: string;
  entry?: {
    id: number;
    student_number: string;
    school_number: string;
    current_grade: string;
    class_section: string;
    expected_graduation_year: number;
  };
};

function serializeSupabaseError(error: { code?: string; message?: string; details?: string; hint?: string }) {
  return {
    code: error.code || null,
    message: error.message || null,
    details: error.details || null,
    hint: error.hint || null,
  };
}

const GENERIC_INPUT_ERROR = 'Lütfen verdiğiniz bilgilerin doğruluğunu kontrol edin.';
const SERVICE_ERROR = 'Doğrulama şu anda tamamlanamadı.';
const ACTIVE_GRADES = new Set(['10. Sınıf', '11. Sınıf', '12. Sınıf']);

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
    const rateLimit = checkRateLimit(`active-student-verify:${getClientIp(req)}`, 12, 60_000);
    if (!rateLimit.allowed) {
      return NextResponse.json({ ok: false, error: 'Çok fazla deneme yapıldı.' }, { status: 429 });
    }

    const body = (await req.json()) as VerifyActiveStudentRequest;
    const schoolNumber = String(body.schoolNumber || '').trim().replace(/\D/g, '');
    const fullName = repairTurkishText(String(body.fullName || '')).trim();
    const normalizedName = fullName.toLocaleUpperCase('tr-TR');
    const currentGrade = repairTurkishText(String(body.currentGrade || '')).trim();
    const classSection = repairTurkishText(String(body.classSection || '')).trim().toLocaleUpperCase('tr-TR');

    if (
      !/^\d{1,8}$/.test(schoolNumber)
      || fullName.length < 3
      || fullName.length > 160
      || !ACTIVE_GRADES.has(currentGrade)
      || !/^[A-ZÇĞİÖŞÜ]{1,3}$/.test(classSection)
    ) {
      return invalidResponse();
    }

    const { data, error } = await createPublicServerClient().rpc('verify_active_student_registration', {
      p_school_number: schoolNumber,
      p_full_name_normalized: normalizedName,
      p_current_grade: currentGrade,
      p_class_section: classSection,
    });

    if (error) {
      console.error('Active student verification RPC failed:', serializeSupabaseError(error));
      return NextResponse.json({ ok: false, error: SERVICE_ERROR }, { status: 500 });
    }

    const result = data as VerificationResult | null;
    if (!result?.ok || !result.entry) {
      return failedVerificationResponse(result);
    }

    return NextResponse.json({ ok: true, entry: result.entry });
  } catch (error) {
    console.error('Active student verification failed:', error instanceof Error ? { name: error.name, message: error.message } : error);
    return NextResponse.json({ ok: false, error: SERVICE_ERROR }, { status: 500 });
  }
}
