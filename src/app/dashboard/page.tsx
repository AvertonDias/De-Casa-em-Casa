
"use client";

import { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, onSnapshot, getDocs, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useUser } from '@/contexts/UserContext';
import { Map, Grid, Home, CheckCircle, Users, type LucideProps } from 'lucide-react';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import Link from 'next/link';


// --- Tipagens ---
interface Stats {
  totalTerritories: number;
  registeredBlocks: number;
  mappedHouses: number;
  visitedHouses: number;
  totalUsers: number;
}
interface Territory {
  id: string;
  name: string;
  number: string;
  lastUpdate: string;
  progress: number;
}

// --- Componente StatCard com tipagem correta para o ícone ---
type IconComponent = ForwardRefExoticComponent<Omit<LucideProps, "ref"> & RefAttributes<SVGSVGElement>>;

function StatCard({ title, value, icon: Icon }: { title: string; value: number | string; icon: IconComponent }) {
  return (
    <div className="bg-white dark:bg-[#2f2b3a] p-6 rounded-lg shadow-md flex items-center space-x-4">
      <div className="bg-blue-100 dark:bg-purple-900/50 p-3 rounded-full">
        <Icon className="h-6 w-6 text-blue-600 dark:text-purple-300" />
      </div>
      <div>
        <p className="text-gray-500 dark:text-gray-400 text-sm">{title}</p>
        <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{value}</p>
      </div>
    </div>
  );
}

// --- Página Principal ---
export default function DashboardPage() {
  const { user, loading: userLoading } = useUser();
  const [stats, setStats] = useState<Stats>({ totalTerritories: 0, registeredBlocks: 0, mappedHouses: 0, visitedHouses: 0, totalUsers: 0 });
  const [recentTerritories, setRecentTerritories] = useState<Territory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userLoading) return;
    
    if (!user?.congregationId) {
      setLoading(false);
      return;
    }
    
    const congregationId = user.congregationId;

    // Fetch stats securely
    const fetchStats = async () => {
        try {
            // Count users securely
            const usersQuery = query(collection(db, "users"), where("congregationId", "==", congregationId));
            const usersSnap = await getDocs(usersQuery);
            
            // Count territories securely
            const territoriesRef = collection(db, 'congregations', congregationId, 'territories');
            const territoriesSnap = await getDocs(territoriesRef);
            
            // Per instructions, more complex stats are set to 0 for now.
            setStats({
                totalUsers: usersSnap.size,
                totalTerritories: territoriesSnap.size,
                registeredBlocks: 0,
                mappedHouses: 0,
                visitedHouses: 0,
            });
        } catch (error) {
            console.error("Erro ao buscar estatísticas: ", error);
        }
    };

    fetchStats();

    // Listener for recent territories
    const territoriesRef = collection(db, 'congregations', user.congregationId, 'territories');
    const q = query(territoriesRef, orderBy('lastUpdate', 'desc'), limit(3));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedTerritories = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
              id: doc.id,
              name: data.name,
              number: data.number,
              // Check for lastUpdate existence and that it's a Firestore Timestamp
              lastUpdate: data.lastUpdate?.seconds ? new Date(data.lastUpdate.seconds * 1000).toLocaleDateString('pt-BR') : 'N/A',
              progress: data.progress || 0,
          }
      }) as Territory[];
      setRecentTerritories(fetchedTerritories);
      setLoading(false);
    }, (error) => {
        console.error("Erro ao buscar territórios recentes: ", error);
        setLoading(false);
    });

    return () => unsubscribe();
  }, [user, userLoading]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Painel</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Visão geral da gestão de territórios</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        <StatCard title="Total de Usuários" value={stats.totalUsers} icon={Users} />
        <StatCard title="Total de Territórios" value={stats.totalTerritories} icon={Map} />
        <StatCard title="Quadras Registradas" value={stats.registeredBlocks} icon={Grid} />
        <StatCard title="Casas Mapeadas" value={stats.mappedHouses} icon={Home} />
        <StatCard title="Casas Visitadas" value={stats.visitedHouses} icon={CheckCircle} />
      </div>
      <div className="bg-white dark:bg-[#2f2b3a] p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Territórios Recentemente Trabalhados</h2>
        <div className="space-y-4">
        {loading ? <p className="text-gray-500 dark:text-gray-400">Carregando...</p> : (
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
