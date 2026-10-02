import { repairTurkishText } from '@/lib/turkish-text';
import type { CSVActiveStudentParseResult, CSVActiveStudentRow, CSVAlumniRow, CSVParseResult } from '@/types/database';

/**
 * Normalize Turkish characters for name matching
 */
export function normalizeTurkishName(name: string): string {
  return repairTurkishText(name)
    .toLocaleUpperCase('tr-TR')
    .replace(/İ/g, 'I')
    .replace(/Ğ/g, 'G')
    .replace(/Ü/g, 'U')
    .replace(/Ş/g, 'S')
    .replace(/Ö/g, 'O')
    .replace(/Ç/g, 'C')
    .replace(/Â/g, 'A')
    .replace(/Î/g, 'I')
    .replace(/Û/g, 'U')
    .trim();
}

/**
 * Parse the student number field from CSV
 * Input: "202234.0" -> { studentNumber: "202234", graduationYear: 2022 }
 */
export function parseStudentNumber(raw: string): { studentNumber: string; graduationYear: number } | null {
  if (!raw) return null;

  const cleaned = String(raw).replace(/\.0$/, '').replace(/\.0+$/, '').trim();

  if (!cleaned || cleaned.length < 4) return null;

  const graduationYear = parseInt(cleaned.substring(0, 4), 10);

  if (Number.isNaN(graduationYear) || graduationYear < 1900 || graduationYear > 2100) {
    return null;
  }

  return { studentNumber: cleaned, graduationYear };
}

function cleanCell(value: unknown) {
  return repairTurkishText(String(value ?? '').replace(/\.0$/, '').trim());
}

function normalizeHeader(value: unknown) {
  return cleanCell(value).toLocaleLowerCase('tr-TR').trim();
}

/**
 * Known column name mappings for the CSV schema
 * Handles variations in header naming
 */
const COLUMN_MAPPINGS = {
  sequence: ['sıra', 'sira', 'no', '#'],
  studentNumber: ['öğr. no', 'ogr. no', 'öğrenci no', 'ogrenci no', 'öğr.no', 'ogr.no', 'öğr no', 'ogr no'],
  fullName: ['adı soyadı', 'adi soyadi', 'ad soyad', 'adı-soyadı', 'isim'],
  fieldOfStudy: ['alan / dal', 'alan/dal', 'alan', 'bölüm', 'bolum'],
};

const ACTIVE_STUDENT_COLUMN_MAPPINGS = {
  grade: ['sınıf', 'sinif'],
  section: ['şube', 'sube'],
  expectedGraduationYear: ['mezun yılı', 'mezun yili', 'mezuniyet yılı', 'mezuniyet yili'],
  schoolNumber: ['öğrenci no', 'ogrenci no', 'öğr. no', 'ogr. no', 'okul no', 'okul numarası', 'okul numarasi'],
  firstName: ['adı', 'adi', 'ad'],
  lastName: ['soyadı', 'soyadi', 'soyad'],
  fullName: ['adı soyadı', 'adi soyadi', 'ad soyad', 'isim'],
};

function findColumn(headers: string[], candidates: string[]): number {
  const normalizedHeaders = headers.map((header) => normalizeHeader(header));
  for (const candidate of candidates) {
    const idx = normalizedHeaders.indexOf(candidate);
    if (idx !== -1) return idx;
  }
  for (const candidate of candidates) {
    const idx = normalizedHeaders.findIndex((h) => h.includes(candidate));
    if (idx !== -1) return idx;
  }
  return -1;
}

function normalizeDelimitedRows(data: unknown[][]) {
  if (data[0]?.length === 1 && String(data[0][0] || '').includes(';')) {
    return data.map((row) => String(row[0] || '').split(';').map((c) => c.trim()));
  }
  return data;
}

/**
 * Parse a CSV/Excel file buffer into structured alumni data
 */
export function parseAlumniCSV(data: unknown[][]): CSVParseResult {
  const result: CSVParseResult = {
    success: [],
    errors: [],
    totalRows: 0,
  };

  if (!data || data.length < 2) {
    result.errors.push({ row: 0, message: 'Dosya boş veya başlık satırı eksik.' });
    return result;
  }

  const processedData = normalizeDelimitedRows(data);
  const headers = processedData[0].map((header) => repairTurkishText(String(header || '')));

  const seqIdx = findColumn(headers, COLUMN_MAPPINGS.sequence);
  const snIdx = findColumn(headers, COLUMN_MAPPINGS.studentNumber);
  const nameIdx = findColumn(headers, COLUMN_MAPPINGS.fullName);
  const fieldIdx = findColumn(headers, COLUMN_MAPPINGS.fieldOfStudy);

  if (snIdx === -1) {
    result.errors.push({ row: 0, message: 'Öğrenci numarası sütunu bulunamadı. Beklenen: "Öğr. No"' });
    return result;
  }

  if (nameIdx === -1) {
    result.errors.push({ row: 0, message: 'İsim sütunu bulunamadı. Beklenen: "Adı Soyadı"' });
    return result;
  }

  for (let i = 1; i < processedData.length; i++) {
    const row = processedData[i];
    result.totalRows++;

    if (!row || row.length === 0 || row.every((cell) => !cell)) {
      continue;
    }

    const rawStudentNumber = String(row[snIdx] || '');
    const rawName = repairTurkishText(String(row[nameIdx] || ''));

    if (!rawName) {
      result.errors.push({ row: i + 1, message: 'İsim alanı boş.' });
      continue;
    }

    const parsed = parseStudentNumber(rawStudentNumber);
    if (!parsed) {
      result.errors.push({ row: i + 1, message: `Geçersiz öğrenci numarası: "${rawStudentNumber}"` });
      continue;
    }

    const entry: CSVAlumniRow = {
      sequenceNumber: seqIdx !== -1 ? parseInt(String(row[seqIdx] || '0').replace(/\.0$/, ''), 10) || 0 : i,
      studentNumber: parsed.studentNumber,
      fullName: rawName.toLocaleUpperCase('tr-TR'),
      fieldOfStudy: fieldIdx !== -1 ? repairTurkishText(String(row[fieldIdx] || '')) : '',
      graduationYear: parsed.graduationYear,
    };

    result.success.push(entry);
  }

  return result;
}

