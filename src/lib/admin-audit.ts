export const ADMIN_ACTION_LABELS: Record<string, string> = {
  approved_pending_alumni: 'Kullanıcıyı onayladı.',
  rejected_pending_alumni: 'Kullanıcı kaydını reddetti.',
  approved_profile_name_change: 'Ad soyad değişikliğini onayladı.',
  rejected_profile_name_change: 'Ad soyad değişikliğini reddetti.',
  grant_admin: 'Admin yetkisi verdi.',
  revoke_admin: 'Admin yetkisini aldı.',
  grant_manager: 'Admin yönetme yetkisi verdi.',
  revoke_manager: 'Admin yönetme yetkisini aldı.',
  admin_deleted_user: 'Kullanıcıyı sildi.',
  user_requested_account_deletion: 'Kullanıcı hesabını sildi.',
  upload_alumni_registry: 'Mezun verisi yükledi.',
  upload_active_student_registry: 'Aktif öğrenci verisi yükledi.',
  forum_anonymous_identity_revealed: 'Anonim topluluk kimliğini görüntüledi.',
};

export function getAdminActionLabel(action: string) {
  return ADMIN_ACTION_LABELS[action] || action;
}
