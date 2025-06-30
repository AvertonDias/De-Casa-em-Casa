"use client";
import { useUser } from '@/contexts/UserContext';
import { AlertTriangle } from 'lucide-react';

export default function ApprovalBanner() {
  const { user } = useUser();

  // O banner só aparece para usuários com status 'pendente'.
  if (!user || user.status !== 'pendente') {
    return null;
  }
  
  return (
    <div className="bg-yellow-500/20 border-l-4 border-yellow-500 text-yellow-700 dark:text-yellow-300 p-4 mb-6 rounded-md" role="alert">
      <div className="flex items-start">
        <AlertTriangle className="h-6 w-6 text-yellow-500 mr-3 flex-shrink-0" />
        <div>
          <p className="font-bold">Seu acesso está pendente de aprovação!</p>
          <p className="text-sm">Para usar todas as funcionalidades, incluindo o acesso aos territórios, por favor, peça para um dos dirigentes ou administradores da sua congregação aprovar seu acesso.</p>
        </div>
      </div>
    </div>
  );
}
