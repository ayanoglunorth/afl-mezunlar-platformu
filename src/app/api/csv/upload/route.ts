import { createClient } from '@/lib/supabase/server';
import { requirePlatformAdmin } from '@/lib/admin-auth';
import { parseActiveStudentCSV, parseAlumniCSV } from '@/lib/csv-parser';
import { repairTurkishText } from '@/lib/turkish-text';
import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
const MAX_ROWS = 5000;
const ALLOWED_EXTENSIONS = new Set(['csv', 'xlsx', 'xls', 'ods']);

type RegistryType = 'alumni' | 'active-students';

export async function POST(request: NextRequest) {
  try {
    const adminContext = await requirePlatformAdmin();
    if (!adminContext) {
      return NextResponse.json({ success: false, error: 'Yönetici yetkisi gerekli.' }, { status: 403 });
    }

    const rateLimit = checkRateLimit(`csv:${adminContext.userId}:${getClientIp(request)}`, 8, 60_000);
    if (!rateLimit.allowed) {
      return NextResponse.json({ success: false, error: 'Too many attempts.' }, { status: 429 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const action = formData.get('action') as string;
    const registryType = (formData.get('registryType') === 'active-students' ? 'active-students' : 'alumni') as RegistryType;

    if (!file) {
      return NextResponse.json({ success: false, error: 'Dosya bulunamadı.' }, { status: 400 });
    }

    const extension = file.name.split('.').pop()?.toLocaleLowerCase('en-US') || '';
    if (!ALLOWED_EXTENSIONS.has(extension)) {
      return NextResponse.json({ success: false, error: 'Invalid file type.' }, { status: 400 });
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ success: false, error: 'File is too large.' }, { status: 413 });
    }

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as unknown[][];
    if (rawData.length > MAX_ROWS) {
      return NextResponse.json({ success: false, error: 'Too many rows.' }, { status: 413 });
    }

    if (registryType === 'active-students') {
      const parseResult = parseActiveStudentCSV(rawData);

      if (action === 'preview') {
        return NextResponse.json({
          success: true,
          registryType,
          data: parseResult.success,
          errors: parseResult.errors,
          totalRows: parseResult.totalRows,
        });
      }

      if (action === 'upload') {
        if (parseResult.success.length === 0) {
          return NextResponse.json({
            success: false,
            error: 'Yüklenecek geçerli veri bulunamadı.',
          });
        }

        const rows = parseResult.success.map((row) => ({
          student_number: row.studentNumber,
          school_number: row.schoolNumber,
          full_name: repairTurkishText(row.fullName).toLocaleUpperCase('tr-TR'),
          current_grade: row.currentGrade,
          class_section: row.classSection,
          expected_graduation_year: row.expectedGraduationYear,
        }));

        const supabase = await createClient();
        const { data: inserted, error } = await supabase.rpc('admin_upsert_active_student_registry', {
          p_rows: rows,
          p_file_name: file.name,
          p_parse_error_count: parseResult.errors.length,
        });

        if (error) {
          console.error('Active student upload failed:', error.message);
          return NextResponse.json({
            success: false,
            error: 'Upload failed.',
          }, { status: 500 });
        }

        return NextResponse.json({
          success: true,
          result: {
            inserted: inserted || 0,
            skipped: 0,
            errors: parseResult.errors,
          },
        });
      }
    }

    const parseResult = parseAlumniCSV(rawData);

    if (action === 'preview') {
      return NextResponse.json({
        success: true,
        registryType,
        data: parseResult.success,
        errors: parseResult.errors,
        totalRows: parseResult.totalRows,
      });
    }

    if (action === 'upload') {
      if (parseResult.success.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Yüklenecek geçerli veri bulunamadı.',
        });
      }

      const rows = parseResult.success.map((row) => ({
        sequence_number: row.sequenceNumber,
        student_number: row.studentNumber,
        full_name: repairTurkishText(row.fullName).toLocaleUpperCase('tr-TR'),
        field_of_study: repairTurkishText(row.fieldOfStudy) || null,
        graduation_year: row.graduationYear,
        uploaded_by: adminContext.userId,
      }));

      const supabase = await createClient();
      const { data: inserted, error } = await supabase.rpc('admin_upsert_alumni_registry', {
        p_rows: rows,
        p_file_name: file.name,
        p_parse_error_count: parseResult.errors.length,
      });

      if (error) {
        return NextResponse.json({
          success: false,
          error: 'Upload failed.',
        }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        result: {
          inserted: inserted || 0,
          skipped: 0,
          errors: parseResult.errors,
        },
      });
    }

    return NextResponse.json({ success: false, error: 'Geçersiz işlem.' }, { status: 400 });
  } catch (error) {
    console.error('CSV upload error:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ success: false, error: 'Sunucu hatası.' }, { status: 500 });
  }
}
