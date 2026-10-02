'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { AuthChangeEvent } from '@supabase/supabase-js';

export function AuthListener() {
  const router = useRouter();
  
  useEffect(() => {
    const supabase = createClient();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: AuthChangeEvent) => {
      // If the user just completed a password recovery flow via email magic link
      // Supabase emits the PASSWORD_RECOVERY event.
      // We must redirect them to the password reset page so they can actually set a new password.
      if (event === 'PASSWORD_RECOVERY') {
        router.push('/sifre-yenile');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  return null;
}
