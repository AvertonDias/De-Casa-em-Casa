"use client";

import { AlertTriangle } from 'lucide-react';

export function PendingApprovalBanner() {
  return (
    <div className="mb-8 p-4 bg-yellow-400/10 border border-yellow-500/30 rounded-lg text-yellow-300">
      <div className="flex items-start">
        <AlertTriangle className="h-5 w-5 mr-3 mt-1" />
        <div>
          <h3 className="font-bold">Seu acesso está pendente de aprovação!</h3>
          <p className="text-sm">Para usar todas as funcionalidades, incluindo o acesso aos territórios, por favor, peça para um dos dirigentes ou administradores da sua congregação aprovar seu acesso.</p>
        </div>
      </div>
    </div>
  );
}