function normalizeActiveGrade(rawGrade: string) {
  const cleaned = rawGrade.replace(/\.0$/, '').trim();
  const numeric = cleaned.match(/^(9|10|11|12)/)?.[1];
  if (!numeric) return '';
  return `${numeric}. Sınıf`;
}

export function parseActiveStudentCSV(data: unknown[][]): CSVActiveStudentParseResult {
  const result: CSVActiveStudentParseResult = {
    success: [],
    errors: [],
    totalRows: 0,
  };

  if (!data || data.length < 2) {
    result.errors.push({ row: 0, message: 'Dosya boş veya başlık satırı eksik.' });
    return result;
  }

  const processedData = normalizeDelimitedRows(data);
  const headers = processedData[0].map((header) => repairTurkishText(String(header || '')));

  const gradeIdx = findColumn(headers, ACTIVE_STUDENT_COLUMN_MAPPINGS.grade);
  const sectionIdx = findColumn(headers, ACTIVE_STUDENT_COLUMN_MAPPINGS.section);
  const yearIdx = findColumn(headers, ACTIVE_STUDENT_COLUMN_MAPPINGS.expectedGraduationYear);
  const schoolNumberIdx = findColumn(headers, ACTIVE_STUDENT_COLUMN_MAPPINGS.schoolNumber);
  const firstNameIdx = findColumn(headers, ACTIVE_STUDENT_COLUMN_MAPPINGS.firstName);
  const lastNameIdx = findColumn(headers, ACTIVE_STUDENT_COLUMN_MAPPINGS.lastName);
  const fullNameIdx = findColumn(headers, ACTIVE_STUDENT_COLUMN_MAPPINGS.fullName);

  if (gradeIdx === -1 || sectionIdx === -1 || yearIdx === -1 || schoolNumberIdx === -1) {
    result.errors.push({ row: 0, message: 'Aktif öğrenci dosyasında SINIF, ŞUBE, MEZUN YILI ve Öğrenci No sütunları bulunmalı.' });
    return result;
  }

  if (fullNameIdx === -1 && (firstNameIdx === -1 || lastNameIdx === -1)) {
    result.errors.push({ row: 0, message: 'Aktif öğrenci dosyasında Adı/Soyadı veya Adı Soyadı sütunları bulunmalı.' });
    return result;
  }

  const seenStudentNumbers = new Set<string>();

  for (let i = 1; i < processedData.length; i++) {
    const row = processedData[i];
    result.totalRows++;

    if (!row || row.length === 0 || row.every((cell) => !cell)) {
      continue;
    }

    const currentGrade = normalizeActiveGrade(cleanCell(row[gradeIdx]));
    const classSection = cleanCell(row[sectionIdx]).toLocaleUpperCase('tr-TR');
    const expectedGraduationYear = Number(cleanCell(row[yearIdx]));
    const schoolNumber = cleanCell(row[schoolNumberIdx]).replace(/\D/g, '');
    const fullName = fullNameIdx !== -1
      ? cleanCell(row[fullNameIdx])
      : `${cleanCell(row[firstNameIdx])} ${cleanCell(row[lastNameIdx])}`.trim();
    const normalizedFullName = fullName.toLocaleUpperCase('tr-TR');
    const studentNumber = `${expectedGraduationYear}${schoolNumber}`;

    if (!['10. Sınıf', '11. Sınıf', '12. Sınıf'].includes(currentGrade)) {
      result.errors.push({ row: i + 1, message: 'Bu yüklemede yalnızca 10, 11 ve 12. sınıf kayıtları desteklenir.' });
      continue;
    }

    if (!/^[A-ZÇĞİÖŞÜ]{1,3}$/.test(classSection)) {
      result.errors.push({ row: i + 1, message: `Geçersiz şube: "${classSection}"` });
      continue;
    }

    if (!Number.isInteger(expectedGraduationYear) || expectedGraduationYear < new Date().getFullYear() || expectedGraduationYear > 2100) {
      result.errors.push({ row: i + 1, message: `Geçersiz mezun yılı: "${cleanCell(row[yearIdx])}"` });
      continue;
    }

    if (!/^\d{1,8}$/.test(schoolNumber)) {
      result.errors.push({ row: i + 1, message: `Geçersiz okul numarası: "${cleanCell(row[schoolNumberIdx])}"` });
      continue;
    }

    if (normalizedFullName.length < 3) {
      result.errors.push({ row: i + 1, message: 'İsim alanı boş veya geçersiz.' });
      continue;
    }

    if (seenStudentNumbers.has(studentNumber)) {
      result.errors.push({ row: i + 1, message: `Tekrarlanan tam öğrenci numarası: "${studentNumber}"` });
      continue;
    }

    seenStudentNumbers.add(studentNumber);

    const entry: CSVActiveStudentRow = {
      studentNumber,
      schoolNumber,
      fullName: normalizedFullName,
      currentGrade,
      classSection,
      expectedGraduationYear,
    };

    result.success.push(entry);
  }

  return result;
}
