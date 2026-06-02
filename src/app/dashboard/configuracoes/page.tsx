
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoadingScreen } from '@/components/LoadingScreen';

export default function RedirectSettingsPage() {
  const router = useRouter();

  useEffect(() => {
    // Redireciona para o novo hub centralizado
    router.replace('/dashboard/mais');
  }, [router]);

  return <LoadingScreen />;
}
