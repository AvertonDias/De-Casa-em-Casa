"use client";

import { useState, useEffect } from 'react';
import { useUser } from '@/contexts/UserContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, onSnapshot, DocumentData, orderBy, limit } from 'firebase/firestore';
import { Users, Map, Home, CheckSquare, Loader, Building, Grid, CheckCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface StatCardProps {
  icon: React.ElementType;
  title: string;
  value: number | string;
  loading: boolean;
}

function StatCard({ icon: Icon, title, value, loading }: StatCardProps) {
  return (
    <div className="bg-white dark:bg-[#2f2b3a] p-6 rounded-lg shadow-md flex items-center">
      <div className="bg-purple-600/20 text-purple-500 p-3 rounded-full mr-4">
        <Icon size={24} />
      </div>
      <div>
        <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium">{title}</h3>
        {loading ? (
          <div className="h-7 w-12 bg-gray-300 dark:bg-gray-600 rounded-md animate-pulse mt-1"></div>
        ) : (
          <p className="text-2xl font-bold text-gray-800 dark:text-white">{value}</p>
        )}
      </div>
    </div>
  );
}

interface Territory {
  id: string;
  name: string;
  number: string;
  lastUpdate: string;
  progress: number;
}


export default function DashboardPage() {
  const { user, loading: userLoading } = useUser();
  const router = useRouter();

  const [stats, setStats] = useState({
    users: 0,
    territories: 0,
    blocks: 0, 
    houses: 0,
    housesVisited: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);
  const [recentTerritories, setRecentTerritories] = useState<Territory[]>([]);
  
  useEffect(() => {
    if (!userLoading && user?.congregationId) {
      const congregationId = user.congregationId;
      setLoadingStats(true);

      // Fetch users count
      const fetchUsers = async () => {
        const usersQuery = query(collection(db, "users"), where("congregationId", "==", congregationId));
        const usersSnap = await getDocs(usersQuery);
        setStats(prev => ({ ...prev, users: usersSnap.size }));
      };

      fetchUsers();

      // Listener for territories and their stats
      const territoriesRef = collection(db, 'congregations', congregationId, 'territories');
      const q = query(territoriesRef, orderBy('lastUpdate', 'desc'), limit(3));

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetchedTerritories = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                name: data.name,
                number: data.number,
                lastUpdate: data.lastUpdate?.seconds ? new Date(data.lastUpdate.seconds * 1000).toLocaleDateString('pt-BR') : 'N/A',
                progress: data.progress || 0,
            }
        }) as Territory[];

        setRecentTerritories(fetchedTerritories);
        setStats(prev => ({ ...prev, territories: snapshot.size })); // Note: this might not be total size if you limit
        setLoadingStats(false);
      }, (error) => {
          console.error("Erro ao buscar territórios: ", error);
          setLoadingStats(false);
      });

      // You can expand this to fetch total territories count separately if the query is limited
      const fetchTotalTerritories = async () => {
          const territoriesSnap = await getDocs(collection(db, 'congregations', congregationId, 'territories'));
          setStats(prev => ({...prev, territories: territoriesSnap.size}));
      }
      fetchTotalTerritories();


      return () => unsubscribe();

    } else if (!userLoading) {
      setLoadingStats(false);
    }
  }, [user, userLoading]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Painel</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Visão geral da gestão de territórios</p>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        <StatCard title="Total de Usuários" value={stats.users} icon={Users} loading={loadingStats} />
        <StatCard title="Total de Territórios" value={stats.territories} icon={Map} loading={loadingStats} />
        <StatCard title="Quadras Registradas" value={stats.blocks} icon={Grid} loading={loadingStats} />
        <StatCard title="Casas Mapeadas" value={stats.houses} icon={Home} loading={loadingStats} />
        <StatCard title="Casas Visitadas" value={stats.housesVisited} icon={CheckCircle} loading={loadingStats} />
      </div>

      <div className="bg-white dark:bg-[#2f2b3a] p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Territórios Recentemente Trabalhados</h2>
        <div className="space-y-4">
        {loadingStats ? <p className="text-gray-500 dark:text-gray-400">Carregando...</p> : (
            recentTerritories.length > 0 
            ? recentTerritories.map(territory => (
                <div key={territory.id} className="border-b border-gray-200 dark:border-gray-700 pb-4 last:border-b-0">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-gray-700 dark:text-gray-200">Território {territory.number} - {territory.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Última atualização em {territory.lastUpdate}</p>
                    </div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{territory.progress}% completo</p>
                  </div>
                  <div className="flex justify-end mt-2">
                     <Link href={`/dashboard/territorios/${territory.id}`} className="flex items-center text-sm text-blue-600 hover:text-blue-800 font-semibold py-1 px-3 rounded-md bg-blue-100 hover:bg-blue-200 dark:text-purple-300 dark:hover:text-purple-200 dark:bg-purple-900/50 dark:hover:bg-purple-900">
                       <Home className="h-4 w-4 mr-2" />
                       Ver Território
                     </Link>
                  </div>
                </div>
            ))
            : <p className="text-gray-500 dark:text-gray-400">Nenhum território trabalhado recentemente.</p>
        )}
        </div>
      </div>
    </div>
  );
}
