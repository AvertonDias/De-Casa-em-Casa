"use client";

import { useState } from 'react';
import { BarChart3, BookUser, FileText, ClipboardList, Settings } from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import withAuth from '@/components/withAuth';
import { cn } from '@/lib/utils';
import TerritoryAssignmentPanel from '@/components/admin/TerritoryAssignmentPanel';
import TerritoryCoverageStats from '@/components/admin/TerritoryCoverageStats';
import AvailableTerritoriesReport from '@/components/admin/AvailableTerritoriesReport';
import S13ReportPage from './relatorio-s13/page';
import { Button } from '@/components/ui/button';
import { EditCongregationModal } from '@/components/EditCongregationModal';
import CongregationEditForm from '@/components/admin/CongregationEditForm';


type Tab = 'assignment' | 'overview' | 'report' | 'available' | 'settings';

function AdminPage() {
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState<Tab>('assignment');
  
  const isManager = user?.role === 'Administrador' || user?.role === 'Dirigente' || user?.role === 'Servo de Territórios' || user?.role === 'Ajudante de Servo de Territórios';
  const isAdmin = user?.role === 'Administrador';


  if (!user || !isManager) {
    return (
      <div className="p-4 text-center">
        <h1 className="font-bold text-xl">Acesso Negado</h1>
        <p className="text-muted-foreground">Você não tem permissão para acessar esta área.</p>
      </div>
    );
  }

  const TabButton = ({ tabId, label, icon: Icon }: { tabId: Tab, label: string, icon: React.ElementType }) => (
    <button
      onClick={() => setActiveTab(tabId)}
      className={cn(
        "whitespace-nowrap px-3 py-2 text-sm font-semibold transition-colors flex items-center gap-2",
        activeTab === tabId
          ? 'text-primary border-b-2 border-primary'
          : 'text-muted-foreground hover:text-foreground'
      )}
    >
      <Icon size={16} /> {label}
    </button>
  );

  return (
    <>
      <div className="p-4 md:p-6 lg:p-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Administração</h1>
          <p className="text-muted-foreground">Ferramentas para gerenciar e analisar os territórios.</p>
        </div>

        <div className="border-b border-border flex justify-between items-center">
          <nav className="-mb-px flex space-x-4 overflow-x-auto" aria-label="Tabs">
            <TabButton tabId="assignment" label="Designar Territórios" icon={BookUser} />
            <TabButton tabId="overview" label="Visão Geral" icon={BarChart3} />
            <TabButton tabId="available" label="Disponíveis" icon={ClipboardList} />
            <TabButton tabId="report" label="Relatório S-13" icon={FileText} />
          </nav>
        </div>

        <div className="mt-6">
          {activeTab === 'assignment' && <TerritoryAssignmentPanel />}
          {activeTab === 'overview' && <TerritoryCoverageStats />}
          {activeTab === 'available' && <AvailableTerritoriesReport />}
          {activeTab === 'report' && <S13ReportPage />}
        </div>
      </div>
    </>
  );
}

export default withAuth(AdminPage);
