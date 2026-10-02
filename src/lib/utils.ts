import { type ClassValue, clsx } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

/**
 * Format a relative time string in Turkish
 */
export function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth = Math.floor(diffDay / 30);

  if (diffSec < 60) return 'az önce';
  if (diffMin < 60) return `${diffMin} dakika önce`;
  if (diffHour < 24) return `${diffHour} saat önce`;
  if (diffDay < 7) return `${diffDay} gün önce`;
  if (diffWeek < 4) return `${diffWeek} hafta önce`;
  if (diffMonth < 12) return `${diffMonth} ay önce`;
  return `${Math.floor(diffDay / 365)} yıl önce`;
}

/**
 * Format remaining time for chat expiration
 */
export function formatTimeRemaining(expiresAt: string): string {
  const expires = new Date(expiresAt);
  const now = new Date();
  const diffMs = expires.getTime() - now.getTime();

  if (diffMs <= 0) return 'Süresi doldu';

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) return `${days} gün ${hours} saat kaldı`;
  if (hours > 0) return `${hours} saat ${minutes} dakika kaldı`;
  return `${minutes} dakika kaldı`;
}

/**
 * Get initials from a full name
 */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map(word => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/**
 * Predefined interest categories for profile setup
 */
export const INTEREST_OPTIONS = [
  'Matematik', 'Fizik', 'Kimya', 'Biyoloji',
  'Bilgisayar Bilimi', 'Yazılım', 'Yapay Zeka', 'Veri Bilimi',
  'Tıp', 'Mühendislik', 'Mimarlık', 'Hukuk',
  'İşletme', 'Ekonomi', 'Psikoloji', 'Sosyoloji',
  'Edebiyat', 'Tarih', 'Felsefe', 'Siyaset Bilimi',
  'Müzik', 'Sanat', 'Tasarım', 'Spor',
  'Girişimcilik', 'Erasmus', 'Araştırma', 'Robotik',
];

/**
 * Role display names in Turkish
 */
export const ROLE_LABELS: Record<string, string> = {
  student: 'Öğrenci',
  alumni: 'Mezun',
  teacher: 'Öğretmen',
  admin: 'Yönetici',
};
