
"use client";

import dynamic from 'next/dynamic';
import { BookUser, FileText, Loader, BarChart, Settings } from 'lucide-react';
import Link from 'next/link';
import { useUser } from '@/contexts/UserContext';
import withAuth from '@/components/withAuth';

// --- Dynamic Imports ---
const TerritoryAssignmentPanel = dynamic(
  () => import('@/components/admin/TerritoryAssignmentPanel').then(mod => mod.default),
  { loading: () => <div className="flex justify-center p-8"><Loader className="animate-spin" /></div> }
);

const TerritoryCoverageStats = dynamic(
  () => import('@/components/admin/TerritoryCoverageStats').then(mod => mod.default),
  { loading: () => <div className="flex justify-center p-8"><Loader className="animate-spin" /></div> }
);


function AdminPage() {
  const { user } = useUser();
  
  const isManager = user?.role === 'Administrador' || user?.role === 'Dirigente' || user?.role === 'Servo de Territórios' || user?.role === 'Ajudante de Servo de Territórios';

  if (!user || !isManager) {
    return (
      <div className="p-4 text-center">
        <h1 className="font-bold text-xl">Acesso Negado</h1>
        <p className="text-muted-foreground">Você não tem permissão para acessar esta área.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Administração</h1>
        <p className="text-muted-foreground">Ferramentas para gerenciar e analisar os territórios.</p>
      </div>

      <div className="border-b border-border" />

      <TerritoryCoverageStats />

      <div className="mt-8">
        <TerritoryAssignmentPanel />
      </div>
      
      <div className="mt-8 pt-6 border-t border-border">
         <Link 
            href="/dashboard/administracao/relatorio-s13"
            className="inline-flex items-center justify-center px-4 py-2 bg-secondary text-secondary-foreground font-semibold rounded-lg hover:bg-secondary/80 w-full sm:w-auto"
        >
          <FileText size={16} className="mr-2" />
          <span>Gerar Relatório S-13</span>
        </Link>
      </div>
    </div>
  );
}

export default withAuth(AdminPage);
