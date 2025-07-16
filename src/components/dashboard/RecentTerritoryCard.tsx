"use client";

import Link from 'next/link';
import { Territory } from '@/types/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowRight } from 'lucide-react';

interface RecentTerritoryCardProps {
  territory: Territory;
}

export default function RecentTerritoryCard({ territory }: RecentTerritoryCardProps) {
  const progresso = territory.progress ? Math.round(territory.progress * 100) : 0;
  
  // Formata a data para incluir a hora, como você pediu
  const lastUpdateFormatted = territory.lastUpdate 
    ? format(territory.lastUpdate.toDate(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
    : 'Nunca trabalhado';

  return (
    <div className="bg-card-foreground/5 p-4 rounded-lg space-y-3">
      <div className="flex justify-between items-start">
        <div>
          <h4 className="font-bold">{territory.number} - {territory.name}</h4>
          <p className="text-xs text-muted-foreground">Último trabalho: {lastUpdateFormatted}</p>
        </div>
        <span className="font-bold text-blue-400">{progresso}%</span>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-2">
        <div 
          className="bg-blue-600 h-2 rounded-full" 
          style={{ width: `${progresso}%` }}
        ></div>
      </div>
      <div className="text-right">
        <Link href={`/dashboard/territorios/${territory.id}`} className="text-sm font-semibold text-primary hover:underline flex items-center justify-end gap-1">
          Ver Território
          <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}