
"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, orderBy, onSnapshot, doc, getDoc, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { AddTerritoryModal } from '@/components/AddTerritoryModal';
import { EditTerritoryModal } from '@/components/EditTerritoryModal';
import { useUser } from '@/contexts/UserContext';
import { Search, Inbox, Loader } from 'lucide-react';
import { RestrictedContent } from '@/components/RestrictedContent';

interface Territory {
  id: string;
  number: string;
  name: string;
  description?: string;
  mapLink?: string;
  cardUrl?: string;
  totalHouses?: number;
  housesDone?: number;
  progress?: number;
}

export default function TerritoriosPage() {
  const { user, loading: userLoading } = useUser();
  const [congregationName, setCongregationName] = useState('');
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (userLoading) return;

    if (user?.status === 'ativo' && user.congregationId) {
      const fetchCongregationName = async () => {
        const congRef = doc(db, 'congregations', user.congregationId!);
        const congSnap = await getDoc(congRef);
        if (congSnap.exists()) {
          setCongregationName(congSnap.data().name);
        }
      };
      fetchCongregationName();

      const territoriesRef = collection(db, 'congregations', user.congregationId, 'territories');
      const q = query(territoriesRef, where("type", "==", "urban"), orderBy('number'));

      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const territoriesData = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as Territory[];
        
        setTerritories(territoriesData);
        setLoading(false);
      }, (error) => {
        console.error("Erro ao ouvir territórios:", error);
        setLoading(false);
      });

      return () => unsubscribe();
    } else if (!userLoading) {
        setLoading(false);
    }
  }, [user, userLoading]);
  
  const filteredTerritories = territories.filter(territory =>
    territory.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    territory.number.toString().toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading || userLoading) {
    return <div className="flex justify-center items-center h-full"><Loader className="animate-spin" /></div>;
  }

  if (!user) {
    return <p>Usuário não encontrado.</p>;
  }

  if (user.status === 'pendente') {
    return (
        <RestrictedContent
            title="Acesso aos Territórios Restrito"
            message="Seu acesso precisa ser aprovado por um administrador para que você possa ver esta página."
        />
    )
  }

  return (
    <div className="text-gray-800 dark:text-white">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold">Territórios da congregação</h1>
          <h2 className="text-2xl font-semibold text-purple-600 dark:text-purple-400">
            {congregationName || 'Carregando...'}
          </h2>
        </div>
        {user?.role === 'Administrador' && user?.congregationId && <AddTerritoryModal onTerritoryAdded={() => {}} congregationId={user.congregationId} />}
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

      <div className="space-y-6">
        {filteredTerritories.length > 0 ? (
          filteredTerritories.map(territory => {
            const totalHouses = territory.totalHouses || 0;
            const housesDone = territory.housesDone || 0;
            const progress = territory.progress || 0;
            const housesPending = totalHouses - housesDone;

            return (
              <div key={territory.id} onClick={() => router.push(`/dashboard/territorios/${territory.id}`)} className="block group cursor-pointer">
                <div className="bg-white dark:bg-[#2f2b3a] rounded-lg shadow-lg p-6 transition-all duration-200 group-hover:shadow-xl group-hover:ring-2 group-hover:ring-primary">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <span className="font-bold text-xl text-purple-600 dark:text-purple-300 mr-4">{territory.number}</span>
                      <span className="font-semibold text-lg group-hover:underline">{territory.name}</span>
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                        {['Administrador', 'Dirigente'].includes(user?.role || '') && user?.congregationId && <EditTerritoryModal territory={territory} onTerritoryUpdated={() => {}} congregationId={user.congregationId} />}
                    </div>
                  </div>

                  {user && ['Administrador', 'Dirigente'].includes(user.role) && (
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center text-xs">
                          <div><p className="text-gray-500 dark:text-gray-400">Total Casas</p><p className="font-bold text-lg">{totalHouses}</p></div>
                          <div><p className="text-gray-500 dark:text-gray-400">Feitas</p><p className="font-bold text-lg text-green-500">{housesDone}</p></div>
                          <div><p className="text-gray-500 dark:text-gray-400">Pendentes</p><p className="font-bold text-lg text-yellow-500">{housesPending}</p></div>
                          <div><p className="text-gray-500 dark:text-gray-400">Progresso</p><p className="font-bold text-lg text-blue-500">{Math.round(progress * 100)}%</p></div>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-3">
                            <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${progress * 100}%` }}></div>
                        </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })
        ) : (
          <div className="text-center mt-16 p-6 bg-white dark:bg-[#2a2736] rounded-lg">
              <Inbox size={56} className="mx-auto text-gray-400" />
              <h2 className="mt-4 text-xl font-semibold text-gray-800 dark:text-white">
                {searchTerm ? "Nenhum resultado encontrado" : "Nenhum território cadastrado"}
              </h2>
              <p className="mt-2 text-gray-500 dark:text-gray-400">
                {searchTerm ? "Tente buscar por um termo diferente." : "Clique em \"Adicionar Território\" para começar."}
              </p>
          </div>
        )}
      </div>
    </div>
  );
}
