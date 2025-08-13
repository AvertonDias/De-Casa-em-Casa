"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// A página de login principal agora é a raiz do site ('/').
// Esta página é mantida apenas para evitar erros 404, redirecionando para a raiz.
export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/');
  }, [router]);

  return (
    <div className="flex h-screen items-center justify-center">
        <p>Redirecionando para a página de login...</p>
    </div>
  );
}
