"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Esta página foi substituída pela nova página de cadastro em /cadastro
export default function DeprecatedRequestAccessPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/cadastro');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <p className="text-foreground">Redirecionando...</p>
    </div>
  );
}
