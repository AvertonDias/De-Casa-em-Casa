"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Página de criação de congregação desativada.
 * A funcionalidade foi movida para o componente CreateCongregationModal acessível na página inicial.
 */
export default function DeprecatedNewCongregationPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/');
  }, [router]);

  return null;
}
