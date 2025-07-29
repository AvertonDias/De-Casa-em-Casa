"use client";

import { useState } from 'react';
import { Send, BookUser, FileText } from 'lucide-react'; // Importa novo ícone
import Link from 'next/link'; // Importa o Link
import TerritoryAssignmentPanel from '@/components/admin/TerritoryAssignmentPanel';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('assignment');

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Administração</h1>
        <p className="text-muted-foreground">Ferramentas para gerenciar a congregação.</p>
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
