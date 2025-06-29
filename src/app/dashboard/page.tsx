"use client";

import { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Map, Grid, Home, CheckCircle } from 'lucide-react';
import { useUser } from '@/contexts/UserContext';

interface Territory {
  id: string;
  name: string;
  number: string;
  lastUpdate: string;
  progress: number;
}

interface Stats {
  totalTerritories: number;
  registeredBlocks: number;
  mappedHouses: number;
  visitedHouses: number;
}

function StatCard({ title, value, icon: Icon }: { title: string; value: number; icon: React.ElementType }) {
  return (
    <div className="bg-white dark:bg-[#2f2b3a] p-6 rounded-lg shadow-md flex items-center space-x-4">
      <div className="bg-blue-100 dark:bg-purple-900/50 p-3 rounded-full">
        <Icon className="h-6 w-6 text-blue-600 dark:text-purple-300" />
      </div>
      <div>
        <p className="text-gray-500 dark:text-gray-400 text-sm">{title}</p>
        <p className="text-2xl font-bold text-gray-800 dark:text-white">{value}</p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user, loading: userLoading } = useUser();
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalTerritories: 10,
    registeredBlocks: 5,
    mappedHouses: 0,
    visitedHouses: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userLoading) {
      return;
    }
    if (!user || !user.congregationId) {
        console.error("Usuário não autenticado ou sem ID de congregação.");
        setLoading(false);
        return;
    }

    const fetchDashboardData = async () => {
      try {
        const territoriesRef = collection(db, 'congregations', user.congregationId, 'territories');
        
        const q = query(territoriesRef, orderBy('lastUpdate', 'desc'), limit(3));
        const querySnapshot = await getDocs(q);

        const fetchedTerritories = querySnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name,
          number: doc.data().number,
          lastUpdate: new Date(doc.data().lastUpdate.seconds * 1000).toLocaleDateString('pt-BR'),
          progress: doc.data().progress || 0,
        })) as Territory[];
        
        setTerritories(fetchedTerritories);
        
        // TODO: A lógica de estatísticas precisa ser implementada
        setStats({
          totalTerritories: 10,
          registeredBlocks: 5,
          mappedHouses: 0,
          visitedHouses: 0,
        });

      } catch (error) {
        console.error("Erro ao buscar dados do painel:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [user, userLoading]);

  if (loading) {
    return <div className="text-center text-gray-500 dark:text-gray-400">Carregando dados do painel...</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Painel</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Visão geral da gestão de territórios</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total de Territórios" value={stats.totalTerritories} icon={Map} />
        <StatCard title="Quadras Registradas" value={stats.registeredBlocks} icon={Grid} />
        <StatCard title="Casas Mapeadas" value={stats.mappedHouses} icon={Home} />
        <StatCard title="Casas Visitadas" value={stats.visitedHouses} icon={CheckCircle} />
      </div>

      <div className="bg-white dark:bg-[#2f2b3a] p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Territórios Recentemente Trabalhados</h2>
        <div className="space-y-4">
          {territories.length > 0 ? territories.map(territory => (
            <div key={territory.id} className="border-b border-gray-200 dark:border-gray-700 pb-4 last:border-b-0">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-semibold text-gray-700 dark:text-gray-200">Território {territory.number} - {territory.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Última atualização em {territory.lastUpdate}</p>
                </div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{territory.progress}% completo</p>
              </div>
              <div className="flex justify-end mt-2">
                 <button className="flex items-center text-sm text-blue-600 hover:text-blue-800 font-semibold py-1 px-3 rounded-md bg-blue-100 hover:bg-blue-200 dark:text-purple-300 dark:hover:text-purple-200 dark:bg-purple-900/50 dark:hover:bg-purple-900">
                   <Home className="h-4 w-4 mr-2" />
                   Ver Território
                 </button>
              </div>
            </div>
          )) : (
            <p className="text-gray-500 dark:text-gray-400">Nenhum território trabalhado recentemente.</p>
          )}
        </div>
      </div>
    </div>
  );
}
