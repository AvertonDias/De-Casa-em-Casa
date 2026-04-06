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
import CongregationEditForm from '@/components/admin/CongregationEditForm';
import { ConfirmationModal } from '@/components/ConfirmationModal';

type Tab = 'assignment' | 'overview' | 'report' | 'available' | 'settings';

function AdminPage() {
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState<Tab>('assignment');
  
  // Estados para gerenciar alterações não salvas
  const [isFormDirty, setIsFormDirty] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [pendingTab, setPendingTab] = useState<Tab | null>(null);
  
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

  const handleTabClick = (tabId: Tab) => {
    if (activeTab === 'settings' && isFormDirty) {
      setPendingTab(tabId);
      setShowExitConfirm(true);
    } else {
      setActiveTab(tabId);
    }
  };

  const confirmExit = () => {
    if (pendingTab) {
      setActiveTab(pendingTab);
      setIsFormDirty(false);
    }
    setShowExitConfirm(false);
    setPendingTab(null);
  };

  const TabButton = ({ tabId, label, icon: Icon }: { tabId: Tab, label: string, icon: React.ElementType }) => (
    <button
      onClick={() => handleTabClick(tabId)}
      className={cn(
        "whitespace-nowrap rounded-t-md px-3 sm:px-4 py-2 text-sm font-semibold transition-colors flex items-center gap-2",
        activeTab === tabId
          ? 'bg-background text-primary border-b-2 border-primary'
          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
      )}
    >
      <Icon size={16} /> {label}
    </button>
  );

  const isWideTab = activeTab === 'report' || activeTab === 'available';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Administração</h1>
        <p className="text-muted-foreground">Ferramentas para gerenciar e analisar os territórios.</p>
      </div>

      <div className="border-b border-border">
        <nav className="-mb-px flex flex-wrap gap-x-2 sm:gap-x-4" aria-label="Tabs">
          <TabButton tabId="assignment" label="Designar" icon={BookUser} />
          <TabButton tabId="overview" label="Visão Geral" icon={BarChart3} />
          <TabButton tabId="available" label="Disponíveis" icon={ClipboardList} />
          <TabButton tabId="report" label="S-13" icon={FileText} />
          {isAdmin && (
            <TabButton tabId="settings" label="Configurações" icon={Settings} />
          )}
        </nav>
      </div>

      <div className={cn(
        "mt-6", 
        isWideTab && "overflow-x-auto"
      )}>
        {activeTab === 'assignment' && <TerritoryAssignmentPanel />}
        {activeTab === 'overview' && <TerritoryCoverageStats />}
        {activeTab === 'available' && <AvailableTerritoriesReport />}
        {activeTab === 'report' && <S13ReportPage />}
        {activeTab === 'settings' && isAdmin && (
          <div className="max-w-2xl mx-auto">
             <CongregationEditForm 
                onSaveSuccess={() => setIsFormDirty(false)} 
                onDirtyChange={setIsFormDirty}
             />
          </div>
        )}
      </div>

      <ConfirmationModal
        isOpen={showExitConfirm}
        onClose={() => setShowExitConfirm(false)}
        onConfirm={confirmExit}
        title="Alterações não salvas"
        message="Você fez alterações nas configurações que ainda não foram salvas. Tem certeza que deseja sair? Suas mudanças serão perdidas."
        confirmText="Sim, Sair e Descartar"
        cancelText="Continuar Editando"
        variant="destructive"
      />
    </div>
  );
}

export default withAuth(AdminPage);
