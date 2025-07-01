"use client";

import { AlertTriangle } from 'lucide-react';

export function PendingApprovalBanner() {
  return (
    // ▼▼▼ MUDANÇA CRÍTICA AQUI ▼▼▼
    // Classes para Light Mode (padrão) + classes para Dark Mode (com prefixo dark:)
    <div className="mb-8 p-4 bg-yellow-100 border border-yellow-300 rounded-lg dark:bg-yellow-500/20 dark:border-yellow-500/40">
      <div className="flex items-start">
        {/* Ícone com cores que funcionam bem em ambos os temas */}
        <AlertTriangle className="h-5 w-5 mr-3 mt-0.5 text-yellow-500 dark:text-yellow-400" />
        <div>
          {/* Texto com cores de alto contraste para cada tema */}
          <h3 className="font-bold text-yellow-900 dark:text-yellow-200">Seu acesso está pendente de aprovação!</h3>
          <p className="text-sm text-yellow-700 dark:text-yellow-300">
            Para usar todas as funcionalidades, incluindo o acesso aos territórios, por favor, peça para um dos dirigentes ou administradores da sua congregação aprovar seu acesso.
          </p>
        </div>
      </div>
    </div>
  );
}
