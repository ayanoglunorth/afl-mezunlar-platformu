import type { Profile } from '@/types/database';

type Catalogs = {
  universities?: string[];
  departments?: string[];
  expectations?: string[];
  targetFields?: string[];
  educationStatuses?: string[];
  studentGrades?: string[];
  alumniTopics?: string[];
};

const mojibakePattern = /[ÃÄÅÂ]/;
const decoder = new TextDecoder('utf-8', { fatal: true });

const asciiMap: Record<string, string> = {
  c: 'c',
  C: 'c',
  g: 'g',
  G: 'g',
  i: 'i',
  I: 'i',
  o: 'o',
  O: 'o',
  s: 's',
  S: 's',
  u: 'u',
  U: 'u',
  a: 'a',
  A: 'a',
};

function replaceTurkishChars(value: string) {
  return value.replace(/[çÇğĞıİöÖşŞüÜâÂîÎûÛ]/g, (char) => {
    switch (char) {
      case 'ç':
      case 'Ç':
        return asciiMap.c;
      case 'ğ':
      case 'Ğ':
        return asciiMap.g;
      case 'ı':
      case 'İ':
      case 'i':
      case 'I':
        return asciiMap.i;
      case 'ö':
      case 'Ö':
        return asciiMap.o;
      case 'ş':
      case 'Ş':
        return asciiMap.s;
      case 'ü':
      case 'Ü':
        return asciiMap.u;
      case 'â':
      case 'Â':
        return asciiMap.a;
      case 'î':
      case 'Î':
        return asciiMap.i;
      case 'û':
      case 'Û':
        return asciiMap.u;
      default:
        return char;
    }
  });
}

function tryDecodeMojibake(value: string) {
  if (!mojibakePattern.test(value)) return value;

  try {
    const bytes = Uint8Array.from(
      Array.from(value, (char) => {
        const code = char.charCodeAt(0);
        if (code > 0xff) {
          throw new Error('Non latin1 character');
        }
        return code;
      }),
    );

    return decoder.decode(bytes);
  } catch {
    return value;
  }
}

function normalizeKey(value: string) {
  return replaceTurkishChars(repairTurkishText(value).toLocaleLowerCase('tr-TR'))
    .replace(/[^a-z0-9]/g, '');
}

function normalizeBaseKey(value: string) {
  return normalizeKey(repairTurkishText(value).replace(/\s*\([^)]*\)/g, ' '));
}

function diceCoefficient(left: string, right: string) {
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.length < 2 || right.length < 2) return 0;

  const leftBigrams = new Map<string, number>();
  for (let index = 0; index < left.length - 1; index += 1) {
    const bigram = left.slice(index, index + 2);
    leftBigrams.set(bigram, (leftBigrams.get(bigram) || 0) + 1);
  }

  let intersection = 0;
  for (let index = 0; index < right.length - 1; index += 1) {
    const bigram = right.slice(index, index + 2);
    const count = leftBigrams.get(bigram) || 0;
    if (count > 0) {
      leftBigrams.set(bigram, count - 1);
      intersection += 1;
    }
  }

  return (2 * intersection) / (left.length + right.length - 2);
}

function levenshteinDistance(left: string, right: string) {
  if (!left) return right.length;
  if (!right) return left.length;

  const matrix = Array.from({ length: left.length + 1 }, () => new Array<number>(right.length + 1).fill(0));

  for (let row = 0; row <= left.length; row += 1) {
    matrix[row][0] = row;
  }

  for (let column = 0; column <= right.length; column += 1) {
    matrix[0][column] = column;
  }

  for (let row = 1; row <= left.length; row += 1) {
    for (let column = 1; column <= right.length; column += 1) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1;
      matrix[row][column] = Math.min(
        matrix[row - 1][column] + 1,
        matrix[row][column - 1] + 1,
        matrix[row - 1][column - 1] + cost,
      );
    }
  }

  return matrix[left.length][right.length];
}

function editSimilarity(left: string, right: string) {
  if (!left || !right) return 0;
  const maxLength = Math.max(left.length, right.length);
  return maxLength ? 1 - levenshteinDistance(left, right) / maxLength : 0;
}

function isSubsequence(candidate: string, target: string) {
  if (!candidate || !target || candidate.length > target.length) return false;

  let pointer = 0;
  for (const char of target) {
    if (char === candidate[pointer]) {
      pointer += 1;
      if (pointer === candidate.length) return true;
    }
  }

  return false;
}

export function repairTurkishText(value: string | null | undefined) {
  if (!value) return '';

  let repaired = value.normalize('NFC').replace(/\uFFFD/g, '').trim();

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const decoded = tryDecodeMojibake(repaired);
    if (decoded === repaired) break;
    repaired = decoded.normalize('NFC').trim();
  }

  return repaired.replace(/\s+/g, ' ');
}

