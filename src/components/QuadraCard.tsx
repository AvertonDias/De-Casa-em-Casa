"use client";

import type { MouseEvent } from 'react';
import { Quadra } from '@/types/types';
import { Edit } from 'lucide-react';

interface QuadraCardProps {
  quadra: Quadra;
  isManagerView: boolean;
  onEdit: (event: MouseEvent<HTMLButtonElement>) => void;
}

export default function QuadraCard({ quadra, isManagerView, onEdit }: QuadraCardProps) {
  const totalCasas = quadra.totalHouses || 0;
  const casasFeitas = quadra.housesDone || 0;
  const casasPendentes = totalCasas - casasFeitas;
  const progresso = totalCasas > 0 ? Math.round((casasFeitas / totalCasas) * 100) : 0;

  return (
    <div className="bg-card p-5 rounded-lg shadow-md flex flex-col space-y-4 border border-border transition-all hover:shadow-xl hover:ring-2 hover:ring-primary/50">
      {/* Cabeçalho do Card */}
      <div className="flex justify-between items-start">
        <div className="flex-1">
            <h3 className="font-bold text-lg">{quadra.name || "Quadra sem nome"}</h3>
            <p className="text-sm text-muted-foreground truncate">{quadra.description || "Sem descrição"}</p>
        </div>
        {isManagerView && (
            <button 
                onClick={onEdit} 
                className="p-2 text-muted-foreground hover:text-primary transition-colors"
                aria-label={`Editar ${quadra.name}`}
            >
              <Edit size={16} />
            </button>
        )}
      </div>

      {/* Estatísticas */}
      <>
        <div className="grid grid-cols-4 gap-2 text-center">
            <div><p className="text-xs text-muted-foreground">Total</p><p className="font-bold text-xl">{totalCasas}</p></div>
            <div><p className="text-xs text-muted-foreground">Feitos</p><p className="font-bold text-xl text-green-400">{casasFeitas}</p></div>
            <div><p className="text-xs text-muted-foreground">Pendentes</p><p className="font-bold text-xl text-yellow-400">{casasPendentes}</p></div>
            <div><p className="text-xs text-muted-foreground">Progresso</p><p className="font-bold text-xl text-blue-400">{progresso}%</p></div>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2.5">
          <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${progresso}%` }}></div>
        </div>
      </>
    </div>
  );
}
