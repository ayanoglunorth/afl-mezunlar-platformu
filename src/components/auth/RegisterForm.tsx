'use client';

import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { parseStudentNumber } from '@/lib/csv-parser';
import { normalizeNickname, repairTurkishText, sanitizeStringArray } from '@/lib/turkish-text';
import universitiesData from '@/data/universities.json';
import { CompanyAutocomplete } from '@/components/forms/CompanyAutocomplete';
import { SearchableSelect } from '@/components/forms/SearchableSelect';
import { MultiSearchableSelect } from '@/components/forms/MultiSearchableSelect';
import { SiteNotice } from '@/components/ui/SiteNotice';

type Role = 'student' | 'alumni';

type RegistryEntry = {
  id: number;
  student_number: string;
  graduation_year: number;
  field_of_study: string | null;
};

type ActiveStudentRegistryEntry = {
  id: number;
  student_number: string;
  school_number: string;
  current_grade: string;
  class_section: string;
  expected_graduation_year: number;
};

type RegistryVerificationResponse =
  | { ok: true; entry: RegistryEntry }
  | { ok: false; error?: string };

type ActiveStudentVerificationResponse =
  | { ok: true; entry: ActiveStudentRegistryEntry }
  | { ok: false; error?: string };

const REGISTRY_INPUT_ERROR = 'Lütfen verdiğiniz bilgilerin doğruluğunu kontrol edin.';
const REGISTRY_SERVICE_ERROR = 'Doğrulama şu anda tamamlanamadı. Lütfen tekrar deneyin.';

const YKS_RETAKE_EDUCATION_STATUS = 'Sınava tekrar hazırlanıyorum.';
const OTHER_UNIVERSITY_VALUE = '__other_university__';
const allUniversities = Object.keys(universitiesData);
const STUDENT_GRADE_OPTIONS = [
  { value: '9. Sınıf', label: '9. Sınıf', disabled: true },
  { value: '10. Sınıf', label: '10. Sınıf', disabled: false },
  { value: '11. Sınıf', label: '11. Sınıf', disabled: false },
  { value: '12. Sınıf', label: '12. Sınıf', disabled: false },
  {
    value: 'YKS 2026 Yeni Mezun',
    label: 'YKS 2026 Yeni Mezun',
    disabled: false,
  },
] as const;
const ACTIVE_STUDENT_GRADES = new Set(['10. Sınıf', '11. Sınıf', '12. Sınıf']);
const CLASS_SECTION_OPTIONS = ['A', 'B', 'C'] as const;
const allDepartments = Array.from(new Set(
  Object.values(universitiesData).flatMap(faculties =>
    Object.values(faculties).flatMap(deps => deps)
  )
)).sort((a, b) => a.localeCompare(b, 'tr-TR'));

const EXPECTATIONS = [
  'Meslek ve Bölüm Seçimi',
  'YKS Çalışma Düzeni ve Motivasyon',
  'Üniversite, Staj ve Yurt Dışı',
  'Girişimcilik ve Projeler',
  'Sınav Stresi Yönetimi',
  'Genel Fikir Alışverişi',
];

const ALUMNI_TOPICS = [
  'Üniversite, meslek ve bölüm tanıtımı / tercihler',
  'YKS çalışma düzeni, motivasyon ve taktikler',
  'Sektör tanıtımı ve iş hayatına hazırlık / stajlar',
  'Yurt dışı eğitim imkanları ve Erasmus süreci',
  'Sınav psikolojisi ve stres yönetimi',
];

