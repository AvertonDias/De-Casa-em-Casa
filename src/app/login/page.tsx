"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Esta página foi substituída pela nova página de login universal em /
export default function DeprecatedLoginPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#1e1b29]">
      <p className="text-white">Redirecionando...</p>
    </div>
  );
}
