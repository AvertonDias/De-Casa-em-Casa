"use client";

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { BookUser, FileText, Edit, Loader } from 'lucide-react';
import Link from 'next/link';
import { useUser } from '@/contexts/UserContext';
import withAuth from '@/components/withAuth';

// --- Dynamic Imports ---
// Estes componentes serão carregados apenas quando forem necessários.
const TerritoryAssignmentPanel = dynamic(
  () => import('@/components/admin/TerritoryAssignmentPanel'),
  { loading: () => <div className="flex justify-center p-8"><Loader className="animate-spin" /></div> }
);

const CongregationEditForm = dynamic(
  () => import('@/components/admin/CongregationEditForm'),
  { loading: () => <div className="flex justify-center p-8"><Loader className="animate-spin" /></div> }
);


function AdminPage() {
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState('assignment');

  // Verifica se o usuário tem permissão para ver esta página
  if (!user || !['Administrador', 'Dirigente'].includes(user.role)) {
    return (
      <div className="p-4 text-center">
        <h1 className="font-bold text-xl">Acesso Negado</h1>
        <p className="text-muted-foreground">Você não tem permissão para acessar esta área.</p>
      </div>
    );
  }
  
  const TabButton = ({ id, label, icon: Icon }: { id: string, label: string, icon: React.ElementType }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`whitespace-nowrap px-3 py-2 text-sm font-semibold transition-colors flex items-center gap-2 ${activeTab === id ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
    >
      <Icon size={16} />
      <span>{label}</span>
    </button>
  );

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Administração</h1>
        <p className="text-muted-foreground">Ferramentas para gerenciar a congregação.</p>
      </div>

      <div className="border-b border-border overflow-x-auto">
        <div className="flex items-center">
            <TabButton id="assignment" label="Designar Territórios" icon={BookUser} />
            {user.role === 'Administrador' && (
              <TabButton id="congregation" label="Editar Congregação" icon={Edit} />
            )}
            
            <Link 
                href="/dashboard/administracao/relatorio-s13"
                className="whitespace-nowrap px-3 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors ml-auto flex items-center gap-2"
            >
              <FileText size={16} />
              <span>Relatório S-13</span>
            </Link>
        </div>
      </div>
      <div className="mt-6">
        {activeTab === 'assignment' && <TerritoryAssignmentPanel />}
        {activeTab === 'congregation' && user.role === 'Administrador' && <CongregationEditForm />}
      </div>
    </div>
  );
}

export default withAuth(AdminPage);
