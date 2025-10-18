
"use client";

import Link from 'next/link';
import { Territory } from '@/types/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowRight } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';

interface RecentTerritoryCardProps {
  territory: Territory;
}

export default function RecentTerritoryCard({ territory }: RecentTerritoryCardProps) {
  const progresso = territory.progress ? Math.round(territory.progress * 100) : 0;
  
  const lastUpdateFormatted = territory.lastUpdate && territory.lastUpdate instanceof Timestamp
    ? format(territory.lastUpdate.toDate(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
    : 'Nunca trabalhado';

  return (
    // O card inteiro agora é um link clicável
    <Link href={territory.type === 'rural' ? `/dashboard/rural/${territory.id}` : `/dashboard/territorios/${territory.id}`} className="block group">
      <div className="bg-card p-4 rounded-lg space-y-3 h-full flex flex-col justify-between hover:border-primary/50 border border-transparent transition-all">
        {/* Parte Superior: Nome, Data e Progresso */}
        <div>
          <div className="flex justify-between items-start">
            <h4 className="font-bold text-base">{territory.number} - {territory.name}</h4>
            {territory.type !== 'rural' && (
                <span className="font-bold text-blue-400 text-lg">{progresso}%</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Último trabalho: {lastUpdateFormatted}</p>
        </div>
        
        {/* Parte Inferior: Barra e Link */}
        <div className="space-y-2">
            {territory.type !== 'rural' && (
                <div className="w-full bg-gray-700 rounded-full h-2">
                    <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${progresso}%` }} />
                </div>
            )}
            <div className="text-right text-sm font-semibold text-primary/80 group-hover:text-primary group-hover:underline flex items-center justify-end gap-1">
                Ver Território
                <ArrowRight size={14} />
            </div>
        </div>
      </div>
    </Link>
  );
}
