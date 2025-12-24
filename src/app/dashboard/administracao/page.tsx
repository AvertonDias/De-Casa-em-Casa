
"use client";

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Loader, BarChart3, BookUser, FileText, SettingsIcon, ClipboardList, Map, Trees } from 'lucide-react';
import Link from 'next/link';
import { useUser } from '@/contexts/UserContext';
import withAuth from '@/components/withAuth';
import { cn } from '@/lib/utils';
import CongregationEditForm from '@/components/admin/CongregationEditForm';
import S13ReportPage from './relatorio-s13/page';
import { Button } from '@/components/ui/button';

// --- Dynamic Imports for each tab ---
const TerritoryAssignmentPanel = dynamic(
  () => import('@/components/admin/TerritoryAssignmentPanel').then(mod => mod.default),
  { loading: () => <div className="flex justify-center p-8"><Loader className="animate-spin" /></div> }
);

const TerritoryCoverageStats = dynamic(
  () => import('@/components/admin/TerritoryCoverageStats').then(mod => mod.default),
  { loading: () => <div className="flex justify-center p-8"><Loader className="animate-spin" /></div> }
);

const AvailableTerritoriesReport = dynamic(
  () => import('@/components/admin/AvailableTerritoriesReport').then(mod => mod.default),
  { loading: () => <div className="flex justify-center p-8"><Loader className="animate-spin" /></div> }
);

type Tab = 'assignment' | 'overview' | 'report' | 'available';

function AdminPage() {
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState<Tab>('assignment');
  
  const isManager = user?.role === 'Administrador' || user?.role === 'Dirigente' || user?.role === 'Servo de Territórios' || user?.role === 'Ajudante de Servo de Territórios';

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
    <div className="p-4 md:p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Administração</h1>
        <p className="text-muted-foreground">Ferramentas para gerenciar e analisar os territórios.</p>
      </div>

      <div className="border-b border-border">
        <nav className="-mb-px flex space-x-4 overflow-x-auto" aria-label="Tabs">
          <TabButton tabId="assignment" label="Designar Territórios" icon={BookUser} />
          <TabButton tabId="overview" label="Visão Geral" icon={BarChart3} />
           <TabButton tabId="available" label="Disponíveis" icon={ClipboardList} />
          <TabButton tabId="report" label="Relatório S-13" icon={FileText} />
        </nav>
      </div>

      <div className="mt-6">
        {activeTab === 'overview' && <TerritoryCoverageStats />}
        {activeTab === 'assignment' && <TerritoryAssignmentPanel />}
        {activeTab === 'available' && <AvailableTerritoriesReport />}
        {activeTab === 'report' && <S13ReportPage />}
      </div>
    </div>
  );
}

export default withAuth(AdminPage);
