// src/app/auth/action/layout.tsx

// Esta configuração é crucial para permitir que a página de ação
// use o `useSearchParams` para ler os parâmetros da URL (oobCode, mode)
// sem causar erros durante o build estático do Next.js.
export const dynamic = 'force-dynamic';

export default function ActionLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
