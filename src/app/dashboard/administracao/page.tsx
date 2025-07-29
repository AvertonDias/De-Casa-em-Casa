"use client";

import { useState } from 'react';
import { Send, BookUser } from 'lucide-react';
import TerritoryAssignmentPanel from '@/components/admin/TerritoryAssignmentPanel';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('assignment');

  const renderPanel = () => {
    switch (activeTab) {
      case 'notifications':
        return <div>Painel de Notificações (em breve)</div>;
      case 'assignment':
        return <TerritoryAssignmentPanel />;
      default:
        return null;
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Administração</h1>
        <p className="text-muted-foreground">Ferramentas para gerenciar a congregação.</p>
      </div>

      {/* Abas de Navegação */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab('assignment')}
          className={`px-4 py-2 text-sm font-semibold transition-colors ${activeTab === 'assignment' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <BookUser size={16} className="inline-block mr-2" />
          Designar Territórios
        </button>
        <button
          onClick={() => setActiveTab('notifications')}
          className={`px-4 py-2 text-sm font-semibold transition-colors ${activeTab === 'notifications' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <Send size={16} className="inline-block mr-2" />
          Enviar Notificação
        </button>
      </div>

      {/* Painel Ativo */}
      <div className="mt-6">
        {renderPanel()}
      </div>
    </div>
  );
}
