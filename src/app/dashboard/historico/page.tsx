
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoadingScreen } from '@/components/LoadingScreen';

export default function DeprecatedHistoryPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/mais');
  }, [router]);

  return <LoadingScreen />;
}
