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
  
  // Garante que o histórico seja um array e ordena do mais novo para o mais antigo
  const sortedHistory = (history || []).sort((a, b) => 
    b.completedAt.toMillis() - a.completedAt.toMillis()
  );

  if (!isAdmin) {
    return null; // O componente não renderiza nada se o usuário não for admin
  }

  return (
    <div className="bg-card p-4 rounded-lg shadow-md">
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="w-full flex justify-between items-center font-semibold text-lg"
      >
        <div className="flex items-center">
          <BookUser className="mr-3 text-primary" />
          Histórico de Designações ({sortedHistory.length})
        </div>
        <ChevronDown className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <div className="mt-4 pt-4 border-t border-border">
          {sortedHistory.length > 0 ? (
            <ul className="space-y-4">
              {sortedHistory.map((log) => (
                <li key={(log as any).id || log.assignedAt.toString()} className="flex justify-between items-start pl-4 border-l-2 border-primary/30">
                  <div>
                    {/* ▼▼▼ O NOME AGORA SERÁ EXIBIDO AQUI ▼▼▼ */}
                    <p className="font-semibold text-base">{log.name || "Usuário Desconhecido"}</p>
                    <p className="text-sm text-muted-foreground">
                      Designado em: {format(log.assignedAt.toDate(), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Devolvido em: {format(log.completedAt.toDate(), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-2">
                      <button onClick={() => onEdit(log)} className="text-muted-foreground hover:text-white" title="Editar este registro"><Edit size={14} /></button>
                      <button onClick={() => onDelete(log)} className="text-muted-foreground hover:text-red-500" title="Excluir este registro"><Trash2 size={14} /></button>
                    </div>
                  )}
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