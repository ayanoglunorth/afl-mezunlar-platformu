'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { reviewForumReport } from '@/app/(main)/topluluk/actions';
import { createForumThreadPreview } from '@/lib/forum';
import { getAdminActionLabel } from '@/lib/admin-audit';
import { AdminDirectoryPanels, type AdminDirectoryUser, type AdminRegistryEntry } from './AdminDirectoryPanels';

type DashboardStats = {
  totalUsers: number;
  students: number;
  alumni: number;
  registryCount: number;
  alumniRegistryCount: number;
  activeStudentRegistryCount: number;
  claimedRegistryCount: number;
  pendingAlumni: number;
  activeMentorships: number;
  totalMentorshipRequests: number;
  totalThreads: number;
  privilegeAdmins: number;
  activeSocialMatches: number;
  pendingSocialMatches: number;
  verifiedEmailsCount: number;
  openForumReports: number;
};

type NamedAuditLog = {
  id: string;
  actor_id: string | null;
  actor_name: string | null;
  target_id: string | null;
  target_name: string | null;
  action: string;
  created_at: string;
};

type DashboardFeedback = {
  id: string;
  sender_name: string | null;
  sender_email: string | null;
  sender_role: string | null;
  message: string;
  status: string;
  created_at: string;
};

type FootballInterest = {
  id: string;
  user_id: string;
  user_name: string | null;
  user_role: string | null;
  updated_at: string;
};

type ConversationReview = {
  id: string;
  reviewer_name: string | null;
  reviewed_user_name: string | null;
  conversation_kind: 'social' | 'mentorship';
  rating: number;
  note: string | null;
};

type MessageReport = {
  id: string;
  reporter_name: string | null;
  reported_user_name: string | null;
  status: string;
  note: string | null;
  messages: { message_id: string; content_snapshot: string }[];
};

type ArchivedForumItem = {
  id: string;
  kind: 'Konu' | 'Yanıt';
  title: string;
  preview: string;
  href: string;
  date: string;
};

type ForumReportItem = {
  id: string;
  target_type: 'thread' | 'post';
  target_href: string;
  target_label: string;
  reporter_name: string | null;
  reason: string;
  note: string | null;
  status: string;
  created_at: string;
};

type DashboardPayload = DashboardStats & {
  directoryUsers: AdminDirectoryUser[];
  registryEntries: AdminRegistryEntry[];
  recentAdminActions: NamedAuditLog[];
  dashboardFeedbacks: DashboardFeedback[];
  footballInterestCount: number;
  footballTeamInterestCount: number;
  footballInterests: FootballInterest[];
  conversationReviews: ConversationReview[];
  messageReports: MessageReport[];
  archivedForumContent: ArchivedForumItem[];
  forumReports: ForumReportItem[];
};

const EMPTY_STATS: DashboardStats = {
  totalUsers: 0,
  students: 0,
  alumni: 0,
  registryCount: 0,
  alumniRegistryCount: 0,
  activeStudentRegistryCount: 0,
  claimedRegistryCount: 0,
  pendingAlumni: 0,
  activeMentorships: 0,
  totalMentorshipRequests: 0,
  totalThreads: 0,
  privilegeAdmins: 0,
  activeSocialMatches: 0,
  pendingSocialMatches: 0,
  verifiedEmailsCount: 0,
  openForumReports: 0,
};

