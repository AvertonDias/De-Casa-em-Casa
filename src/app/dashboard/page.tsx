
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useUser } from '@/contexts/UserContext';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import type { Territory, AuditLog } from '@/types/types';
import { CheckSquare, HousePlus, Map, Loader, Trees, History, User, Clock } from 'lucide-react';
import RecentTerritoryCard from '@/components/dashboard/RecentTerritoryCard'; 
import { StatCard } from '@/components/StatCard';
import withAuth from '@/components/withAuth';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Link from 'next/link';

function DashboardPage() {
  const { user, loading: userLoading } = useUser();
  const [recentTerritories, setRecentTerritories] = useState<Territory[]>([]);
  const [allTerritories, setAllTerritories] = useState<Territory[]>([]);
  const [recentLogs, setRecentLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const isFullAdmin = user?.role === 'Administrador';

  useEffect(() => {
    if (!user?.congregationId) {
      if (!userLoading) setLoading(false);
      return;
    }

    const congregationId = user.congregationId;
    const territoriesRef = collection(db, 'congregations', congregationId, 'territories');
    
    // Listener para estatísticas
    const unsubAllTerritories = onSnapshot(territoriesRef, (snapshot) => {
      const territoriesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Territory));
      setAllTerritories(territoriesData);
      setLoading(false);
    });

    // Listener para territórios recentemente trabalhados
    const qRecent = query(
      territoriesRef, 
      where("lastWorkedAt", "!=", null),
      orderBy("lastWorkedAt", "desc"), 
      limit(4)
    );
    const unsubRecentTerritories = onSnapshot(qRecent, (snapshot) => {
      setRecentTerritories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Territory)));
    });

    // Listener para logs de auditoria (apenas para Administradores)
    let unsubLogs = () => {};
    if (isFullAdmin) {
      const logsRef = collection(db, 'congregations', congregationId, 'auditLogs');
      const qLogs = query(logsRef, orderBy('timestamp', 'desc'), limit(5));
      unsubLogs = onSnapshot(qLogs, (snapshot) => {
        setRecentLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AuditLog)));
      });
    }

    return () => { 
      unsubAllTerritories();
      unsubRecentTerritories();
      unsubLogs();
    };
  }, [user?.congregationId, isFullAdmin, userLoading]);

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
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Lado Esquerdo: Territórios Trabalhados */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Map className="text-primary" size={24} />
            Trabalho Recente
          </h2>
          {recentTerritories.length > 0 ? (
            <div className="space-y-4">
              {recentTerritories.map(territory => (
                <RecentTerritoryCard key={territory.id} territory={territory} />
              ))}
              <Link href="/dashboard/territorios" className="block text-center text-sm font-semibold text-primary hover:underline">
                Ver todos os territórios
              </Link>
            </div>
          ) : (
            <div className="bg-card p-8 rounded-lg text-center border border-dashed border-border">
              <p className="text-muted-foreground">Nenhum território trabalhado recentemente.</p>
            </div>
          )}
        </div>

        {/* Lado Direito: Histórico do App (Admin) ou Tarefas (Outros) */}
        {isFullAdmin ? (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <History className="text-primary" size={24} />
              Últimas Alterações no App
            </h2>
            <div className="bg-card rounded-lg border border-border/40 shadow-sm divide-y divide-border/20">
              {recentLogs.length > 0 ? (
                <>
                  {recentLogs.map((log) => (
                    <div key={log.id} className="p-4 space-y-1">
                      <div className="flex justify-between items-start gap-2">
                        <p className="text-sm font-medium leading-relaxed">
                          <span className="text-primary font-bold">{log.userName}</span> {log.details}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground uppercase font-bold tracking-widest">
                        <span className="flex items-center gap-1">
                          <Clock size={10} />
                          {log.timestamp ? formatDistanceToNow(log.timestamp.toDate(), { addSuffix: true, locale: ptBR }) : '...'}
                        </span>
                        <span className="bg-muted px-1.5 py-0.5 rounded">{log.action.replace(/_/g, ' ')}</span>
                      </div>
                    </div>
                  ))}
                  <Link href="/dashboard/historico" className="block p-3 text-center text-xs font-bold text-primary hover:bg-white/5 transition-colors uppercase tracking-widest">
                    Ver Histórico Completo
                  </Link>
                </>
              ) : (
                <div className="p-8 text-center text-muted-foreground italic text-sm">
                  Nenhuma alteração registrada ainda.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <User className="text-primary" size={24} />
              Suas Tarefas
            </h2>
            <div className="bg-card p-6 rounded-lg border border-border/40 shadow-sm">
               <p className="text-sm text-muted-foreground leading-relaxed">
                 Use o menu lateral para acessar <strong>"Meus Territórios"</strong> e ver o que está sob sua responsabilidade, ou explore os <strong>"Tutoriais"</strong> para aprender a usar as ferramentas de campo.
               </p>
               <Link href="/dashboard/meus-territorios" className="mt-4 inline-flex items-center justify-center w-full px-4 py-2 bg-primary text-white font-bold rounded-md hover:bg-primary/90 transition-all shadow-md">
                  Ir para Meus Territórios
               </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default withAuth(DashboardPage);
