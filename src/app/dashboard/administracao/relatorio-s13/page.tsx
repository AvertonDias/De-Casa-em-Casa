
"use client";

import S13Report from '@/components/admin/S13Report';
import withAuth from '@/components/withAuth';
import { useUser } from '@/contexts/UserContext';
import { ArrowLeft, FileText } from 'lucide-react';
import Link from 'next/link';

function S13ReportPage() {
  const { user } = useUser();
  const isManager = user?.role === 'Administrador' || user?.role === 'Dirigente' || user?.role === 'Servo de Territórios' || user?.role === 'Ajudante de Servo de Territórios';

  if (!isManager) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold text-destructive">Acesso Negado</h1>
        <p className="text-muted-foreground mt-2">Você não tem permissão para visualizar este relatório.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col gap-2">
        <Link 
          href="/dashboard/mais" 
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
        >
          <ArrowLeft size={16} className="mr-2" /> Voltar para Mais Opções
        </Link>
        <h1 className="text-3xl font-extrabold flex items-center gap-3">
          <FileText className="text-orange-500" size={32} />
          Relatório S-13
        </h1>
        <p className="text-muted-foreground">Registro oficial de cobertura de territórios da congregação.</p>
      </div>

      <S13Report />
    </div>
  );
}

export default withAuth(S13ReportPage);