export function AdminDashboardClient() {
  const [payload, setPayload] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    fetch('/api/admin/dashboard')
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          const detail = process.env.NODE_ENV !== 'production' && data.detail ? ` ${data.detail}` : '';
          throw new Error(`${data.error || 'Dashboard verileri alınamadı.'}${detail}`);
        }
        if (alive) setPayload(data);
      })
      .catch((reason) => {
        if (alive) setError(reason instanceof Error ? reason.message : 'Dashboard verileri alınamadı.');
      });

    return () => {
      alive = false;
    };
  }, []);

  const stats = payload || EMPTY_STATS;

  return (
    <div className="space-y-8 fade-in">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-surface-900">Yönetim Paneli</h1>
        <p className="max-w-[78ch] text-sm leading-6 text-surface-500">
          Kullanıcı, mezun veri tabanı, onay ve denetim kayıtlarını tek ekrandan izle.
          Kritik işlemler yalnızca admin yöneticilerine açıktır.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <AdminStatsSections stats={stats} loading={!payload && !error} />

      {!payload && !error ? (
        <>
          <DirectoryPanelsSkeleton />
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <PanelCard title="Son Admin İşlemleri"><PanelSkeleton rows={4} /></PanelCard>
            <PanelCard title="Dashboard Geri Bildirimleri"><PanelSkeleton rows={4} /></PanelCard>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <PanelCard title="Sohbet Değerlendirmeleri"><PanelSkeleton rows={4} /></PanelCard>
            <PanelCard title="Mesaj Şikâyetleri"><PanelSkeleton rows={4} /></PanelCard>
          </div>
        </>
      ) : payload ? (
        <>
          <AdminDirectoryPanels users={payload.directoryUsers || []} registryEntries={payload.registryEntries || []} />

          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <PanelCard title="Son Admin İşlemleri">
              <RecentAdminActions logs={payload.recentAdminActions || []} />
            </PanelCard>
            <PanelCard
              title="Dashboard Geri Bildirimleri"
              description="Dashboard ve kayıt ekranındaki iletişim kutusundan iletilen görüş, öneri ve geri bildirimler."
            >
              <DashboardFeedbacks feedbacks={payload.dashboardFeedbacks || []} />
            </PanelCard>
          </div>

          <PanelCard
            title="Futbol Turnuvası"
            description="Katılmak istiyorum diyenlerin hızlı listesi."
          >
            <FootballInterestPanel
              total={payload.footballInterestCount || 0}
              interests={payload.footballInterests || []}
            />
          </PanelCard>

          <div className="grid gap-6 lg:grid-cols-2">
            <PanelCard
              title="Sohbet Değerlendirmeleri"
              description="Her iki tarafın sohbet ekranından bıraktığı özel puan ve notlar."
            >
              <ConversationReviews reviews={payload.conversationReviews || []} />
            </PanelCard>
            <PanelCard
              title="Mesaj Şikâyetleri"
              description="Seçilen mesajların olay anındaki kopyalarıyla birlikte."
            >
              <MessageReports reports={payload.messageReports || []} />
            </PanelCard>
          </div>

          <PanelCard
            title="Arşivlenmiş Topluluk İçerikleri"
            description="Adminler için arşivde tutulan konu ve yanıtların hızlı görünümü."
          >
            <ArchivedForumContent items={payload.archivedForumContent || []} />
          </PanelCard>

          <PanelCard
            title="Topluluk Raporları"
            description="Konu ve yanıtlar için kullanıcıların gönderdiği moderasyon raporları."
          >
            <ForumReports reports={payload.forumReports || []} />
          </PanelCard>
        </>
      ) : null}
    </div>
  );
}

