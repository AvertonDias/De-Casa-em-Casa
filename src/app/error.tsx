'use client';

import { useEffect } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Erro na página capturado:', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-4">
        <AlertCircle className="w-6 h-6" />
      </div>
      <h2 className="text-xl font-bold mb-2">Ops! Ocorreu um problema nesta seção</h2>
      <p className="text-sm text-muted-foreground max-w-md mb-6">
        Um erro foi detectado e enviado para nossos relatórios automáticos. Você pode tentar atualizar este módulo.
      </p>
      <Button onClick={() => reset()} className="gap-2">
        <RefreshCw className="w-4 h-4" />
        Recarregar módulo
      </Button>
    </div>
  );
}
