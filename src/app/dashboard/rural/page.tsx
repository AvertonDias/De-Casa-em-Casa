"use client";

import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useUser } from '@/contexts/UserContext';
import { RestrictedContent } from '@/components/RestrictedContent';
import { AddRuralTerritoryModal } from '@/components/AddRuralTerritoryModal';
import { EditRuralTerritoryModal } from '@/components/EditRuralTerritoryModal';
import { Map, PlusCircle, Loader, Inbox, Edit, Search } from 'lucide-react';

interface RuralTerritory {
  id: string;
  number: string;
  name: string;
  description?: string;
  mapLink?: string;
}

export default function RuralPage() {
  const { user, loading: userLoading } = useUser();
  
  const [territories, setTerritories] = useState<RuralTerritory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // A busca de dados só acontece se o usuário estiver ATIVO.
    if (user?.status === 'ativo' && user.congregationId) {
      const territoriesRef = collection(db, 'congregations', user.congregationId, 'territories');
      const q = query(territoriesRef, where("type", "==", "rural"), orderBy("number"));

      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const ruralData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as RuralTerritory[];
        setTerritories(ruralData);
        setLoading(false);
      }, (error) => {
        console.error("Erro ao buscar territórios rurais: ", error);
        setLoading(false);
      });
      return () => unsubscribe();
    } else if (!userLoading) {
      // Se não estiver carregando, paramos o spinner.
      setLoading(false);
    }
  }, [user, userLoading]);

  const filteredTerritories = territories.filter(t =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // --- Renderização Condicional ---
  
  if (userLoading || loading) {
    return <div className="flex items-center justify-center h-full"><Loader className="animate-spin text-purple-600" size={48} /></div>;
  }
  
  if (!user) {
    // Fallback caso o usuário não seja encontrado, o layout principal deve redirecionar.
    return <p>Usuário não encontrado.</p>
  }

  // Se o usuário estiver com status pendente, mostramos a tela de bloqueio.
  if (user.status === 'pendente') {
    return (
        <RestrictedContent
          title="Acesso aos Territórios Rurais Restrito"
          message="Seu acesso precisa ser aprovado por um administrador para que você possa ver esta página."
        />
    );
  }

  // Se o status for 'ativo', renderiza o conteúdo normal da página.
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Territórios Rurais</h1>
        {user.role === 'Administrador' && (
          <button onClick={() => setIsAddModalOpen(true)} className="flex items-center px-4 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700">
            <PlusCircle size={20} className="mr-2" /> Novo Território Rural
          </button>
        )}
      </div>

      <div className="mb-6 relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-5 w-5 text-gray-400" />
          </span>
          <input
              type="text"
              placeholder="Buscar por nome ou número..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-card border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
      </div>

      {filteredTerritories.length === 0 ? (
        <div className="text-center mt-16 p-6 bg-white dark:bg-[#2a2736] rounded-lg">
          <Inbox size={56} className="mx-auto text-gray-400" />
          <h2 className="mt-4 text-xl font-semibold">
            {searchTerm ? "Nenhum resultado encontrado" : "Nenhum território rural encontrado"}
          </h2>
          <p className="mt-2 text-gray-500">
            {searchTerm ? "Tente buscar por um termo diferente." : "Clique no botão acima para adicionar o primeiro."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTerritories.map((territory) => (
            <div key={territory.id} className="bg-white dark:bg-[#2a2736] p-5 rounded-lg shadow-md flex flex-col justify-between">
              <div>
                <div className="flex items-center mb-3">
                  <Map className="text-purple-500 mr-3" size={24} />
                  <h2 className="text-xl font-bold truncate">{territory.number} - {territory.name}</h2>
                </div>
                <p className="text-sm h-10 line-clamp-2">{territory.description || 'Nenhuma observação.'}</p>
              </div>
              <div className="flex items-center justify-end gap-2 mt-4">
                {territory.mapLink && (
                   <a href={territory.mapLink} target="_blank" rel="noopener noreferrer" className="px-3 py-1 text-sm font-semibold text-purple-600 hover:text-purple-400">Ver Mapa ↗</a>
                )}
                {user.role === 'Administrador' && user.congregationId && (
                   <EditRuralTerritoryModal
                     territory={territory}
                     congregationId={user.congregationId}
                     onTerritoryUpdated={() => {}}
                   />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
        
      {user.congregationId && (
        <AddRuralTerritoryModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} onTerritoryAdded={() => setIsAddModalOpen(false)} congregationId={user.congregationId} />
      )}
    </div>
  );
}
