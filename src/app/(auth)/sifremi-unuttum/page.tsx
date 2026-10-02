import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Şifremi Unuttum | AFL Mezunlar Platformu',
  description: 'Şifrenizi sıfırlamak için bağlantı gönderin.',
};

export default function ForgotPasswordPage() {
  return (
    <div className="w-full">
      <ForgotPasswordForm />
    </div>
  );
}
