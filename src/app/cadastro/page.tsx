"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Página de cadastro individual desativada.
 * A funcionalidade foi movida para o componente RegisterUserModal acessível na página inicial.
 */
export default function DeprecatedSignUpPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/');
  }, [router]);

  return null;
}
