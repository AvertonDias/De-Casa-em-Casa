"use client";

import { useState, useContext } from 'react';
// ▼▼▼ A CORREÇÃO ESTÁ AQUI ▼▼▼
import { UserContext } from '@/contexts/UserContext'; // Importa o contexto
import { AssignmentHistoryLog } from '@/types/types';
import { BookUser, ChevronDown, Edit, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AssignmentHistoryProps {
  history: AssignmentHistoryLog[];
  onEdit: (log: AssignmentHistoryLog) => void;
  onDelete: (log: AssignmentHistoryLog) => void;
}

export default function AssignmentHistory({ history, onEdit, onDelete }: AssignmentHistoryProps) {
  // Agora 'useContext(UserContext)' funcionará porque o UserContext foi importado.
  const { user } = useContext(UserContext);
  const isAdmin = user?.role === 'Administrador';
  const [isOpen, setIsOpen] = useState(false);
  const validHistory = history || [];

  // A regra de visibilidade já estava correta.
  if (!isAdmin) {
    return null;
  }

  return (
    <div className="bg-card p-4 rounded-lg shadow-md">
      <button onClick={() => setIsOpen(!isOpen)} className="w-full flex justify-between items-center font-semibold text-lg">
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
                <li key={index} className="flex justify-between items-start pl-4 border-l-2 border-primary/30">
                  <div>
                    <p className="font-semibold">{log.name}</p>
                    <p className="text-sm text-muted-foreground">Designado: {format(log.assignedAt.toDate(), "dd/MM/yy")}</p>
                    <p className="text-sm text-muted-foreground">Devolvido: {format(log.completedAt.toDate(), "dd/MM/yy")}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => onEdit(log)} className="text-muted-foreground hover:text-white"><Edit size={14} /></button>
                    <button onClick={() => onDelete(log)} className="text-muted-foreground hover:text-red-500"><Trash2 size={14} /></button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (<p className="text-center text-muted-foreground py-4">Nenhuma designação anterior.</p>)}
        </div>
      )}
    </div>
  );
}