function AdminStatsSections({ stats, loading }: { stats: DashboardStats; loading: boolean }) {
  const claimedCount = Math.max(stats.alumni, stats.claimedRegistryCount);
  const registryDetail = `${stats.alumniRegistryCount} mezun, ${stats.activeStudentRegistryCount} öğrenci`;

  if (loading) return <StatsSkeleton />;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-surface-500">Kullanıcı Dağılımı</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
          <StatCard label="Toplam Kullanıcı" value={stats.totalUsers} detail="Kayıtlı hesaplar" />
          <StatCard label="Öğrenci" value={stats.students} detail={`%${Math.round((stats.students / (stats.totalUsers || 1)) * 100)}`} />
          <StatCard label="Mezun" value={stats.alumni} detail={`%${Math.round((stats.alumni / (stats.totalUsers || 1)) * 100)}`} />
          <StatCard label="E-posta Onaylı" value={stats.verifiedEmailsCount} detail={`%${Math.round((stats.verifiedEmailsCount / (stats.totalUsers || 1)) * 100)}`} />
          <StatCard label="Mezun ve Öğrenci Kaydı" value={stats.registryCount} detail={`${registryDetail} · ${claimedCount} eşleşmiş`} />
          <Link
            href="/admin/onay-bekleyenler"
            className={
              stats.pendingAlumni > 0
                ? 'block rounded-xl border border-orange-300 bg-orange-500 p-6 text-white shadow-[0_18px_42px_-26px_rgba(249,115,22,0.8)] transition-colors hover:bg-orange-600'
                : 'block card transition-colors hover:border-brand-500'
            }
          >
            <p className={stats.pendingAlumni > 0 ? 'text-xs font-semibold uppercase tracking-[0.08em] text-orange-50' : 'text-xs font-semibold uppercase tracking-[0.08em] text-surface-500'}>Onay Bekleyen</p>
            <p className={stats.pendingAlumni > 0 ? 'mt-2 text-3xl font-bold text-white' : 'mt-2 text-3xl font-bold text-surface-900'}>{stats.pendingAlumni}</p>
            <p className={stats.pendingAlumni > 0 ? 'mt-3 text-xs font-semibold text-orange-50' : 'mt-3 text-xs font-medium text-brand-600'}>İncele ve onayla</p>
          </Link>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-surface-500">Platform Etkileşimi</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
          <StatCard label="Aktif Mentorluk" value={stats.activeMentorships} detail="Mesajlaşan mentorluklar" />
          <StatCard label="Aktif Eşleşme" value={stats.activeSocialMatches} detail="Sosyal sohbet" />
          <StatCard label="Açık İstek" value={stats.totalMentorshipRequests} detail="Bekleyen mentorluk isteği" />
          <StatCard label="Topluluk Konuları" value={stats.totalThreads} detail="Tüm kategoriler" />
          <StatCard label="Topluluk Raporları" value={stats.openForumReports} detail="Açık inceleme" />
          <StatCard label="Yöneticiler" value={stats.privilegeAdmins} detail="Admin yetkisi olanlar" />
        </div>
      </div>
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className="space-y-6">
      {[1, 2].map((section) => (
        <div key={section}>
          <div className="skeleton mb-3 h-4 w-44 rounded-lg" />
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
            {[1, 2, 3, 4, 5, 6].map((item) => (
              <div key={item} className="card space-y-3">
                <div className="skeleton h-3 w-24 rounded" />
                <div className="skeleton h-8 w-16 rounded" />
                <div className="skeleton h-3 w-28 rounded" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function DirectoryPanelsSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {[1, 2].map((item) => (
        <section key={item} className="card h-[26rem] space-y-4">
          <div className="skeleton h-6 w-36 rounded-lg" />
          <div className="skeleton h-11 rounded-xl" />
          <div className="space-y-3">
            {[1, 2, 3, 4].map((row) => <div key={row} className="skeleton h-16 rounded-lg" />)}
          </div>
        </section>
      ))}
    </div>
  );
}

function PanelSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="skeleton h-16 rounded-xl" />
      ))}
    </div>
  );
}

function PanelCard({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <div className="card space-y-4">
      <div>
        <h2 className="text-base font-semibold text-surface-900">{title}</h2>
        {description && <p className="mt-1 text-sm text-surface-500">{description}</p>}
      </div>
      {children}
    </div>
  );
}

function StatCard({ label, value, detail }: { label: string; value: number | string; detail: string }) {
  return (
    <div className="card">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-surface-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-surface-900">{value}</p>
      <p className="mt-3 text-xs text-surface-500">{detail}</p>
    </div>
  );
}

