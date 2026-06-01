
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useUser } from '@/contexts/UserContext';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import type { Territory } from '@/types/types';
import { CheckSquare, HousePlus, Map, Loader, Trees } from 'lucide-react';
import RecentTerritoryCard from '@/components/dashboard/RecentTerritoryCard'; 
import { StatCard } from '@/components/StatCard';
import withAuth from '@/components/withAuth';
import Link from 'next/link';

function DashboardPage() {
  const { user, loading: userLoading } = useUser();
  const [recentTerritories, setRecentTerritories] = useState<Territory[]>([]);
  const [allTerritories, setAllTerritories] = useState<Territory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.congregationId) {
      if (!userLoading) setLoading(false);
      return;
    }

    const congregationId = user.congregationId;
    const territoriesRef = collection(db, 'congregations', congregationId, 'territories');
    
    const unsubAllTerritories = onSnapshot(territoriesRef, (snapshot) => {
      const territoriesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Territory));
      setAllTerritories(territoriesData);
      setLoading(false);
    });

    const qRecent = query(
      territoriesRef, 
      where("lastWorkedAt", "!=", null),
      orderBy("lastWorkedAt", "desc"), 
      limit(8)
    );
    const unsubRecentTerritories = onSnapshot(qRecent, (snapshot) => {
      setRecentTerritories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Territory)));
    });

    return () => { 
      unsubAllTerritories();
      unsubRecentTerritories();
    };
  }, [user?.congregationId, userLoading]);

  const stats = useMemo(() => {
    return allTerritories.reduce((acc, territory) => {
        if (territory.type === 'rural') {
            acc.ruralTerritoryCount += 1;
        } else {
            acc.territoryCount += 1;
            acc.totalHouses += territory.stats?.totalHouses || 0;
            acc.totalHousesDone += territory.stats?.housesDone || 0;
        }
        return acc;
    }, {
        territoryCount: 0,
        ruralTerritoryCount: 0,
        totalHouses: 0,
        totalHousesDone: 0,
    });
  }, [allTerritories]);

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
        <p className="text-muted-foreground">Boas-vindas, {user?.name}!</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard icon={Map} title="Territórios Urbanos" value={stats.territoryCount} />
        <StatCard icon={Trees} title="Territórios Rurais" value={stats.ruralTerritoryCount} />
        <StatCard icon={HousePlus} title="Casas Mapeadas" value={stats.totalHouses} />
        <StatCard icon={CheckSquare} title="Casas Visitadas" value={stats.totalHousesDone} />
      </div>
      
      <div className="max-w-5xl">
        <div className="space-y-4">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Map className="text-primary" size={24} />
            Trabalho Recente
          </h2>
          {recentTerritories.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {recentTerritories.map(territory => (
                  <RecentTerritoryCard key={territory.id} territory={territory} />
                ))}
              </div>
              <Link href="/dashboard/territorios" className="block text-center text-sm font-semibold text-primary hover:underline mt-4">
                Ver todos os territórios
              </Link>
            </>
          ) : (
            <div className="bg-card p-8 rounded-lg text-center border border-dashed border-border">
              <p className="text-muted-foreground">Nenhum território trabalhado recentemente.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default withAuth(DashboardPage);
