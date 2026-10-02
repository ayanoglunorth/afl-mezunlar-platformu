'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  EnvelopeSimple,
  LockKey,
  SignOut,
  SpinnerGap,
  UserCircle,
  WarningCircle,
} from '@phosphor-icons/react';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/types/database';
import { ROLE_LABELS } from '@/lib/utils';
import { SiteNotice } from '@/components/ui/SiteNotice';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

type SettingsProfile = Pick<Profile, 'id' | 'nickname' | 'role' | 'is_profile_complete'>;

type Notice = {
  type: 'success' | 'error';
  message: string;
} | null;

function isMissingSettingsProfileRpc(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  const message = error.message?.toLowerCase() || '';
  return (
    error.code === 'PGRST202'
    || error.code === '42883'
    || message.includes('could not find the function')
    || message.includes('function public.get_settings_profile')
  );
}

const ROLE_TEXT: Record<string, string> = {
  student: 'Öğrenci',
  alumni: 'Mezun',
  teacher: 'Öğretmen',
  admin: 'Yönetici',
};

function SettingPanel({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-surface-200 bg-white p-5 shadow-[0_16px_42px_-36px_rgba(17,17,17,0.38)] sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-brand-100 bg-brand-50 text-brand-700">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold tracking-tight text-surface-900">{title}</h2>
          <p className="mt-1 max-w-[62ch] text-sm leading-6 text-surface-500">{description}</p>
          <div className="mt-5">{children}</div>
        </div>
      </div>
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-surface-100 py-3 last:border-0 sm:grid-cols-[180px_1fr] sm:gap-4">
      <dt className="text-sm font-medium text-surface-500">{label}</dt>
      <dd className="min-w-0 text-sm font-semibold text-surface-900">{value}</dd>
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [profile, setProfile] = useState<SettingsProfile | null>(null);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [resetLoading, setResetLoading] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [newEmail, setNewEmail] = useState('');
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailVerificationSent, setEmailVerificationSent] = useState(false);
  const [emailNonce, setEmailNonce] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deleteNonce, setDeleteNonce] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [requestingDeleteCode, setRequestingDeleteCode] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteCodeDialogOpen, setDeleteCodeDialogOpen] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      const [
        {
          data: { user },
        },
        { data: rpcProfile, error: rpcError },
      ] = await Promise.all([
        supabase.auth.getUser(),
        supabase.rpc('get_settings_profile'),
      ]);

      if (!user) {
        router.replace('/giris');
        return;
      }

      setEmail(user.email || '');
      setNewEmail(user.email || '');

      let data = rpcProfile as SettingsProfile | null;
      if (rpcError && !isMissingSettingsProfileRpc(rpcError)) {
        setNotice({ type: 'error', message: rpcError.message });
        setLoading(false);
        return;
      }

      if (!data) {
        const fallback = await supabase
          .from('profiles')
          .select('id, nickname, role, is_profile_complete')
          .eq('id', user.id)
          .single();
        data = fallback.data as SettingsProfile | null;
      }

      if (data) {
        setProfile(data);
      }

      setLoading(false);
    }

    void loadSettings();
  }, [router, supabase]);

  async function handleEmailUpdate() {
    if (!newEmail || newEmail === email) {
      setIsEditingEmail(false);
      setEmailVerificationSent(false);
      setEmailNonce('');
      return;
    }

    setNotice(null);
    setEmailLoading(true);

    if (!emailVerificationSent) {
      const { error } = await supabase.auth.reauthenticate();
      if (error) {
        setNotice({ type: 'error', message: error.message });
      } else {
        setEmailVerificationSent(true);
        setNotice({
          type: 'success',
          message: 'Mevcut e-posta adresine doğrulama kodu gönderildi. E-posta değişikliğini tamamlamak için kodu gir.',
        });
      }
      setEmailLoading(false);
      return;
    }

    if (!emailNonce.trim()) {
      setNotice({ type: 'error', message: 'Mevcut e-postana gelen doğrulama kodunu gir.' });
      setEmailLoading(false);
      return;
    }

    const { error } = await supabase.auth.updateUser(
      { email: newEmail, nonce: emailNonce.trim() },
      { emailRedirectTo: `${window.location.origin}/auth/callback?next=/ayarlar` },
    );

    if (error) {
      setNotice({ type: 'error', message: error.message });
    } else {
      setNotice({
        type: 'success',
        message: 'Mevcut e-posta doğrulandı. E-posta değişikliğini tamamlamak için yeni e-posta adresine gelen bağlantıyı onayla.',
      });
      setIsEditingEmail(false);
      setEmailVerificationSent(false);
      setEmailNonce('');
    }

    setEmailLoading(false);
  }

  async function handleRequestDeleteCode() {
    setDeleteCodeDialogOpen(false);
    setNotice(null);
    setRequestingDeleteCode(true);

    const response = await fetch('/api/user/delete/request', { method: 'POST' });
    const payload = await response.json();
    if (!response.ok) {
      setNotice({ type: 'error', message: payload.error || 'Doğrulama kodu gönderilemedi.' });
      setRequestingDeleteCode(false);
      return;
    }

    setShowDeleteConfirm(true);
    setRequestingDeleteCode(false);
    setNotice({
      type: 'success',
      message: 'Hesap silme doğrulama kodu kayıtlı e-posta adresine gönderildi.',
    });
  }

  async function handleDeleteAccount() {
    if (deleteConfirmation !== 'SİL' || !deleteNonce.trim()) return;
    setIsDeleting(true);
    setNotice(null);
    try {
      const res = await fetch('/api/user/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nonce: deleteNonce.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Hesap silinemedi');
      
      await supabase.auth.signOut();
      window.location.assign('/');
    } catch (err: unknown) {
      setNotice({ type: 'error', message: err instanceof Error ? err.message : 'Hesap silinemedi.' });
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  async function handlePasswordReset() {
    if (!email) return;

    setNotice(null);
    setResetLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/sifre-yenile`,
    });

    if (error) {
      setNotice({ type: 'error', message: error.message });
    } else {
      setNotice({
        type: 'success',
        message: 'Şifre yenileme bağlantısı e-posta adresine gönderildi.',
      });
    }

    setResetLoading(false);
  }

  async function handleSignOut() {
    setSigningOut(true);
    const { error } = await supabase.auth.signOut();
    if (error) {
      setNotice({ type: 'error', message: error.message });
      setSigningOut(false);
      return;
    }
    window.location.assign('/');
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 pb-12">
        <div className="space-y-3">
          <div className="skeleton h-8 w-48 rounded-lg" />
          <div className="skeleton h-5 w-80 max-w-full rounded-lg" />
        </div>
        <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
          <div className="skeleton h-48 rounded-2xl" />
          <div className="space-y-4">
            <div className="skeleton h-52 rounded-2xl" />
            <div className="skeleton h-48 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const roleLabel = ROLE_TEXT[profile.role] || ROLE_LABELS[profile.role] || profile.role;

  return (
    <div className="mx-auto max-w-5xl pb-12 fade-in">
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand-700">Ayarlar</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-surface-900">Hesap Ayarları</h1>
          <p className="mt-2 max-w-[62ch] text-sm leading-6 text-surface-500">
            Hesap erişimi, güvenlik işlemleri ve profil bağlantılarını buradan yönet.
          </p>
        </div>
        <Link href="/profil" className="btn-secondary h-11 px-4">
          <UserCircle className="h-4 w-4" weight="duotone" />
          Profili düzenle
        </Link>
      </div>

      <div className="mx-auto w-full max-w-3xl space-y-5">
        {notice && (
          <SiteNotice type={notice.type} message={notice.message} className="mb-5" />
        )}

        <SettingPanel
            title="Hesap bilgileri"
            description="Giriş yaptığın temel hesap bilgileri ve e-posta adresini buradan yönetebilirsin."
            icon={<EnvelopeSimple className="h-5 w-5" weight="duotone" />}
          >
            <dl id="hesap" className="scroll-mt-24 rounded-xl border border-surface-100 bg-surface-50 px-4">
              <div className="grid gap-1 border-b border-surface-100 py-3 last:border-0 sm:grid-cols-[180px_1fr] sm:gap-4">
                <dt className="text-sm font-medium text-surface-500">E-posta</dt>
                <dd className="min-w-0 flex items-center justify-between gap-4">
                  {isEditingEmail ? (
                    <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
                      <input
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        className="input h-9 w-full sm:w-64 bg-white"
                        placeholder="yeni@eposta.com"
                        disabled={emailLoading}
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setIsEditingEmail(false);
                            setNewEmail(email);
                            setEmailVerificationSent(false);
                            setEmailNonce('');
                          }}
                          className="btn-ghost h-9 px-3 text-sm"
                          disabled={emailLoading}
                        >
                          İptal
                        </button>
                        <button
                          type="button"
                          onClick={handleEmailUpdate}
                          className="btn-primary h-9 px-3 text-sm"
                          disabled={emailLoading}
                        >
                          {emailLoading ? (
                            <SpinnerGap className="h-4 w-4 animate-spin" />
                          ) : emailVerificationSent ? (
                            'Onayla'
                          ) : (
                            'Kod gönder'
                          )}
                        </button>
                      </div>
                      {emailVerificationSent && (
                        <input
                          type="text"
                          inputMode="numeric"
                          value={emailNonce}
                          onChange={(event) => setEmailNonce(event.target.value)}
                          className="input h-9 w-full bg-white sm:w-44"
                          placeholder="Eski e-posta kodu"
                          disabled={emailLoading}
                        />
                      )}
                    </div>
                  ) : (
                    <>
                      <span className="break-all text-sm font-semibold text-surface-900">{email}</span>
                      <button
                        type="button"
                        onClick={() => setIsEditingEmail(true)}
                        className="text-sm font-medium text-brand-600 hover:text-brand-700 hover:underline"
                      >
                        Değiştir
                      </button>
                    </>
                  )}
                </dd>
              </div>
              <InfoRow label="Nickname" value={profile.nickname ? `@${profile.nickname}` : 'Belirtilmemiş'} />
              <InfoRow label="Hesap türü" value={roleLabel} />
              <InfoRow
                label="Profil durumu"
                value={profile.is_profile_complete ? 'Tamamlandı' : 'Eksik bilgiler var'}
              />
            </dl>
        </SettingPanel>

        <SettingPanel
            title="Güvenlik"
            description="Şifreni yenilemek için doğrulama bağlantısı kayıtlı e-posta adresine gönderilir."
            icon={<LockKey className="h-5 w-5" weight="duotone" />}
          >
            <div id="guvenlik" className="scroll-mt-24 space-y-4">
              <div className="flex flex-col gap-3 rounded-xl border border-surface-100 bg-surface-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-bold text-surface-900">Şifre yenileme</p>
                  <p className="mt-1 text-sm text-surface-500">Bağlantı {email} adresine gider.</p>
                </div>
                <button
                  type="button"
                  onClick={handlePasswordReset}
                  disabled={resetLoading}
                  className="btn-primary h-11 px-4"
                >
                  {resetLoading ? (
                    <SpinnerGap className="h-4 w-4 animate-spin" weight="bold" />
                  ) : (
                    <LockKey className="h-4 w-4" weight="bold" />
                  )}
                  Bağlantı gönder
                </button>
              </div>
            </div>
        </SettingPanel>

        <SettingPanel
            title="Profil bağlantıları"
            description="Mentorluk eşleşmelerinde görünen bilgileri profil sayfasından düzenleyebilirsin."
            icon={<UserCircle className="h-5 w-5" weight="duotone" />}
          >
            <div id="profil" className="scroll-mt-24 grid gap-3 sm:grid-cols-2">
              <Link
                href="/profil"
                className="group rounded-xl border border-surface-100 bg-surface-50 p-4 transition-colors hover:border-brand-100 hover:bg-brand-50/60"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-surface-900">Profil bilgileri</p>
                    <p className="mt-1 text-sm text-surface-500">Okul, hedef ve mentorluk bilgilerini düzenle.</p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-brand-700 transition-transform group-hover:translate-x-0.5" weight="bold" />
                </div>
              </Link>

              <button
                type="button"
                onClick={handleSignOut}
                disabled={signingOut}
                className="group cursor-pointer rounded-xl border border-red-100 bg-red-50 p-4 text-left transition-colors hover:bg-red-100/70 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-red-700">Çıkış yap</p>
                    <p className="mt-1 text-sm text-red-600/80">Bu cihazdaki oturumu kapat.</p>
                  </div>
                  {signingOut ? (
                    <SpinnerGap className="h-4 w-4 shrink-0 animate-spin text-red-700" weight="bold" />
                  ) : (
                    <SignOut className="h-4 w-4 shrink-0 text-red-700 transition-transform group-hover:translate-x-0.5" weight="bold" />
                  )}
                </div>
              </button>
            </div>
        </SettingPanel>

        <SettingPanel
            title="Tehlikeli Bölge"
            description="Hesabını sildiğinde tüm profil bilgilerin, eşleşmelerin ve sohbetlerin kalıcı olarak silinir. Bu işlem geri alınamaz."
            icon={<WarningCircle className="h-5 w-5 text-red-600" weight="duotone" />}
          >
            <div id="tehlikeli" className="scroll-mt-24 space-y-4">
              {!showDeleteConfirm ? (
                <div className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-bold text-red-900">Hesabı Kalıcı Olarak Sil</p>
                    <p className="mt-1 text-sm text-red-700">Tüm verilerin anında silinecektir.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDeleteCodeDialogOpen(true)}
                    disabled={requestingDeleteCode}
                    className="btn-primary h-11 px-4 !bg-red-600 hover:!bg-red-700 focus:ring-red-500"
                  >
                    {requestingDeleteCode ? <SpinnerGap className="h-4 w-4 animate-spin" /> : 'Hesabı Sil'}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-4 rounded-xl border border-red-300 bg-red-50 p-5 shadow-sm">
                  <div>
                    <p className="text-base font-bold text-red-900 mb-2">Emin misin?</p>
                    <p className="text-sm text-red-700">
                      Bu işlem <b>geri alınamaz</b>. Kayıtlı e-posta adresine gelen kodu gir ve onaylamak için aşağıdaki alana tam olarak <span className="font-mono bg-red-200 px-1.5 py-0.5 rounded text-red-900 font-bold select-none">SİL</span> yaz.
                    </p>
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="E-posta doğrulama kodu"
                    value={deleteNonce}
                    onChange={(e) => setDeleteNonce(e.target.value)}
                    className="input border-red-300 bg-white focus:border-red-500 focus:ring-red-500"
                    disabled={isDeleting}
                  />
                  <input
                    type="text"
                    placeholder="SİL"
                    value={deleteConfirmation}
                    onChange={(e) => setDeleteConfirmation(e.target.value)}
                    className="input border-red-300 focus:border-red-500 focus:ring-red-500 bg-white"
                    disabled={isDeleting}
                  />
                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowDeleteConfirm(false);
                        setDeleteConfirmation('');
                        setDeleteNonce('');
                      }}
                      className="btn-ghost h-10 px-4 text-sm"
                      disabled={isDeleting}
                    >
                      İptal Et
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteAccount}
                      disabled={deleteConfirmation !== 'SİL' || !deleteNonce.trim() || isDeleting}
                      className="btn-primary h-10 px-4 text-sm !bg-red-600 hover:!bg-red-700 disabled:opacity-50 disabled:hover:!bg-red-600 transition-colors"
                    >
                      {isDeleting ? <SpinnerGap className="h-4 w-4 animate-spin" /> : 'Kalıcı Olarak Sil'}
                    </button>
                  </div>
                </div>
              )}
            </div>
        </SettingPanel>
      </div>

      <ConfirmDialog
        open={deleteCodeDialogOpen}
        title="Hesap silme işlemi"
        message="Devam edersen kayıtlı e-posta adresine doğrulama kodu gönderilecek."
        confirmLabel="Kodu gönder"
        cancelLabel="Vazgeç"
        tone="danger"
        loading={requestingDeleteCode}
        onConfirm={() => void handleRequestDeleteCode()}
        onCancel={() => setDeleteCodeDialogOpen(false)}
      />
    </div>
  );
}