export function canonicalizeTurkishOption(
  value: string | null | undefined,
  options: string[] | undefined,
  threshold = 0.72,
) {
  const repaired = repairTurkishText(value);
  if (!repaired || !options?.length) return repaired;

  const inputKey = normalizeKey(repaired);
  const inputBaseKey = normalizeBaseKey(repaired);
  if (!inputKey) return repaired;

  let bestOption = repaired;
  let bestScore = 0;

  for (const option of options) {
    const optionKey = normalizeKey(option);
    const optionBaseKey = normalizeBaseKey(option);
    if (!optionKey) continue;
    if (optionKey === inputKey) return option;
    if (optionBaseKey && optionBaseKey === inputBaseKey) {
      if (bestOption === repaired || option.length < bestOption.length) {
        bestOption = option;
        bestScore = 1;
      }
      continue;
    }

    let score = Math.max(
      diceCoefficient(inputKey, optionKey),
      diceCoefficient(inputBaseKey, optionBaseKey),
      editSimilarity(inputBaseKey, optionBaseKey),
    );
    if (
      score < 0.72 &&
      ((isSubsequence(inputKey, optionKey) && inputKey.length / optionKey.length >= 0.6) ||
        (isSubsequence(optionKey, inputKey) && optionKey.length / inputKey.length >= 0.6) ||
        (isSubsequence(inputBaseKey, optionBaseKey) && inputBaseKey.length / optionBaseKey.length >= 0.6) ||
        (isSubsequence(optionBaseKey, inputBaseKey) && optionBaseKey.length / inputBaseKey.length >= 0.6))
    ) {
      score = 0.9;
    }

    if (!/[()]/.test(repaired) && /[()]/.test(option)) {
      score -= 0.06;
    }

    if (score > bestScore || (score === bestScore && bestOption !== repaired && option.length < bestOption.length)) {
      bestScore = score;
      bestOption = option;
    }
  }

  return bestScore >= threshold ? bestOption : repaired;
}

export function sanitizeStringArray(values: string[] | null | undefined, options?: string[]) {
  if (!values?.length) return [];

  return Array.from(
    new Set(
      values
        .map((value) => canonicalizeTurkishOption(value, options))
        .filter(Boolean),
    ),
  );
}

export function normalizeNickname(value: string | null | undefined) {
  const normalized = repairTurkishText(value)
    .trim()
    .replace(/^@+/, '')
    .toLocaleLowerCase('en-US')
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9._]/g, '')
    .replace(/[._]{2,}/g, '.')
    .replace(/^[._]+|[._]+$/g, '');

  if (!normalized) return null;
  return /^[a-z0-9][a-z0-9._]{1,30}[a-z0-9]$/.test(normalized) ? normalized : null;
}

export function sanitizeProfile(profile: Profile, catalogs: Catalogs = {}): Profile {
  return {
    ...profile,
    full_name: repairTurkishText(profile.full_name),
    nickname: normalizeNickname(profile.nickname),
    university: canonicalizeTurkishOption(profile.university, catalogs.universities) || null,
    department: canonicalizeTurkishOption(profile.department, catalogs.departments) || null,
    field_of_study: repairTurkishText(profile.field_of_study) || null,
    bio: repairTurkishText(profile.bio) || null,
    current_grade: canonicalizeTurkishOption(profile.current_grade, catalogs.studentGrades) || null,
    target_field: canonicalizeTurkishOption(profile.target_field, catalogs.targetFields) || null,
    target_departments: sanitizeStringArray(profile.target_departments, catalogs.departments),
    target_universities: sanitizeStringArray(profile.target_universities, catalogs.universities),
    mentorship_expectations: sanitizeStringArray(profile.mentorship_expectations, catalogs.expectations),
    education_status: canonicalizeTurkishOption(profile.education_status, catalogs.educationStatuses) || null,
    company_name: repairTurkishText(profile.company_name) || null,
    work_title: repairTurkishText(profile.work_title) || null,
    mentorship_topics: sanitizeStringArray(profile.mentorship_topics, catalogs.alumniTopics),
  };
}

export function sanitizeProfileUpdate(updates: Partial<Profile>, catalogs: Catalogs = {}): Partial<Profile> {
  const next = { ...updates };

  if ('full_name' in next) next.full_name = repairTurkishText(next.full_name) || '';
  if ('nickname' in next) next.nickname = normalizeNickname(next.nickname);
  if ('university' in next) next.university = canonicalizeTurkishOption(next.university, catalogs.universities) || null;
  if ('department' in next) next.department = canonicalizeTurkishOption(next.department, catalogs.departments) || null;
  if ('field_of_study' in next) next.field_of_study = repairTurkishText(next.field_of_study) || null;
  if ('bio' in next) next.bio = repairTurkishText(next.bio) || null;
  if ('current_grade' in next) next.current_grade = canonicalizeTurkishOption(next.current_grade, catalogs.studentGrades) || null;
  if ('target_field' in next) next.target_field = canonicalizeTurkishOption(next.target_field, catalogs.targetFields) || null;
  if ('target_departments' in next) next.target_departments = sanitizeStringArray(next.target_departments, catalogs.departments);
  if ('target_universities' in next) next.target_universities = sanitizeStringArray(next.target_universities, catalogs.universities);
  if ('mentorship_expectations' in next) next.mentorship_expectations = sanitizeStringArray(next.mentorship_expectations, catalogs.expectations);
  if ('education_status' in next) next.education_status = canonicalizeTurkishOption(next.education_status, catalogs.educationStatuses) || null;
  if ('company_name' in next) next.company_name = repairTurkishText(next.company_name) || null;
  if ('work_title' in next) next.work_title = repairTurkishText(next.work_title) || null;
  if ('mentorship_topics' in next) next.mentorship_topics = sanitizeStringArray(next.mentorship_topics, catalogs.alumniTopics);

  return next;
}
