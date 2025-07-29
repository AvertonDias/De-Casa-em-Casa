"use client";

import { useState } from 'react';
import { AssignmentHistoryLog } from '@/types/types'; // Importa a tipagem
import { BookUser, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AssignmentHistoryProps {
  history: AssignmentHistoryLog[];
}

export default function AssignmentHistory({ history }: AssignmentHistoryProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Garante que o histórico passado seja um array para evitar erros
  const validHistory = history || [];

  return (
    <div className="bg-card p-4 rounded-lg shadow-md">
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="w-full flex justify-between items-center font-semibold text-lg"
      >
        <div className="flex items-center">
          <BookUser className="mr-3 text-primary" />
          Histórico de Designações ({validHistory.length})
        </div>
        <ChevronDown className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <div className="mt-4 pt-4 border-t border-border">
          {validHistory.length > 0 ? (
            <ul className="space-y-4">
              {validHistory.map((log, index) => (
                <li key={index} className="pl-4 border-l-2 border-primary/30">
                  <p className="font-semibold text-base">{log.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Designado em: {format(log.assignedAt.toDate(), "dd 'de' MMM, yyyy", { locale: ptBR })}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Devolvido em: {format(log.completedAt.toDate(), "dd 'de' MMM, yyyy", { locale: ptBR })}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-center text-muted-foreground py-4">Nenhuma designação anterior registrada.</p>
          )}
        </div>
      )}
    </div>
  );
}