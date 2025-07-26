"use client";

import { useState, useEffect } from 'react';
import { useUser } from '@/contexts/UserContext';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, limit, onSnapshot, doc } from 'firebase/firestore';
import type { Territory, Congregation } from '@/types/types';
import { LandPlot, CheckSquare, HousePlus, Map, Loader } from 'lucide-react';
import RecentTerritoryCard from '@/components/dashboard/RecentTerritoryCard'; 
import { StatCard } from '@/components/StatCard';
import withAuth from '@/components/withAuth'; // Importa o segurança

function DashboardPage() {
  const { user, loading: userLoading } = useUser();
  const [congregation, setCongregation] = useState<Congregation | null>(null);
  const [recentTerritories, setRecentTerritories] = useState<Territory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.congregationId) {
      if (!userLoading) setLoading(false);
      return;
    }    // Listener para o status online do usuário (opcional, depende da implementação)
    // if (user) {
    //   const userStatusRef = doc(db, 'users', user.uid);
    //   const unsubUserStatus = onSnapshot(userStatusRef, (docSnap) => {
    //     // Implemente a lógica para atualizar o estado online do usuário aqui se necessário
    //   });
    //   unsubs.push(unsubUserStatus);
    // }


    // Listener para as estatísticas gerais da congregação
    const congRef = doc(db, 'congregations', user.congregationId);
    const unsubCong = onSnapshot(congRef, (docSnap) => {
      setCongregation(docSnap.exists() ? docSnap.data() as Congregation : null);
    });

    // Listener para os territórios recentemente trabalhados
    const territoriesRef = collection(db, 'congregations', user.congregationId, 'territories');
    const q = query(
      territoriesRef, 
      where("type", "in", ["urban", null, ""]),
      orderBy("lastUpdate", "desc"), 
      limit(8)
    );
    
    const unsubTerritories = onSnapshot(q, (snapshot) => {
      const territoriesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Territory));
      setRecentTerritories(territoriesData);
      if (loading) setLoading(false);
    });

    return () => { 
      unsubCong();
      unsubTerritories();
    };
  }, [user, userLoading]);

  if (userLoading || loading) {
    return (
        <div className="flex justify-center items-center h-full">
            <Loader className="animate-spin text-primary" size={32}/>
        </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Painel de Controle</h1>
        <p className="text-muted-foreground">Boas-vindas, {user?.name || 'usuário'}!</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard icon={Map} title="Territórios" value={congregation?.territoryCount || 0} loading={loading} />
        <StatCard icon={LandPlot} title="Quadras" value={congregation?.totalQuadras || 0} loading={loading} />
        <StatCard icon={HousePlus} title="Casas Mapeadas" value={congregation?.totalHouses || 0} loading={loading} />
        <StatCard icon={CheckSquare} title="Casas Visitadas" value={congregation?.totalHousesDone || 0} loading={loading} />
      </div>
      
      <div>
        <h2 className="text-2xl font-bold mb-4">Territórios Recentemente Trabalhados</h2>
        {recentTerritories.length > 0 ? (
          <div className="space-y-4">
            {recentTerritories.map(territory => (
              <RecentTerritoryCard key={territory.id} territory={territory} />
            ))}
          </div>
        ) : (
          <div className="text-center p-8 bg-card rounded-lg">
            <p className="text-muted-foreground">Nenhum território foi trabalhado recentemente.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default withAuth(DashboardPage); // Envolve a página com o segurança
