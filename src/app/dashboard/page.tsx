"use client";

import { useState, useEffect } from 'react';
import { useUser } from '@/contexts/UserContext';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, collection, query, where, orderBy, limit } from 'firebase/firestore';
import { Map, CheckSquare, Loader, LandPlot, HousePlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { StatCard } from '@/components/StatCard';

// Interface for the statistics global
interface CongregationStats {
  territoryCount?: number;
  totalQuadras?: number;
  totalHouses?: number;
  totalHousesDone?: number;
  ruralTerritoryCount?: number;
}
interface RecentTerritory {
  id: string;
  name: string;
  number: string;
  progress?: number;
  lastUpdate?: { seconds: number };
}

export default function DashboardPage() {
  const { user, loading: userLoading } = useUser();
  const router = useRouter();

  const [stats, setStats] = useState<CongregationStats>({});
  const [recentTerritories, setRecentTerritories] = useState<RecentTerritory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.status === 'ativo' && user.congregationId) {
      
      // Listener 1: Ouve o documento da congregação para estatísticas GERAIS
      const congregationRef = doc(db, 'congregations', user.congregationId);
      const unsubscribeStats = onSnapshot(congregationRef, (docSnap) => {
        if (docSnap.exists()) {
          setStats(docSnap.data() as CongregationStats);
        }
        setLoading(false);
      });

      // Listener 2: Ouve os territórios para a lista de "recentemente trabalhados", filtrando rurais.
      const territoriesRef = collection(db, 'congregations', user.congregationId, 'territories');
      const q = query(
        territoriesRef, 
        where("type", "in", ["urban", null]), 
        orderBy("lastUpdate", "desc"), 
        limit(5)
      );

      const unsubscribeRecent = onSnapshot(q, (snapshot) => {
        const territoriesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as RecentTerritory[];
        setRecentTerritories(territoriesData);
      });

      // Limpa os dois listeners quando o componente é desmontado
      return () => {
        unsubscribeStats();
        unsubscribeRecent();
      };
    } else if (!userLoading) {
      setLoading(false);
    }
  }, [user, userLoading]);

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">Painel de Controle</h1>
      <p className="text-gray-500 dark:text-gray-400 mb-8">
        {user ? `Bem-vindo, ${user.name}!` : "Carregando informações do usuário..."}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard icon={Map} title="Territórios" value={stats.territoryCount || 0} loading={loading} />
        <StatCard icon={LandPlot} title="Quadras Registradas" value={stats.totalQuadras || 0} loading={loading} />
        <StatCard icon={HousePlus} title="Casas Mapeadas" value={stats.totalHouses || 0} loading={loading} />
        <StatCard icon={CheckSquare} title="Casas Visitadas" value={stats.totalHousesDone || 0} loading={loading} />
      </div>

      <div className="bg-white dark:bg-[#2a2736] p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Territórios Recentemente Trabalhados</h2>
        {loading ? ( <div className="text-center p-4"><Loader className="animate-spin mx-auto text-purple-500"/></div> ) 
         : recentTerritories.length > 0 ? (
          <ul className="space-y-4">
            {recentTerritories.map((territory) => {
              const progress = Math.round((territory.progress || 0) * 100);
              return (
                <li 
                  key={territory.id} 
                  className="group p-4 rounded-lg bg-gray-50 dark:bg-gray-900/40 hover:bg-gray-100 dark:hover:bg-gray-900/80 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md"
                  onClick={() => router.push(`/dashboard/territorios/${territory.id}`)}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-semibold text-gray-800 dark:text-white">{territory.number} - {territory.name}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Última atualização: {territory.lastUpdate ? new Date(territory.lastUpdate.seconds * 1000).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                    <p className="font-bold text-lg text-blue-600 dark:text-blue-400">{progress}%</p>
                  </div>
                  <div className="mt-3">
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${progress}%` }}></div>
                    </div>
                  </div>
                  <div className="text-right mt-2 text-sm font-semibold text-purple-600 dark:text-purple-400 group-hover:underline">
                    Ver Território →
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-gray-500 dark:text-gray-400 text-center py-4">Nenhum território foi trabalhado ainda.</p>
        )}
      </div>
    </div>
  );
}
