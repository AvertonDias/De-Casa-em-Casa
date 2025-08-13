"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Esta página foi substituída pela nova página de login universal em /
// e é mantida apenas para evitar 404s de links antigos.
export default function DeprecatedLoginPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <p className="text-foreground">Redirecionando...</p>
    </div>
  );
}
