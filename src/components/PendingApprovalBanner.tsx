"use client";

import { AlertTriangle } from 'lucide-react';

export function PendingApprovalBanner() {
  return (
    // ▼▼▼ MUDANÇA CRÍTICA AQUI ▼▼▼
    // Adicionamos 'border-l-4' para criar a borda esquerda mais grossa.
    // O Tailwind CSS inteligentemente aplica a cor do 'border-yellow-300' a esta borda.
    <div className="mb-8 p-4 bg-yellow-100 border border-l-4 border-yellow-300 rounded-lg dark:bg-yellow-500/20 dark:border-yellow-500/40 dark:border-l-yellow-500">
      <div className="flex items-start">
        <AlertTriangle className="h-5 w-5 mr-3 mt-0.5 text-yellow-500 dark:text-yellow-400" />
        <div>
          <h3 className="font-bold text-yellow-900 dark:text-yellow-200">Seu acesso está pendente de aprovação!</h3>
          <p className="text-sm text-yellow-700 dark:text-yellow-300">
            Para usar todas as funcionalidades, incluindo o acesso aos territórios, por favor, peça para um dos dirigentes da sua congregação aprovar seu acesso.
          </p>
        </div>
      </div>
    </div>
  );
}
