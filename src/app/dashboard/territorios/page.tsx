"use client";

import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useUser } from '@/contexts/UserContext';
import { Territory } from '@/types/types';
import Link from 'next/link';
import { Plus, Search, ChevronRight, Loader } from 'lucide-react';
import AddTerritoryModal from '@/components/AddTerritoryModal';
import { RestrictedContent } from '@/components/RestrictedContent';
import withAuth from '@/components/withAuth';

// ========================================================================
//   Componentes de Lista (Com Navegação Corrigida)
// ========================================================================

const TerritoryRowManager = ({ territory }: { territory: Territory }) => {
  const totalCasas = territory.stats?.totalHouses || 0;
  const casasFeitas = territory.stats?.housesDone || 0;
  const progresso = territory.progress ? Math.round(territory.progress * 100) : 0;

  return (
    // O <Link> agora envolve todo o card
    <Link href={`/dashboard/territorios/${territory.id}`} className="block group">
      <div className="bg-card p-4 rounded-lg shadow-md space-y-4 h-full group-hover:border-primary/50 border border-transparent transition-all">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-xl">{territory.number} - {territory.name}</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div><p className="text-sm text-muted-foreground">Total de Casas</p><p className="font-bold text-2xl">{totalCasas}</p></div>
            <div><p className="text-sm text-muted-foreground">Feitas</p><p className="font-bold text-2xl text-green-400">{casasFeitas}</p></div>
            <div><p className="text-sm text-muted-foreground">Pendentes</p><p className="font-bold text-2xl text-yellow-400">{totalCasas - casasFeitas}</p></div>
            <div><p className="text-sm text-muted-foreground">Progresso</p><p className="font-bold text-2xl text-blue-400">{progresso}%</p></div>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2.5"><div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${progresso}%` }}></div></div>
      </div>
    </Link>
  );
};

const TerritoryRowPublicador = ({ territory }: { territory: Territory }) => (
  // Esta versão já estava correta, com o link envolvendo tudo.
  <Link href={`/dashboard/territorios/${territory.id}`} className="block">
    <div className="flex items-center justify-between py-3 px-4 -mx-4 hover:bg-white/5 transition-colors cursor-pointer">
      <div className="flex items-center space-x-4">
        <span className="font-bold text-lg text-muted-foreground w-8 text-center">{territory.number}</span>
        <h3 className="font-semibold text-lg">{territory.name}</h3>
      </div>
      <ChevronRight className="text-muted-foreground h-5 w-5" />
    </div>
  </Link>
);


// ========================================================================
//   PÁGINA PRINCIPAL
// ========================================================================
function TerritoriosPage() {
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { user, loading: userLoading } = useUser();
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  useEffect(() => {
    if (user?.status === 'ativo' && user.congregationId) {
      const territoriesRef = collection(db, 'congregations', user.congregationId, 'territories');
      const q = query(territoriesRef, where("type", "in", ["urban", null, ""]), orderBy("number"));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Territory));
        setTerritories(data);
        setLoading(false);
      });
      return () => unsubscribe();
    } else if (!userLoading) {
        setLoading(false);
    }
  }, [user, userLoading]);

  const handleAddTerritory = async (data: any) => {
    if (!user?.congregationId) {
      throw new Error("Usuário não tem congregação associada.");
    }
    const territoriesRef = collection(db, 'congregations', user.congregationId, 'territories');
    await addDoc(territoriesRef, {
      ...data,
      createdAt: serverTimestamp(),
      lastUpdate: serverTimestamp(),
      totalHouses: 0,
      housesDone: 0,
      progress: 0,
      quadraCount: 0,
    });
  };

  const filteredTerritories = territories.filter(t =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) || t.number.includes(searchTerm)
  );
  
  if (userLoading || loading) {
    return <div className="flex items-center justify-center h-full"><Loader className="animate-spin text-purple-600" size={48} /></div>;
  }

  if (!user) {
    return null; // O layout principal redireciona
  }

  if (user.status === 'pendente') {
    return (
      <RestrictedContent
        title="Acesso aos Territórios Restrito"
        message="Seu acesso precisa ser aprovado por um administrador para que você possa ver os territórios da congregação."
      />
    );
  }
  
  const isManagerView = user?.role === 'Administrador' || user?.role === 'Dirigente';
  const isAdmin = user?.role === 'Administrador';

  return (
    <>
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold">Territórios</h1>
            <p className="text-muted-foreground">{user.congregationName || 'Sua Congregação'}</p>
          </div>

          {isAdmin && (
            <button 
              onClick={() => setIsAddModalOpen(true)} 
              className="w-full sm:w-auto bg-primary hover:bg-primary/80 text-white font-semibold py-2 px-4 rounded-md flex items-center justify-center">
              <Plus className="mr-2 h-4 w-4" /> Adicionar Território
            </button>
          )}
        </div>

        <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
            <input type="text" placeholder="Buscar por nome ou número..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-card border border-border rounded-md pl-10 pr-4 py-2" />
        </div>

        {isManagerView ? (
            <div className="space-y-4">
            {filteredTerritories.length > 0 ? (
                filteredTerritories.map(t => <TerritoryRowManager key={t.id} territory={t} />)
            ) : (<p className="text-center text-muted-foreground py-8">Nenhum território encontrado.</p>)}
            </div>
        ) : (
            <div className="bg-card rounded-lg shadow-md px-4 divide-y divide-border">
            {filteredTerritories.length > 0 ? (
                filteredTerritories.map(t => <TerritoryRowPublicador key={t.id} territory={t} />)
            ) : (<p className="text-center text-muted-foreground py-8">Nenhum território disponível.</p>)}
            </div>
        )}
      </div>

      <AddTerritoryModal 
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSave={handleAddTerritory}
      />
    </>
  );
}

export default withAuth(TerritoriosPage);
