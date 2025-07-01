"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useUser } from '@/contexts/UserContext';
import { AddRuralTerritoryModal } from '@/components/AddRuralTerritoryModal';
import { Map, PlusCircle, Loader, Inbox } from 'lucide-react';

// Interface para um território para garantir a tipagem
interface RuralTerritory {
  id: string;
  number: string;
  name: string;
  description: string;
  mapLink: string;
}

export default function RuralPage() {
  const router = useRouter();
  const { user, loading: userLoading } = useUser();
  
  const [territories, setTerritories] = useState<RuralTerritory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (user && user.congregationId) {
      const territoriesRef = collection(db, 'congregations', user.congregationId, 'territories');
      // A consulta agora filtra apenas os territórios do tipo 'rural'
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
      setLoading(false);
    }
  }, [user, userLoading]);

  const handleTerritoryClick = (territoryId: string) => {
    // Futuramente, esta rota pode levar a uma página de detalhes específica para territórios rurais.
    // router.push(`/dashboard/rural/${territoryId}`);
    console.log(`Clicou no território ${territoryId}. Página de detalhes a ser implementada.`);
  };

  if (loading || userLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader className="animate-spin text-purple-600" size={48} />
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Territórios Rurais</h1>
        {user?.role === 'Administrador' && ( // Apenas admins podem adicionar territórios
          <button onClick={() => setIsModalOpen(true)} className="flex items-center px-4 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition-colors">
            <PlusCircle size={20} className="mr-2" />
            Novo Território Rural
          </button>
        )}
      </div>

      {territories.length === 0 ? (
        <div className="text-center mt-16 p-6 bg-white dark:bg-[#2a2736] rounded-lg">
          <Inbox size={56} className="mx-auto text-gray-400" />
          <h2 className="mt-4 text-xl font-semibold text-gray-700 dark:text-gray-300">Nenhum território rural encontrado</h2>
          <p className="mt-2 text-gray-500 dark:text-gray-400">Clique no botão acima para adicionar o primeiro.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {territories.map((territory) => (
            <div 
              key={territory.id} 
              onClick={() => handleTerritoryClick(territory.id)}
              className="bg-white dark:bg-[#2a2736] p-5 rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer"
            >
              <div className="flex items-center mb-3">
                <Map className="text-purple-500 mr-3" size={24} />
                <h2 className="text-xl font-bold text-gray-800 dark:text-white truncate">{territory.number} - {territory.name}</h2>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 h-10 line-clamp-2">{territory.description || 'Nenhuma observação.'}</p>
              {territory.mapLink ? (
                 <a href={territory.mapLink} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="inline-block mt-4 text-sm font-semibold text-purple-600 hover:underline">
                    Ver Mapa ↗
                 </a>
              ) : (
                <p className="mt-4 text-sm text-gray-500">Sem link de mapa</p>
              )}
            </div>
          ))}
        </div>
      )}
        
      {user?.congregationId && (
        <AddRuralTerritoryModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onTerritoryAdded={() => {}} // A lista já atualiza em tempo real
          congregationId={user.congregationId}
        />
      )}
    </div>
  );
}
