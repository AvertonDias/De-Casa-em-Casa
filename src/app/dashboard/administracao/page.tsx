"use client";

import { useState, useEffect } from 'react';
import { Send, BookUser, FileText, House, Edit, Loader } from 'lucide-react';
import Link from 'next/link';
import TerritoryAssignmentPanel from '@/components/admin/TerritoryAssignmentPanel';
import { useUser } from '@/contexts/UserContext';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// Componente para o formulário de edição da congregação
const CongregationEditForm = () => {
  const { user } = useUser();
  const [congregationName, setCongregationName] = useState('');
  const [congregationNumber, setCongregationNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (user?.congregationId) {
      const congRef = doc(db, 'congregations', user.congregationId);
      getDoc(congRef).then(snap => {
        if (snap.exists()) {
          setCongregationName(snap.data().name || '');
          setCongregationNumber(snap.data().number || '');
        }
      });
    }
  }, [user]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');

    if (!user || !user.congregationId) {
      setError("Congregação não encontrada.");
      setIsLoading(false);
      return;
    }

    try {
      if (user.role === 'Administrador') {
        const congRef = doc(db, "congregations", user.congregationId);
        await updateDoc(congRef, { name: congregationName, number: congregationNumber });
      } else {
        throw new Error("Você não tem permissão para editar a congregação.");
      }
      setSuccess("Congregação atualizada com sucesso!");
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || "Falha ao salvar as configurações.");
    } finally {
      setIsLoading(false);
    }
  };

  const isDisabled = user?.role !== 'Administrador';

  return (
    <div className="bg-card p-6 rounded-lg shadow-md max-w-md mx-auto">
      <div className="flex items-center mb-4">
        <House className="h-6 w-6 mr-3 text-primary" />
        <h2 className="text-2xl font-bold">Dados da Congregação</h2>
      </div>
      <p className="text-muted-foreground mb-6">
        Edite o nome e o número da sua congregação. Apenas administradores podem realizar esta ação.
      </p>
      <form onSubmit={handleUpdate} className="space-y-4">
        <div>
          <label htmlFor="congregationName" className="text-sm font-medium">Nome da Congregação</label>
          <Input 
            id="congregationName"
            value={congregationName} 
            onChange={e => setCongregationName(e.target.value)} 
            placeholder="Nome da Congregação" 
            disabled={isDisabled}
            className="mt-1"
          />
        </div>
        <div>
          <label htmlFor="congregationNumber" className="text-sm font-medium">Número da Congregação</label>
          <Input 
            id="congregationNumber"
            type="tel" 
            inputMode="numeric" 
            value={congregationNumber} 
            onChange={e => setCongregationNumber(e.target.value.replace(/\D/g, ''))} 
            placeholder="Número" 
            disabled={isDisabled}
            className="mt-1"
          />
        </div>
        
        {error && <p className="text-sm text-center text-destructive">{error}</p>}
        {success && <p className="text-sm text-center text-green-500">{success}</p>}
        
        <Button type="submit" disabled={isDisabled || isLoading} className="w-full">
          {isLoading ? <Loader className="animate-spin" /> : "Salvar Alterações"}
        </Button>
      </form>
    </div>
  );
};


export default function AdminPage() {
  const { user } = useUser();
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
          onClick={() => setActiveTab('congregation')}
          className={`px-4 py-2 text-sm font-semibold transition-colors ${activeTab === 'congregation' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <Edit size={16} className="inline-block mr-2" /> Editar Congregação
        </button>
        <button
          onClick={() => setActiveTab('notifications')}
          className={`px-4 py-2 text-sm font-semibold transition-colors ${activeTab === 'notifications' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <Send size={16} className="inline-block mr-2" /> Enviar Notificação
        </button>
        
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
        {activeTab === 'congregation' && <CongregationEditForm />}
        {activeTab === 'notifications' && <div>Painel de Notificações (em breve)</div>}
      </div>
    </div>
  );
}
