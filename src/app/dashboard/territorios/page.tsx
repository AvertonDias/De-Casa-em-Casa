"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, getDocs, query, orderBy, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { AddTerritoryModal } from '@/components/AddTerritoryModal';
import { EditTerritoryModal } from '@/components/EditTerritoryModal';
import Link from 'next/link';
import { useUser } from '@/contexts/UserContext';

// Interface atualizada para incluir as estatísticas e os campos opcionais
interface Territory {
  id: string;
  number: string;
  name: string;
  description?: string;
  mapLink?: string;
  cardUrl?: string;
  stats: {
    total: number;
    feitos: number;
    pendentes: number;
    progresso: number;
  };
}

export default function TerritoriosPage() {
  const { user, loading: userLoading } = useUser();
  const [congregationName, setCongregationName] = useState('');
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (userLoading) {
      return;
    }

    if (!user || !user.congregationId) {
      console.error("Usuário não autenticado ou sem ID de congregação.");
      setLoading(false);
      return;
    }

    const fetchCongregationName = async () => {
      const congRef = doc(db, 'congregations', user.congregationId!);
      const congSnap = await getDoc(congRef);
      if (congSnap.exists()) {
        setCongregationName(congSnap.data().name);
      }
    };
    fetchCongregationName();

    const territoriesRef = collection(db, 'congregations', user.congregationId, 'territories');
    const q = query(territoriesRef, orderBy('number'));

    const unsubscribe = onSnapshot(q, async (querySnapshot) => {
      const territoriesData = await Promise.all(
        querySnapshot.docs.map(async (territoryDoc) => {
          let totalCasas = 0;
          let feitos = 0;

          const quadrasRef = collection(territoryDoc.ref, 'quadras');
          const quadrasSnap = await getDocs(quadrasRef);

          for (const quadraDoc of quadrasSnap.docs) {
            const casasRef = collection(quadraDoc.ref, 'casas');
            const casasSnap = await getDocs(casasRef);
            totalCasas += casasSnap.size;
            feitos += casasSnap.docs.filter(doc => doc.data().status === true).length;
          }

          const pendentes = totalCasas - feitos;
          const progresso = totalCasas > 0 ? Math.round((feitos / totalCasas) * 100) : 0;
          
          const data = territoryDoc.data();

          return {
            id: territoryDoc.id,
            number: data.number,
            name: data.name,
            description: data.description,
            mapLink: data.mapLink,
            cardUrl: data.cardUrl,
            stats: { total: totalCasas, feitos, pendentes, progresso }
          } as Territory;
        })
      );
      
      setTerritories(territoriesData);
      setLoading(false);
    }, (error) => {
      console.error("Erro ao ouvir territórios:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, userLoading]);

  if (loading || userLoading) {
    return <p className="text-center text-gray-400 py-10">Carregando...</p>;
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

      <div className="space-y-6">
        {territories.length > 0 ? territories.map(territory => (
          <Link key={territory.id} href={`/dashboard/territorios/${territory.id}`} className="block group cursor-pointer">
            <div className="bg-white dark:bg-[#2f2b3a] rounded-lg shadow-lg p-6 transition-all duration-200 group-hover:shadow-xl group-hover:ring-2 group-hover:ring-primary">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <span className="font-bold text-xl text-purple-600 dark:text-purple-300 mr-4">{territory.number}</span>
                  <span className="font-semibold text-lg group-hover:underline">{territory.name}</span>
                </div>
                {['Administrador', 'Dirigente'].includes(user?.role || '') && user?.congregationId && <EditTerritoryModal territory={territory} onTerritoryUpdated={() => {}} congregationId={user.congregationId} />}
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center text-xs">
                    <div><p className="text-gray-500 dark:text-gray-400">Total Casas</p><p className="font-bold text-lg">{territory.stats.total}</p></div>
                    <div><p className="text-gray-500 dark:text-gray-400">Feitas</p><p className="font-bold text-lg text-green-500">{territory.stats.feitos}</p></div>
                    <div><p className="text-gray-500 dark:text-gray-400">Pendentes</p><p className="font-bold text-lg text-yellow-500">{territory.stats.pendentes}</p></div>
                    <div><p className="text-gray-500 dark:text-gray-400">Progresso</p><p className="font-bold text-lg text-blue-500">{territory.stats.progresso}%</p></div>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-3">
                      <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${territory.stats.progresso}%` }}></div>
                  </div>
              </div>
            </div>
          </Link>
        )) : (
          <div className="text-center py-10 bg-white dark:bg-[#2f2b3a] rounded-lg">
            <p className="text-gray-400">Nenhum território cadastrado ainda.</p>
          </div>
        )}
      </div>
    </div>
  );
}
