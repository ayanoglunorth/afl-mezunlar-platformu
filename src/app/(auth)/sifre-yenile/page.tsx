import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Şifre Yenile | AFL Mezunlar Platformu',
  description: 'Yeni şifrenizi belirleyin.',
};

export default function ResetPasswordPage() {
  return (
    <div className="w-full">
      <ResetPasswordForm />
    </div>
  );
}
