
"use client";

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { BookUser, FileText, Edit, Loader, Settings } from 'lucide-react';
import Link from 'next/link';
import { useUser } from '@/contexts/UserContext';
import withAuth from '@/components/withAuth';

// --- Dynamic Imports ---
const TerritoryAssignmentPanel = dynamic(
  () => import('@/components/admin/TerritoryAssignmentPanel').then(mod => mod.default),
  { loading: () => <div className="flex justify-center p-8"><Loader className="animate-spin" /></div> }
);

const CongregationEditForm = dynamic(
  () => import('@/components/admin/CongregationEditForm').then(mod => mod.default),
  { loading: () => <div className="flex justify-center p-8"><Loader className="animate-spin" /></div> }
);


function AdminPage() {
  const { user } = useUser();
  
  const isAdmin = user?.role === 'Administrador';
  const isManager = isAdmin || user?.role === 'Dirigente' || user?.role === 'Servo de Territórios' || user?.role === 'Ajudante de Servo de Territórios';

  const [activeTab, setActiveTab] = useState('assignment');

  if (!user || !isManager) {
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
        <p className="text-muted-foreground">Ferramentas para gerenciar os territórios e a congregação.</p>
      </div>

      <div className="border-b border-border overflow-x-auto">
        <div className="flex items-center">
            <TabButton id="assignment" label="Designar Territórios" icon={BookUser} />
            {isAdmin && (
              <TabButton id="congregation" label="Editar Congregação" icon={Settings} />
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
        {activeTab === 'congregation' && isAdmin && <CongregationEditForm onSaveSuccess={() => setActiveTab('assignment')} />}
      </div>
    </div>
  );
}

export default withAuth(AdminPage);