function RecentAdminActions({ logs }: { logs: NamedAuditLog[] }) {
  if (!logs.length) return <p className="text-sm text-surface-500">Henüz admin işlemi kaydı yok.</p>;

  return (
    <div className="space-y-2">
      {logs.map((log) => (
        <div key={log.id} className="rounded-lg border border-surface-100 bg-surface-50 px-4 py-3">
          <p className="text-sm font-semibold text-surface-900">{getAdminActionLabel(log.action)}</p>
          <p className="mt-1 text-xs text-surface-500">
            {log.actor_name || log.actor_id || 'Sistem'} → {log.target_name || log.target_id || 'Genel işlem'}
          </p>
        </div>
      ))}
    </div>
  );
}

function DashboardFeedbacks({ feedbacks }: { feedbacks: DashboardFeedback[] }) {
  if (!feedbacks.length) return <p className="text-sm text-surface-500">Henüz dashboard geri bildirimi yok.</p>;

  return (
    <div className="max-h-[34rem] space-y-3 overflow-y-auto pr-1">
      {feedbacks.map((feedback) => (
        <article key={feedback.id} className="rounded-xl border border-surface-200 bg-surface-50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-surface-900">{feedback.sender_name || 'Kullanıcı'}</p>
              <p className="mt-1 text-xs text-surface-500">
                {[feedback.sender_email, feedback.sender_role].filter(Boolean).join(' · ') || 'Kullanıcı bilgisi yok'}
              </p>
            </div>
            <span className="rounded-lg border border-brand-100 bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
              {feedback.status === 'new' ? 'Yeni' : feedback.status}
            </span>
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-surface-700">{feedback.message}</p>
          <p className="mt-3 text-[11px] uppercase tracking-wide text-surface-400">{new Date(feedback.created_at).toLocaleString('tr-TR')}</p>
        </article>
      ))}
    </div>
  );
}

