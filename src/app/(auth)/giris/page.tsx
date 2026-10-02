import { LoginForm } from '@/components/auth/LoginForm';
import { Metadata } from 'next';
import { Suspense } from 'react';

export const metadata: Metadata = {
  title: 'Giriş Yap | AFL Mezunlar Platformu',
  description: 'AFL Mezunlar ve Öğrenci platformuna giriş yapın.',
};

export default function LoginPage() {
  return (
    <div className="w-full">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
