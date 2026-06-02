
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoadingScreen } from '@/components/LoadingScreen';

export default function RedirectS13Page() {
  const router = useRouter();

  useEffect(() => {
    // Redireciona para o novo hub centralizado
    router.replace('/dashboard/mais');
  }, [router]);

  return <LoadingScreen />;
}