function FootballInterestPanel({ total, interests }: { total: number; interests: FootballInterest[] }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-brand-100 bg-brand-50 p-4">
        <p className="text-xs font-bold uppercase tracking-[0.08em] text-brand-700">Toplam kişi</p>
        <p className="mt-2 text-3xl font-bold text-brand-900">{total}</p>
      </div>

      {!interests.length ? (
        <p className="text-sm text-surface-500">Henüz katılmak isteyen yok.</p>
      ) : (
        <div className="max-h-[24rem] divide-y divide-surface-200 overflow-y-auto rounded-xl border border-surface-200 bg-surface-50">
          {interests.map((interest) => (
            <article key={interest.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-surface-900">{interest.user_name || interest.user_id}</p>
                <p className="mt-1 text-xs text-surface-500">{interest.user_role || 'Rol bilgisi yok'}</p>
              </div>
              <p className="text-xs font-semibold text-surface-400">{new Date(interest.updated_at).toLocaleString('tr-TR')}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function ConversationReviews({ reviews }: { reviews: ConversationReview[] }) {
  if (!reviews.length) return <p className="text-sm text-surface-500">Henüz sohbet değerlendirmesi yok.</p>;

  return (
    <div className="max-h-[34rem] space-y-3 overflow-y-auto pr-1">
      {reviews.map((review) => (
        <article key={review.id} className="rounded-xl border border-surface-200 bg-surface-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-surface-900">
              {review.reviewer_name || 'Kullanıcı'} → {review.reviewed_user_name || 'Kullanıcı'}
            </p>
            <span className="badge badge-brand">{review.rating}/5</span>
          </div>
          {review.note && <p className="mt-2 whitespace-pre-wrap text-sm text-surface-600">{review.note}</p>}
          <p className="mt-2 text-[11px] uppercase tracking-wide text-surface-400">
            {review.conversation_kind === 'social' ? 'Sosyal sohbet' : 'Mentorluk sohbeti'}
          </p>
        </article>
      ))}
    </div>
  );
}

function MessageReports({ reports }: { reports: MessageReport[] }) {
  if (!reports.length) return <p className="text-sm text-surface-500">Henüz mesaj şikâyeti yok.</p>;

  return (
    <div className="max-h-[34rem] space-y-3 overflow-y-auto pr-1">
      {reports.map((report) => (
        <article key={report.id} className="rounded-xl border border-red-100 bg-red-50/50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-surface-900">
              {report.reporter_name || 'Kullanıcı'} → {report.reported_user_name || 'Kullanıcı'}
            </p>
            <span className="rounded-lg bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">{report.status}</span>
          </div>
          {report.note && <p className="mt-2 text-sm text-surface-600">{report.note}</p>}
          <div className="mt-3 space-y-2">
            {(report.messages || []).map((message) => (
              <blockquote key={message.message_id} className="rounded-lg border border-red-100 bg-white px-3 py-2 text-sm text-surface-700">
                {message.content_snapshot}
              </blockquote>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}

function ArchivedForumContent({ items }: { items: ArchivedForumItem[] }) {
  const sortedItems = useMemo(() => {
    return [...items]
      .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime())
      .slice(0, 16)
      .map((item) => ({ ...item, preview: createForumThreadPreview(item.preview, 160) }));
  }, [items]);

  if (!sortedItems.length) return <p className="text-sm text-surface-500">Henüz arşivlenmiş topluluk içeriği yok.</p>;

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {sortedItems.map((item) => (
        <Link
          key={`${item.kind}-${item.id}`}
          href={item.href}
          className="rounded-xl border border-amber-100 bg-amber-50/60 p-4 transition-colors hover:border-amber-200 hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/25"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">{item.kind}</span>
            <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-surface-400">
              {new Date(item.date).toLocaleString('tr-TR')}
            </span>
          </div>
          <p className="mt-3 line-clamp-1 text-sm font-bold text-surface-900">{item.title}</p>
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-surface-600">{item.preview}</p>
        </Link>
      ))}
    </div>
  );
}

function ForumReports({ reports }: { reports: ForumReportItem[] }) {
  if (!reports.length) return <p className="text-sm text-surface-500">Henüz topluluk raporu yok.</p>;

  return (
    <div className="max-h-[42rem] space-y-3 overflow-y-auto pr-1">
      {reports.map((report) => (
        <article key={report.id} className="rounded-xl border border-surface-200 bg-surface-50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-surface-900">
                {report.target_type === 'thread' ? 'Konu raporu' : 'Yanıt raporu'}
              </p>
              <p className="mt-1 text-xs text-surface-500">
                {report.reporter_name || 'Kullanıcı'} · {report.reason} · {new Date(report.created_at).toLocaleString('tr-TR')}
              </p>
            </div>
            <span className={report.status === 'open' ? 'badge bg-red-100 text-red-700' : 'badge badge-neutral'}>
              {report.status}
            </span>
          </div>

          <Link href={report.target_href} className="mt-3 block rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm text-surface-700 transition-colors hover:bg-surface-100">
            {report.target_label || 'İçerik bulunamadı'}
          </Link>

          {report.note && <p className="mt-3 whitespace-pre-wrap text-sm text-surface-600">{report.note}</p>}

          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <form action={reviewForumReport}>
              <input type="hidden" name="reportId" value={report.id} />
              <input type="hidden" name="status" value="reviewing" />
              <button type="submit" className="btn-secondary px-3 py-2 text-xs">İncelemede</button>
            </form>
            <form action={reviewForumReport}>
              <input type="hidden" name="reportId" value={report.id} />
              <input type="hidden" name="status" value="dismissed" />
              <button type="submit" className="btn-secondary px-3 py-2 text-xs">Reddet</button>
            </form>
            <form action={reviewForumReport}>
              <input type="hidden" name="reportId" value={report.id} />
              <input type="hidden" name="status" value="resolved" />
              <button type="submit" className="btn-primary px-3 py-2 text-xs">Çözüldü</button>
            </form>
          </div>
        </article>
      ))}
    </div>
  );
}