export function RegisterForm() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [role, setRole] = useState<Role>('student');

  const handleNextOrSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 2 && password !== passwordConfirm) {
      setError('Şifreler eşleşmiyor.');
      return;
    }
    setError('');

    if (step === 3) {
      setLoading(true);
      const canContinue = await verifyRegistryBeforeDetails();
      setLoading(false);
      if (!canContinue) return;
    }

    if (step < 4) {
      setStep((s) => (s + 1) as 1 | 2 | 3 | 4);
    } else {
      handleRegister();
    }
  };
  const [fullName, setFullName] = useState('');
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [graduationYear, setGraduationYear] = useState('');
  const [schoolNumber, setSchoolNumber] = useState('');
  const [forgotSchoolNumber, setForgotSchoolNumber] = useState(false);
  const [transferredFromSchool, setTransferredFromSchool] = useState(false);
  const [selectedUniversity, setSelectedUniversity] = useState('');
  const [otherUniversityName, setOtherUniversityName] = useState('');
  const [selectedFaculty, setSelectedFaculty] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');

  // Alumni specific states
  const [educationStatus, setEducationStatus] = useState('');
  const [isWorking, setIsWorking] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [companyLogo, setCompanyLogo] = useState('');
  const [workTitle, setWorkTitle] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const mentorshipCapacity = 5;
  const [alumniMentorshipTopics, setAlumniMentorshipTopics] = useState<string[]>([]);

  // Student states
  const [currentGrade, setCurrentGrade] = useState('');
  const targetField = '';
  const [targetDepartments, setTargetDepartments] = useState<string[]>([]);
  const [targetUniversities, setTargetUniversities] = useState<string[]>([]);
  const [expectations, setExpectations] = useState<string[]>([]);
  const [studentSchoolNumber, setStudentSchoolNumber] = useState('');
  const [studentClassSection, setStudentClassSection] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedKvkk, setAcceptedKvkk] = useState(false);

  const [verifiedRegistryEntry, setVerifiedRegistryEntry] = useState<RegistryEntry | null>(null);
  const [verifiedActiveStudentEntry, setVerifiedActiveStudentEntry] = useState<ActiveStudentRegistryEntry | null>(null);
  const [verifiedStudentNumber, setVerifiedStudentNumber] = useState('');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const shouldSkipSchoolNumber = forgotSchoolNumber || transferredFromSchool;

  function clearRegistryVerification() {
    setVerifiedRegistryEntry(null);
    setVerifiedActiveStudentEntry(null);
    setVerifiedStudentNumber('');
  }

  function getCleanFullName() {
    return repairTurkishText(fullName).toLocaleUpperCase('tr-TR');
  }

  function commitCleanFullName() {
    setFullName(getCleanFullName());
  }

  async function verifyRegistry(studentNumber: string, cleanedFullName: string) {
    let response: Response;
    try {
      response = await fetch('/api/auth/verify-registry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentNumber, fullName: cleanedFullName }),
      });
    } catch {
      setError(REGISTRY_SERVICE_ERROR);
      return null;
    }

    const result = await readRegistryResponse(response);
    if (!result.ok) {
      setError(result.error);
      return null;
    }

    let uniquenessResponse: Response;
    try {
      uniquenessResponse = await fetch('/api/auth/check-student-number', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentNumber: result.entry.student_number }),
      });
    } catch {
      setError(REGISTRY_SERVICE_ERROR);
      return null;
    }

    if (!uniquenessResponse.ok) {
      let uniquenessError = '';
      try {
        const uniquenessResult = await uniquenessResponse.json() as { error?: string };
        uniquenessError = uniquenessResult.error?.trim() || '';
      } catch {
        // A proxy/runtime error can return HTML instead of JSON.
      }
      setError(
        uniquenessError
        || (uniquenessResponse.status >= 500
          ? REGISTRY_SERVICE_ERROR
          : 'Bu okul numarasıyla daha önce bir hesap oluşturulmuş.'),
      );
      return null;
    }

    setVerifiedRegistryEntry(result.entry);
    setVerifiedStudentNumber(result.entry.student_number);
    return result.entry;
  }

  async function verifyRegistryByNameAndYear(cleanedFullName: string, year: number) {
    let response: Response;
    try {
      response = await fetch('/api/auth/verify-registry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: cleanedFullName,
          graduationYear: year,
          verificationMode: 'name-and-year',
        }),
      });
    } catch {
      setError(REGISTRY_SERVICE_ERROR);
      return null;
    }

    const result = await readRegistryResponse(response);
    if (!result.ok) {
      setError(result.error);
      return null;
    }

    setVerifiedRegistryEntry(result.entry);
    setVerifiedStudentNumber(`forgot:${result.entry.id}:${result.entry.graduation_year}`);
    return result.entry;
  }

  async function readRegistryResponse(
    response: Response,
  ): Promise<{ ok: true; entry: RegistryEntry } | { ok: false; error: string }> {
    let result: RegistryVerificationResponse | null = null;
    try {
      result = (await response.json()) as RegistryVerificationResponse;
    } catch {
      return { ok: false, error: REGISTRY_SERVICE_ERROR };
    }

    if (!response.ok || !result.ok) {
      const fallback = response.status >= 500 ? REGISTRY_SERVICE_ERROR : REGISTRY_INPUT_ERROR;
      const responseError = result && !result.ok ? result.error?.trim() : '';
      return { ok: false, error: responseError || fallback };
    }

    return result;
  }

  async function readActiveStudentResponse(
    response: Response,
  ): Promise<{ ok: true; entry: ActiveStudentRegistryEntry } | { ok: false; error: string }> {
    let result: ActiveStudentVerificationResponse | null = null;
    try {
      result = (await response.json()) as ActiveStudentVerificationResponse;
    } catch {
      return { ok: false, error: REGISTRY_SERVICE_ERROR };
    }

    if (!response.ok || !result.ok) {
      const fallback = response.status >= 500 ? REGISTRY_SERVICE_ERROR : REGISTRY_INPUT_ERROR;
      const responseError = result && !result.ok ? result.error?.trim() : '';
      return { ok: false, error: responseError || fallback };
    }

    return result;
  }

  async function verifyActiveStudent(cleanedFullName: string) {
    const cleanedSchoolNumber = studentSchoolNumber.trim().replace(/\D/g, '');
    const cleanedClassSection = repairTurkishText(studentClassSection).trim().toLocaleUpperCase('tr-TR');

    if (!/^\d{1,8}$/.test(cleanedSchoolNumber) || !ACTIVE_STUDENT_GRADES.has(currentGrade) || !cleanedClassSection) {
      setError(REGISTRY_INPUT_ERROR);
      return null;
    }

    let response: Response;
    try {
      response = await fetch('/api/auth/verify-active-student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolNumber: cleanedSchoolNumber,
          fullName: cleanedFullName,
          currentGrade,
          classSection: cleanedClassSection,
        }),
      });
    } catch {
      setError(REGISTRY_SERVICE_ERROR);
      return null;
    }

    const result = await readActiveStudentResponse(response);
    if (!result.ok) {
      setError(result.error);
      return null;
    }

    setVerifiedActiveStudentEntry(result.entry);
    setVerifiedStudentNumber(result.entry.student_number);
    setStudentSchoolNumber(result.entry.school_number);
    setStudentClassSection(result.entry.class_section);
    return result.entry;
  }

  async function verifyRegistryBeforeDetails() {
    const cleanedFullName = getCleanFullName();
    setFullName(cleanedFullName);

    if (role === 'alumni') {
      const graduationYearNumber = Number(graduationYear);
      const currentYear = new Date().getFullYear();
      if (
        graduationYear.length !== 4
        || !Number.isInteger(graduationYearNumber)
        || graduationYearNumber < 1900
        || graduationYearNumber > currentYear
      ) {
        setError('Lütfen geçerli bir mezuniyet yılı giriniz.');
        return false;
      }

      if (transferredFromSchool) {
        clearRegistryVerification();
        return true;
      }

      if (forgotSchoolNumber) {
        const verificationKey = verifiedRegistryEntry
          ? `forgot:${verifiedRegistryEntry.id}:${verifiedRegistryEntry.graduation_year}`
          : '';
        if (verificationKey && verifiedStudentNumber === verificationKey) {
          return true;
        }

        return Boolean(await verifyRegistryByNameAndYear(cleanedFullName, graduationYearNumber));
      }

      const parsed = parseStudentNumber(`${graduationYear}${schoolNumber}`);
      if (!parsed) {
        setError('Geçersiz mezuniyet yılı veya lise okul numarası formatı.');
        return false;
      }

      if (verifiedRegistryEntry && verifiedStudentNumber === parsed.studentNumber) {
        return true;
      }

      return Boolean(await verifyRegistry(parsed.studentNumber, cleanedFullName));
    }

    if (ACTIVE_STUDENT_GRADES.has(currentGrade)) {
      const cleanedSchoolNumber = studentSchoolNumber.trim().replace(/\D/g, '');
      const cleanedClassSection = repairTurkishText(studentClassSection).trim().toLocaleUpperCase('tr-TR');
      const activeVerificationKey = verifiedActiveStudentEntry
        ? `${verifiedActiveStudentEntry.id}:${verifiedActiveStudentEntry.student_number}:${verifiedActiveStudentEntry.current_grade}:${verifiedActiveStudentEntry.class_section}`
        : '';
      const nextVerificationKey = verifiedActiveStudentEntry
        ? `${verifiedActiveStudentEntry.id}:${verifiedActiveStudentEntry.student_number}:${currentGrade}:${cleanedClassSection}`
        : '';

      if (
        activeVerificationKey
        && activeVerificationKey === nextVerificationKey
        && verifiedActiveStudentEntry?.school_number === cleanedSchoolNumber
      ) {
        return true;
      }

      return Boolean(await verifyActiveStudent(cleanedFullName));
    }

    if (currentGrade !== 'YKS 2026 Yeni Mezun') {
      setError('Lütfen geçerli bir sınıf seçiniz.');
      return false;
    }

    const parsed = parseStudentNumber(`2026${studentSchoolNumber}`);
    if (!parsed) {
      setError('Geçersiz lise okul numarası formatı.');
      return false;
    }

    if (verifiedRegistryEntry && verifiedStudentNumber === parsed.studentNumber) {
      return true;
    }

    return Boolean(await verifyRegistry(parsed.studentNumber, cleanedFullName));
  }



  async function handleRegister() {
    setError('');
    setLoading(true);

    try {


      const cleanedFullName = getCleanFullName();
      setFullName(cleanedFullName);
      const cleanedNickname = normalizeNickname(nickname);
      const isRetakingYks = educationStatus === YKS_RETAKE_EDUCATION_STATUS;
      const cleanedUniversity = isRetakingYks
        ? null
        : repairTurkishText(selectedUniversity === OTHER_UNIVERSITY_VALUE ? otherUniversityName : selectedUniversity);
      const cleanedDepartment = isRetakingYks ? null : repairTurkishText(selectedDepartment);
      const cleanedEducationStatus = repairTurkishText(educationStatus);
      const cleanedCompanyName = repairTurkishText(companyName);
      const cleanedWorkTitle = repairTurkishText(workTitle);
      const cleanedTargetField = repairTurkishText(targetField);
      const cleanedTargetDepartments = sanitizeStringArray(targetDepartments, allDepartments);
      const cleanedTargetUniversities = sanitizeStringArray(targetUniversities, allUniversities);
      const cleanedExpectations = sanitizeStringArray(expectations, EXPECTATIONS);
      const cleanedMentorshipTopics = sanitizeStringArray(alumniMentorshipTopics, ALUMNI_TOPICS);

      // If alumni, verify against alumni registry unless the user needs admin review.
      if (role === 'alumni') {
        let registryEntry: RegistryEntry | null = null;
        let isVerified = true;
        const registrationReviewReason = transferredFromSchool
          ? 'transferred_from_school'
          : forgotSchoolNumber
            ? 'forgot_school_number'
            : null;

        if (transferredFromSchool) {
          registryEntry = null;
          isVerified = false;
        } else if (forgotSchoolNumber) {
          const verifiedForgottenNumber = verifiedRegistryEntry
            && verifiedStudentNumber === `forgot:${verifiedRegistryEntry.id}:${verifiedRegistryEntry.graduation_year}`
            && verifiedRegistryEntry.graduation_year === Number(graduationYear);
          if (!verifiedForgottenNumber) {
            setError('Mezuniyet bilgileriniz doğrulanamadı. Lütfen önceki adıma dönüp tekrar deneyin.');
            setLoading(false);
            return;
          }

          registryEntry = verifiedRegistryEntry;
          
          // Name and graduation year are matched server-side, but the account
          // remains unverified until an admin confirms the registration.
          isVerified = false;
        } else {
          const constructedStudentNumber = `${graduationYear}${schoolNumber}`;
          const parsed = parseStudentNumber(constructedStudentNumber);
          if (!parsed) {
            setError('Geçersiz mezuniyet yılı veya lise okul numarası formatı.');
            setLoading(false);
            return;
          }

          const result = await verifyRegistry(parsed.studentNumber, cleanedFullName);
          if (!result) {
            setLoading(false);
            return;
          }

          registryEntry = result;
        }

        // Register with Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            data: {
              full_name: cleanedFullName,
              nickname: cleanedNickname,
              role: 'alumni',
              registry_entry_id: registryEntry?.id || null,
              registration_review_reason: registrationReviewReason,
              registration_registry_entry_id: registrationReviewReason === 'forgot_school_number' ? registryEntry?.id || null : null,
              student_number: registryEntry?.student_number || null,
              graduation_year: registryEntry?.graduation_year || parseInt(graduationYear, 10),
              field_of_study: registryEntry?.field_of_study ? repairTurkishText(registryEntry.field_of_study) : null,
              university: cleanedUniversity,
              department: cleanedDepartment,
              education_status: cleanedEducationStatus,
              is_working: isWorking,
              company_name: isWorking ? cleanedCompanyName : null,
              company_logo: isWorking ? companyLogo : null,
              work_title: isWorking ? cleanedWorkTitle : null,
              linkedin_url: linkedinUrl || null,
              mentorship_capacity: mentorshipCapacity,
              mentorship_availability: 'active',
              mentorship_topics: cleanedMentorshipTopics,
              is_verified: isVerified,
              is_profile_complete: true
            },
          },
        });

        if (authError) {
          setError(authError.message === 'User already registered'
            ? 'Bu e-posta adresi zaten kayıtlı.'
            : authError.message);
          setLoading(false);
          return;
        }

        if (authData.user?.identities && authData.user.identities.length === 0) {
          setError('Bu e-posta adresi sistemde zaten kayıtlı. Lütfen giriş yapın veya farklı bir adres kullanın.');
          setLoading(false);
          return;
        }
      } else {
        // Student registration
        let registryEntry: RegistryEntry | null = null;
        let activeStudentEntry: ActiveStudentRegistryEntry | null = null;

        if (currentGrade === 'YKS 2026 Yeni Mezun') {
          const constructedStudentNumber = `2026${studentSchoolNumber}`;
          const parsed = parseStudentNumber(constructedStudentNumber);
          
          if (!parsed) {
            setError('Geçersiz lise okul numarası formatı.');
            setLoading(false);
            return;
          }

          const result = await verifyRegistry(parsed.studentNumber, cleanedFullName);
          if (!result) {
            setLoading(false);
            return;
          }

          registryEntry = result;
        } else if (ACTIVE_STUDENT_GRADES.has(currentGrade)) {
          const result = await verifyActiveStudent(cleanedFullName);
          if (!result) {
            setLoading(false);
            return;
          }

          activeStudentEntry = result;
        } else {
          setError('Lütfen geçerli bir sınıf seçiniz.');
          setLoading(false);
          return;
        }

        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            data: {
              full_name: cleanedFullName,
              nickname: cleanedNickname,
              role: 'student',
              registry_entry_id: registryEntry?.id || null,
              graduation_year: registryEntry?.graduation_year || null,
              active_student_registry_entry_id: activeStudentEntry?.id || null,
              school_number: activeStudentEntry?.school_number || null,
              class_section: activeStudentEntry?.class_section || null,
              is_verified: Boolean(registryEntry || activeStudentEntry),
              student_number: registryEntry?.student_number || activeStudentEntry?.student_number || null,
              current_grade: registryEntry ? currentGrade : activeStudentEntry?.current_grade || currentGrade,
              field_of_study: cleanedTargetField,
              target_field: cleanedTargetField,
              target_departments: cleanedTargetDepartments,
              target_universities: cleanedTargetUniversities,
              mentorship_expectations: cleanedExpectations,
              is_profile_complete: true
            },
          },
        });

        if (authError) {
          setError(authError.message === 'User already registered'
            ? 'Bu e-posta adresi zaten kayıtlı.'
            : authError.message);
          setLoading(false);
          return;
        }

        if (authData.user?.identities && authData.user.identities.length === 0) {
          setError('Bu e-posta adresi sistemde zaten kayıtlı. Lütfen giriş yapın veya farklı bir adres kullanın.');
          setLoading(false);
          return;
        }
      }


      router.push(role === 'alumni' && shouldSkipSchoolNumber ? '/onay-bekliyor' : '/email-dogrulama');
    } catch {
      setError('Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.');
    }

    setLoading(false);
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-8 fade-in">
        {/* Logo */}
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <Image src="/afl-logo.svg" alt="AFL Logo" width={841} height={493} loading="eager" className="h-20 w-auto" />
          </Link>
          <h1 className="text-2xl font-bold text-surface-900 mt-6">Hesap Oluştur</h1>
          <p className="text-surface-500 mt-2">Mentörlük ağına katıl</p>
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <p className="text-center text-sm font-medium text-surface-600">Rolünü seç</p>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => { setRole('student'); setStep(2); }}
                className="card-hover cursor-pointer text-center space-y-3 active:scale-[0.98] transition-transform"
              >
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center mx-auto">
                  <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <h3 className="text-base font-semibold text-surface-900">Öğrenci</h3>
                <p className="text-xs text-surface-500">Mentorluk almak istiyorum</p>
              </button>
              <button
                onClick={() => { setRole('alumni'); setStep(2); }}
                className="card-hover cursor-pointer text-center space-y-3 active:scale-[0.98] transition-transform"
              >
                <div className="w-12 h-12 rounded-2xl bg-brand-500/10 flex items-center justify-center mx-auto">
                  <svg className="w-6 h-6 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path d="M12 14l9-5-9-5-9 5 9 5z" />
                    <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
                  </svg>
                </div>
                <h3 className="text-base font-semibold text-surface-900">Mezun</h3>
                <p className="text-xs text-surface-500">Mentorluk vermek istiyorum</p>
              </button>
            </div>
          </div>
        )}

        {step >= 2 && (
          <form onSubmit={handleNextOrSubmit} className="card space-y-5">
            <div className="flex items-center gap-2 mb-6">
              {[2, 3, 4].map(s => (
                <div key={s} className="flex-1">
                  <div className={`h-1.5 rounded-full transition-colors ${step >= s ? (role === 'student' ? 'bg-blue-500' : 'bg-brand-500') : 'bg-surface-200'}`} />
                </div>
              ))}
            </div>

            {error && (
              <SiteNotice type="error" message={error} onDismiss={() => setError('')} />
            )}

            <div className="flex items-center gap-2 mb-2">
              <button
                type="button"
                onClick={() => {
                  if (step > 2) setStep((s) => (s - 1) as 1 | 2 | 3 | 4);
                  else { setStep(1); setError(''); }
                }}
                className="btn-ghost p-1.5 rounded-lg"
              >
                <svg className="w-4 h-4 text-surface-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className={`badge ${role === 'student' ? 'badge-student' : 'badge-alumni'}`}>
                {role === 'student' ? 'Öğrenci' : 'Mezun'} Kaydı - Adım {step - 1}/3
              </span>
            </div>

            {step === 2 && (
              <div className="space-y-4 animate-in slide-in-from-right-4 duration-300 fade-in">
                <div>
                  <label htmlFor="fullName" className="label">Ad Soyad</label>
                  <input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => {
                      setFullName(e.target.value.toLocaleUpperCase('tr-TR'));
                      clearRegistryVerification();
                    }}
                    onBlur={commitCleanFullName}
                    placeholder="Kimlikteki isminizi yazın"
                    required
                    className="input"
                  />
                  {role === 'alumni' && (
                    <p className="text-xs text-surface-500 mt-1">
                      Mezun veri tabanındaki isminizi yazın
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="nickname" className="label">Nickname</label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-surface-400">@</span>
                    <input
                      id="nickname"
                      type="text"
                      value={nickname}
                      onChange={(e) => setNickname(normalizeNickname(e.target.value) || e.target.value.replace(/^@+/, '').toLocaleLowerCase('en-US'))}
                      placeholder="ornek.nickname"
                      className="input pl-8"
                      minLength={3}
                      maxLength={32}
                      pattern="[a-z0-9][a-z0-9._]{1,30}[a-z0-9]"
                    />
                  </div>
                  <p className="mt-1 text-xs text-surface-500">İsteğe bağlı. Harf, rakam, nokta ve alt çizgi kullanabilirsin.</p>
                </div>

                <div>
                  <label htmlFor="email" className="label">E-posta</label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                    }}
                    placeholder="ornek@email.com"
                    required
                    className="input"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="label">Şifre</label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="En az 6 karakter"
                      required
                      minLength={6}
                      className="input pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 focus:outline-none"
                    >
                      {showPassword ? (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="passwordConfirm" className="label">Şifre (Tekrar)</label>
                  <div className="relative">
                    <input
                      id="passwordConfirm"
                      type={showPassword ? "text" : "password"}
                      value={passwordConfirm}
                      onChange={(e) => setPasswordConfirm(e.target.value)}
                      placeholder="Şifrenizi tekrar girin"
                      required
                      minLength={6}
                      className="input pr-10"
                    />
                  </div>
                </div>
              </div>
            )}

            {step === 3 && role === 'alumni' && (
              <div className="space-y-4 animate-in slide-in-from-right-4 duration-300 fade-in">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="graduationYear" className="label">Mezuniyet Yılı</label>
                    <input
                      id="graduationYear"
                      type="number"
                      value={graduationYear}
                      onChange={(e) => {
                        setGraduationYear(e.target.value);
                        clearRegistryVerification();
                      }}
                      placeholder="2022"
                      required
                      min={1900}
                      max={2100}
                      className="input"
                    />
                  </div>
                  {!shouldSkipSchoolNumber && (
                    <div>
                      <label htmlFor="schoolNumber" className="label">Lise Okul Numarası</label>
                      <input
                        id="schoolNumber"
                        type="number"
                        value={schoolNumber}
                        onChange={(e) => {
                          setSchoolNumber(e.target.value);
                          clearRegistryVerification();
                        }}
                        placeholder="34"
                        required={!shouldSkipSchoolNumber}
                        className="input"
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="forgotSchoolNumber"
                    checked={forgotSchoolNumber}
                    onChange={(e) => {
                      setForgotSchoolNumber(e.target.checked);
                      if (e.target.checked) setSchoolNumber('');
                      clearRegistryVerification();
                    }}
                    className="w-4 h-4 rounded border-surface-300 text-brand-500 focus:ring-brand-500"
                  />
                  <label htmlFor="forgotSchoolNumber" className="text-sm text-surface-600 cursor-pointer select-none">
                    Lise okul numaramı hatırlamıyorum
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="transferredFromSchool"
                    checked={transferredFromSchool}
                    onChange={(e) => {
                      setTransferredFromSchool(e.target.checked);
                      if (e.target.checked) setSchoolNumber('');
                      clearRegistryVerification();
                    }}
                    className="w-4 h-4 rounded border-surface-300 text-brand-500 focus:ring-brand-500"
                  />
                  <label htmlFor="transferredFromSchool" className="text-sm text-surface-600 cursor-pointer select-none">
                    Nakil ile okuldan ayr&#305;ld&#305;m ve ba&#351;ka bir liseden mezun oldum
                  </label>
                </div>

                <div>
                  <label htmlFor="educationStatus" className="label">Önümüzdeki güz döneminde lisans kaçıncı sınıfta olacaksınız?</label>
                  <select
                    id="educationStatus"
                    value={educationStatus}
                    onChange={(e) => {
                      const nextEducationStatus = e.target.value;
                      setEducationStatus(nextEducationStatus);
                      if (nextEducationStatus === YKS_RETAKE_EDUCATION_STATUS) {
                        setSelectedUniversity('');
                        setSelectedFaculty('');
                        setSelectedDepartment('');
                      }
                    }}
                    required
                    className="input appearance-none bg-white"
                  >
                    <option value="">Seçiniz</option>
                    <option value={YKS_RETAKE_EDUCATION_STATUS}>{YKS_RETAKE_EDUCATION_STATUS}</option>
                    <option value="Hazırlık">Hazırlık</option>
                    <option value="1. Sınıf">1. Sınıf</option>
                    <option value="2. Sınıf">2. Sınıf</option>
                    <option value="3. Sınıf">3. Sınıf</option>
                    <option value="4. Sınıf">4. Sınıf</option>
                    <option value="5. Sınıf">5. Sınıf</option>
                    <option value="6. Sınıf">6. Sınıf</option>
                    <option value="Yüksek Lisans / Doktora">Yüksek Lisans / Doktora</option>
                    <option value="Mezun">Mezun</option>
                  </select>
                </div>

                {educationStatus && educationStatus !== YKS_RETAKE_EDUCATION_STATUS && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <label htmlFor="university" className="label">
                      {educationStatus === 'Mezun' ? 'Mezun Olduğunuz Üniversite' : 'Okumakta Olduğunuz Üniversite'}
                    </label>
                    <SearchableSelect
                      id="university"
                      options={allUniversities}
                      value={selectedUniversity}
                      onChange={(val) => {
                        setSelectedUniversity(val);
                        setSelectedFaculty('');
                        setSelectedDepartment('');
                        if (val !== OTHER_UNIVERSITY_VALUE) setOtherUniversityName('');
                      }}
                      placeholder="Üniversite Ara..."
                      allowOther
                    />
                  </div>
                )}

                {selectedUniversity === OTHER_UNIVERSITY_VALUE && (
                  <>
                    <div>
                      <label htmlFor="otherUniversityName" className="label">Üniversite adı</label>
                      <input
                        id="otherUniversityName"
                        value={otherUniversityName}
                        onChange={(event) => setOtherUniversityName(event.target.value)}
                        required
                        maxLength={160}
                        className="input"
                        placeholder="Üniversitenizin adı"
                      />
                    </div>
                    <div>
                      <label htmlFor="otherUniversityDepartment" className="label">Bölüm</label>
                      <input
                        id="otherUniversityDepartment"
                        value={selectedDepartment}
                        onChange={(event) => setSelectedDepartment(event.target.value)}
                        required
                        maxLength={160}
                        className="input"
                        placeholder="Okuduğunuz bölüm"
                      />
                    </div>
                  </>
                )}

                {selectedUniversity && selectedUniversity !== OTHER_UNIVERSITY_VALUE && (
                  <div>
                    <label htmlFor="faculty" className="label">Fakülte</label>
                    <select
                      id="faculty"
                      value={selectedFaculty}
                      onChange={(e) => {
                        setSelectedFaculty(e.target.value);
                        setSelectedDepartment('');
                      }}
                      required
                      className="input appearance-none bg-white"
                    >
                      <option value="">Seçiniz</option>
                      {Object.keys((universitiesData as Record<string, Record<string, string[]>>)[selectedUniversity] || {}).map(fac => (
                        <option key={fac} value={fac}>{fac}</option>
                      ))}
                    </select>
                  </div>
                )}

                {selectedFaculty && (
                  <div>
                    <label htmlFor="department" className="label">Bölüm</label>
                    <select
                      id="department"
                      value={selectedDepartment}
                      onChange={(e) => setSelectedDepartment(e.target.value)}
                      required
                      className="input appearance-none bg-white"
                    >
                      <option value="">Seçiniz</option>
                      {((universitiesData as Record<string, Record<string, string[]>>)[selectedUniversity]?.[selectedFaculty] || []).map((dep: string) => (
                        <option key={dep} value={dep}>{dep}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {step === 4 && role === 'alumni' && (
              <div className="space-y-4 animate-in slide-in-from-right-4 duration-300 fade-in">
                <div className="flex items-center justify-between p-3 rounded-lg border border-surface-200 bg-surface-50">
                  <div>
                    <div className="text-sm font-medium text-surface-900">Çalışıyor musunuz?</div>
                    <div className="text-xs text-surface-500">Aktif olarak bir şirkette çalışıyorsanız işaretleyin</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={isWorking}
                      onChange={(e) => {
                        setIsWorking(e.target.checked);
                        if (!e.target.checked) {
                          setCompanyName('');
                          setCompanyLogo('');
                        }
                      }}
                    />
                    <div className="w-11 h-6 bg-surface-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-surface-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-500"></div>
                  </label>
                </div>

                {isWorking && (
                  <div className="animate-in slide-in-from-top-2 duration-200 space-y-4">
                    <div>
                      <label className="label">Şirket Adı</label>
                      <CompanyAutocomplete
                        value={companyName}
                        logo={companyLogo}
                        onChange={(name, logo) => {
                          setCompanyName(name);
                          setCompanyLogo(logo);
                        }}
                      />
                    </div>
                    <div>
                      <label htmlFor="workTitle" className="label">Çalışma Düzeyi</label>
                      <select
                        id="workTitle"
                        value={workTitle}
                        onChange={(e) => setWorkTitle(e.target.value)}
                        required={isWorking}
                        className="input appearance-none bg-white"
                      >
                        <option value="">Seçiniz</option>
                        <option value="Stajyer">Stajyer</option>
                        <option value="Yeni Mezun / Junior">Yeni Mezun / Junior</option>
                        <option value="Uzman / Mid-Level">Uzman / Mid-Level</option>
                        <option value="Kıdemli / Senior">Kıdemli / Senior</option>
                        <option value="Yönetici / Manager">Yönetici / Manager</option>
                        <option value="Kurucu / Founder">Kurucu / Founder</option>
                        <option value="Freelance / Bağımsız">Freelance / Bağımsız</option>
                      </select>
                    </div>
                  </div>
                )}

                <div>
                  <label htmlFor="linkedinUrl" className="label">LinkedIn Profil Linki</label>
                  <input
                    id="linkedinUrl"
                    type="url"
                    value={linkedinUrl}
                    onChange={(e) => setLinkedinUrl(e.target.value)}
                    placeholder="https://linkedin.com/in/username"
                    className="input"
                  />
                  <p className="text-xs text-surface-500 mt-1">Öğrencilerin sizi daha iyi tanıması için (Opsiyonel)</p>
                </div>

                <div className="rounded-xl border border-surface-200 bg-surface-50 p-4">
                  <p className="text-sm font-semibold text-surface-900">Tercih mentorluğu kapasitesi</p>
                  <p className="text-xs text-surface-500 mt-1">2026 tercih mentorluğu için kapasite en fazla 5 aktif öğrenci olarak uygulanır.</p>
                </div>

                <div>
                  <label className="label">Hangi Konularda Mentörlük Verebilirsiniz?</label>
                  <div className="space-y-2 mt-2">
                    {[
                      'Üniversite, meslek ve bölüm tanıtımı / tercihler',
                      'YKS çalışma düzeni, motivasyon ve taktikler',
                      'Sektör tanıtımı ve iş hayatına hazırlık / stajlar',
                      'Yurt dışı eğitim imkanları ve Erasmus süreci',
                      'Sınav psikolojisi ve stres yönetimi'
                    ].map(topic => (
                      <label key={topic} className="flex items-start gap-3 cursor-pointer group">
                        <div className="relative flex items-center justify-center w-5 h-5 mt-0.5 border rounded border-surface-300 group-hover:border-brand-500 bg-white transition-colors">
                          <input
                            type="checkbox"
                            className="absolute opacity-0 cursor-pointer"
                            checked={alumniMentorshipTopics.includes(topic)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setAlumniMentorshipTopics([...alumniMentorshipTopics, topic]);
                              } else {
                                setAlumniMentorshipTopics(alumniMentorshipTopics.filter(t => t !== topic));
                              }
                            }}
                          />
                          {alumniMentorshipTopics.includes(topic) && (
                            <svg className="w-3.5 h-3.5 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <span className="text-sm text-surface-700 leading-snug">{topic}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === 3 && role === 'student' && (
              <div className="space-y-4 animate-in slide-in-from-right-4 duration-300 fade-in">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label htmlFor="studentSchoolNumber" className="label">Okul Numarası</label>
                    <input
                      id="studentSchoolNumber"
                      type="text"
                      value={studentSchoolNumber}
                      onChange={(e) => {
                        setStudentSchoolNumber(e.target.value);
                        clearRegistryVerification();
                      }}
                      placeholder="1234"
                      required
                      className="input"
                    />
                  </div>
                  <div>
                    <label htmlFor="currentGrade" className="label">Sınıf (Yeni Dönem)</label>
                    <select
                      id="currentGrade"
                      value={currentGrade}
                      onChange={(e) => {
                        setCurrentGrade(e.target.value);
                        clearRegistryVerification();
                      }}
                      required
                      className="input appearance-none bg-white"
                    >
                      <option value="">Seçiniz</option>
                      {STUDENT_GRADE_OPTIONS.map((grade) => (
                        <option
                          key={grade.value}
                          value={grade.value}
                          disabled={grade.disabled}
                        >
                          {grade.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="studentClassSection" className="label">Şube</label>
                    <select
                      id="studentClassSection"
                      value={studentClassSection}
                      onChange={(e) => {
                        setStudentClassSection(e.target.value);
                        clearRegistryVerification();
                      }}
                      required={ACTIVE_STUDENT_GRADES.has(currentGrade)}
                      className="input appearance-none bg-white"
                    >
                      <option value="">Seçiniz</option>
                      {CLASS_SECTION_OPTIONS.map((section) => (
                        <option key={section} value={section}>{section}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {step === 4 && role === 'student' && (
              <div className="space-y-4 animate-in slide-in-from-right-4 duration-300 fade-in">
                <div>
                  <label className="label">İlgi Duyduğu Bölümler (En fazla 4)</label>
                  <MultiSearchableSelect
                    id="targetDepartments"
                    options={allDepartments}
                    value={targetDepartments}
                    onChange={setTargetDepartments}
                    placeholder="Bölüm ara..."
                    maxSelections={4}
                  />
                </div>

                <div>
                  <label className="label">Hedef Üniversiteler</label>
                  <MultiSearchableSelect
                    id="targetUniversities"
                    options={allUniversities}
                    value={targetUniversities}
                    onChange={setTargetUniversities}
                    placeholder="Üniversite ara..."
                  />
                </div>

                <div>
                  <label className="label">Mentorluk Beklentisi</label>
                  <div className="space-y-2 mt-2">
                    {[
                      'Meslek ve Bölüm Seçimi',
                      'YKS Çalışma Düzeni ve Motivasyon',
                      'Üniversite, Staj ve Yurt Dışı',
                      'Girişimcilik ve Projeler',
                      'Sınav Stresi Yönetimi',
                      'Genel Fikir Alışverişi',
                    ].map(exp => (
                      <label key={exp} className="flex items-start gap-3 cursor-pointer group">
                        <div className="relative flex items-center justify-center w-5 h-5 mt-0.5 border rounded border-surface-300 group-hover:border-brand-500 bg-white transition-colors">
                          <input
                            type="checkbox"
                            className="absolute opacity-0 cursor-pointer"
                            checked={expectations.includes(exp)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setExpectations([...expectations, exp]);
                              } else {
                                setExpectations(expectations.filter(e => e !== exp));
                              }
                            }}
                          />
                          {expectations.includes(exp) && (
                            <svg className="w-3.5 h-3.5 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <span className="text-sm text-surface-700 leading-snug">{exp}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-3 mt-4 animate-in fade-in duration-300">

                <div className="flex items-start gap-3">
                  <div className="relative flex items-center justify-center w-5 h-5 mt-0.5 border rounded border-surface-300 hover:border-brand-500 bg-white transition-colors">
                    <input
                      type="checkbox"
                      id="acceptedTerms"
                      required
                      className="absolute opacity-0 cursor-pointer w-full h-full z-10"
                      checked={acceptedTerms}
                      onChange={(e) => setAcceptedTerms(e.target.checked)}
                    />
                    {acceptedTerms && (
                      <svg className="w-3.5 h-3.5 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <label htmlFor="acceptedTerms" className="text-sm text-surface-600 leading-snug cursor-pointer select-none">
                    <Link href="/kullanici-sozlesmesi" target="_blank" className="text-brand-500 hover:underline">Kullanıcı Sözleşmesi</Link>&apos;ni okudum ve kabul ediyorum.
                  </label>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="relative flex items-center justify-center w-5 h-5 mt-0.5 border rounded border-surface-300 hover:border-brand-500 bg-white transition-colors">
                    <input
                      type="checkbox"
                      id="acceptedKvkk"
                      required
                      className="absolute opacity-0 cursor-pointer w-full h-full z-10"
                      checked={acceptedKvkk}
                      onChange={(e) => setAcceptedKvkk(e.target.checked)}
                    />
                    {acceptedKvkk && (
                      <svg className="w-3.5 h-3.5 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <label htmlFor="acceptedKvkk" className="text-sm text-surface-600 leading-snug cursor-pointer select-none">
                    <Link href="/kvkk" target="_blank" className="text-brand-500 hover:underline">KVKK Aydınlatma Metni</Link>&apos;ni okudum ve kabul ediyorum.
                  </label>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 mt-4"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Kayıt oluşturuluyor...
                </span>
              ) : (
                step < 4 ? 'Devam Et' : 'Kayıt Ol'
              )}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-surface-500">
          Zaten hesabın var mı?{' '}
          <Link href="/giris" className="text-brand-400 hover:text-brand-300 font-medium">
            Giriş Yap
          </Link>
        </p>
      </div>
    </div>
  );
}
