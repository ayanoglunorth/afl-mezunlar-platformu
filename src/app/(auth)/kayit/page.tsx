import { RegisterForm } from '@/components/auth/RegisterForm';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Kayıt Ol | AFL Mezunlar Platformu',
  description: 'AFL Mezunlar ve Öğrenci platformuna kayıt olun.',
};

export default function RegisterPage() {
  return (
    <div className="w-full">
      <RegisterForm />
    </div>
  );
}
