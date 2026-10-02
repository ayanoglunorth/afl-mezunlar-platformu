import { repairTurkishText } from '@/lib/turkish-text';
import type { Profile } from '@/types/database';

interface MatchResult {
  userId: string;
  score: number;
  reasons: string[];
}

export interface MentorshipRecommendation {
  mentor: Profile;
  score: number;
  reasons: string[];
  activeStudentCount: number;
  isAtCapacity: boolean;
}

function normalize(value: string | null | undefined) {
  return repairTurkishText(value)
    .toLocaleLowerCase('tr-TR')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasTextMatch(source: string | null | undefined, targets: string[] | null | undefined) {
  const sourceText = normalize(source);
  if (!sourceText || !targets?.length) return false;
  return targets.some((target) => {
    const targetText = normalize(target);
    return !!targetText && (sourceText.includes(targetText) || targetText.includes(sourceText));
  });
}

function hasAnyTopicMatch(mentorTopics: string[] | null | undefined, expectations: string[] | null | undefined) {
  if (!mentorTopics?.length || !expectations?.length) return false;

  return mentorTopics.some((topic) =>
    expectations.some((expectation) => {
      const topicText = normalize(topic);
      const expectationText = normalize(expectation);
      return (
        topicText.includes(expectationText.split(' ')[0]) ||
        expectationText.includes(topicText.split(' ')[0]) ||
        topicText.includes('tercih') ||
        topicText.includes('bölüm')
      );
    })
  );
}

function isSameDepartmentFamily(department: string | null | undefined, targets: string[] | null | undefined) {
  const departmentText = normalize(department);
  if (!departmentText || !targets?.length) return false;

  const familySignals = [
    ['mühendis', 'bilgisayar', 'yazılım', 'elektrik', 'makine', 'endüstri', 'inşaat'],
    ['tıp', 'diş', 'eczac', 'hemşire', 'sağlık'],
    ['hukuk'],
    ['işletme', 'iktisat', 'ekonomi', 'yönetim', 'finans'],
    ['psikoloji', 'sosyoloji', 'pdr'],
    ['mimarlık', 'tasarım', 'sanat'],
    ['dil', 'ingiliz', 'çeviri', 'tercüman'],
  ];

  return familySignals.some((family) =>
    family.some((signal) => departmentText.includes(signal)) &&
    targets.some((target) => family.some((signal) => normalize(target).includes(signal)))
  );
}

export function calculateMentorshipRecommendation(
  student: Profile,
  mentor: Profile,
  activeStudentCount: number,
): MentorshipRecommendation | null {
  if (student.role !== 'student' || mentor.role !== 'alumni') return null;
  const mentorCapacity = mentor.mentorship_capacity || 5;
  if (
    !mentor.is_profile_complete
    || !mentor.is_verified
    || mentor.mentorship_availability !== 'active'
    || activeStudentCount >= mentorCapacity
  ) return null;

  const reasons: string[] = [];
  let baseScore = 0;

  if (hasTextMatch(mentor.department, student.target_departments)) {
    baseScore += 42;
    reasons.push('Hedef bölümünle uyumlu');
  }

  if (hasTextMatch(mentor.university, student.target_universities)) {
    baseScore += 28;
    reasons.push('Hedef üniversitende okuyor/okumuş');
  }

  if (isSameDepartmentFamily(mentor.department, student.target_departments)) {
    baseScore += 16;
    reasons.push('Bölüm ailesi hedeflerinle yakın');
  }

  if (hasAnyTopicMatch(mentor.mentorship_topics, student.mentorship_expectations)) {
    baseScore += 18;
    reasons.push('Tercih ve bölüm seçimi konusunda destek verebilir');
  }

  // Yüksek seçicilik: Temel kriterlerden (bölüm, üniversite, beklenti) hiçbir uyum yoksa,
  // sadece kapasite veya çalışma durumundan dolayı mentor önerilmemelidir.
  if (baseScore === 0) return null;

  let bonusScore = 0;
  if (mentor.is_working || mentor.work_title || mentor.company_name) {
    bonusScore += 8;
    reasons.push('Aktif sektör deneyimi');
  }

  if (activeStudentCount >= mentorCapacity) {
    bonusScore -= 50;
  } else {
    bonusScore += Math.max(0, 10 - activeStudentCount * 2);
  }

  const score = baseScore + bonusScore;
  if (score <= 0) return null;

  return {
    mentor,
    score,
    reasons: reasons.slice(0, 4),
    activeStudentCount,
    isAtCapacity: activeStudentCount >= mentorCapacity,
  };
}

export function generateMentorshipRecommendations(
  student: Profile,
  mentors: Profile[],
  activeCountsByMentorId: Map<string, number>,
) {
  return mentors
    .filter((mentor) => mentor.is_profile_complete && mentor.is_verified && mentor.mentorship_availability === 'active' && (activeCountsByMentorId.get(mentor.id) || 0) < (mentor.mentorship_capacity || 5))
    .map((mentor) => calculateMentorshipRecommendation(student, mentor, activeCountsByMentorId.get(mentor.id) || 0))
    .filter((item): item is MentorshipRecommendation => Boolean(item))
    .sort((a, b) => b.score - a.score);
}

/**
 * Calculate match suggestions for a user based on shared interests and departments
 *
 * Scoring:
 * - Same department: +40
 * - Each shared interest (max 3 counted): +15
 * - Field of study matches student interest: +10
 * - Same graduation decade: +5
 */
export function calculateMatchScore(userA: Profile, userB: Profile): MatchResult | null {
  if (userA.id === userB.id) return null;
  if (userA.role === 'student' && userB.role === 'student') return null;

  let score = 0;
  const reasons: string[] = [];

  if (userA.department && userB.department) {
    const deptA = userA.department.toLowerCase().trim();
    const deptB = userB.department.toLowerCase().trim();
    if (deptA === deptB) {
      score += 40;
      reasons.push('Aynı bölüm');
    }
  }

  if (userA.interests.length > 0 && userB.interests.length > 0) {
    const interestsA = new Set(userA.interests.map((i) => i.toLowerCase().trim()));
    const shared = userB.interests.filter((i) => interestsA.has(i.toLowerCase().trim()));
    const count = Math.min(shared.length, 3);
    if (count > 0) {
      score += 15 * count;
      reasons.push(`${count} ortak ilgi alanı`);
    }
  }

  if (userA.role === 'student' && userB.field_of_study) {
    const fieldLower = userB.field_of_study.toLowerCase();
    const hasMatch = userA.interests.some((interest) =>
      fieldLower.includes(interest.toLowerCase()) ||
      interest.toLowerCase().includes(fieldLower.split(' ')[0])
    );
    if (hasMatch) {
      score += 10;
      reasons.push('Alan uyumu');
    }
  } else if (userB.role === 'student' && userA.field_of_study) {
    const fieldLower = userA.field_of_study.toLowerCase();
    const hasMatch = userB.interests.some((interest) =>
      fieldLower.includes(interest.toLowerCase()) ||
      interest.toLowerCase().includes(fieldLower.split(' ')[0])
    );
    if (hasMatch) {
      score += 10;
      reasons.push('Alan uyumu');
    }
  }

  if (userA.graduation_year && userB.graduation_year) {
    const decadeA = Math.floor(userA.graduation_year / 10);
    const decadeB = Math.floor(userB.graduation_year / 10);
    if (decadeA === decadeB) {
      score += 5;
      reasons.push('Aynı dönem mezunu');
    }
  }

  if (score < 10) return null;

  return {
    userId: userB.id,
    score,
    reasons,
  };
}

export function generateSuggestions(
  user: Profile,
  candidates: Profile[],
  existingMatchUserIds: Set<string>,
  existingDismissedIds: Set<string>,
  maxSuggestions: number = 10
): MatchResult[] {
  const results: MatchResult[] = [];

  for (const candidate of candidates) {
    if (existingMatchUserIds.has(candidate.id)) continue;
    if (existingDismissedIds.has(candidate.id)) continue;

    const result = calculateMatchScore(user, candidate);
    if (result) {
      results.push(result);
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, maxSuggestions);
}
