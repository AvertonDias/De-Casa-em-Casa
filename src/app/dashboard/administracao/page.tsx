"use client";

import { useState } from 'react';
import { Send, BookUser, FileText, House } from 'lucide-react'; // Importa novo ícone
import Link from 'next/link';
import TerritoryAssignmentPanel from '@/components/admin/TerritoryAssignmentPanel';
import { useUser } from '@/contexts/UserContext';
import { EditCongregationModal } from '@/components/EditCongregationModal';

export default function AdminPage() {
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState('assignment');

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Administração</h1>
        <p className="text-muted-foreground">Ferramentas para gerenciar a congregação.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-card p-6 rounded-lg shadow-md flex flex-col col-span-1 lg:col-span-1">
            <div className="flex items-center mb-4">
                <House className="h-6 w-6 mr-3 text-primary" />
                <h2 className="text-2xl font-bold">Minha Congregação</h2>
            </div>
            <p className="text-muted-foreground mb-6 flex-grow">
                Edite o nome e o número da sua congregação. Apenas administradores podem realizar esta ação.
            </p>
            <EditCongregationModal disabled={user?.role !== 'Administrador'} />
        </div>
      </div>

      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab('assignment')}
          className={`px-4 py-2 text-sm font-semibold transition-colors ${activeTab === 'assignment' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <BookUser size={16} className="inline-block mr-2" /> Designar Territórios
        </button>
        <button
          onClick={() => setActiveTab('notifications')}
          className={`px-4 py-2 text-sm font-semibold transition-colors ${activeTab === 'notifications' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <Send size={16} className="inline-block mr-2" /> Enviar Notificação
        </button>
        
        {/* ▼▼▼ NOVO BOTÃO/LINK AQUI ▼▼▼ */}
        <Link 
            href="/dashboard/administracao/relatorio-s13"
            className="px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors ml-auto flex items-center"
        >
          <FileText size={16} className="inline-block mr-2" />
          Gerar Relatório S-13
        </Link>
      </div>
      <div className="mt-6">
        {activeTab === 'assignment' && <TerritoryAssignmentPanel />}
        {activeTab === 'notifications' && <div>Painel de Notificações (em breve)</div>}
      </div>
    </div>
  );
}
