"use client";

import { useState } from 'react';
// ▼▼▼ CORREÇÃO APLICADA AQUI ▼▼▼
import { useUser } from '@/contexts/UserContext'; // Usamos o hook customizado
import { Assignment, AssignmentHistoryLog } from '@/types/types';
import { BookUser, ChevronDown, Edit, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AssignmentHistoryProps {
  currentAssignment?: Assignment | null;
  pastAssignments: AssignmentHistoryLog[];
  onEdit: (log: AssignmentHistoryLog) => void;
  onDelete: (log: AssignmentHistoryLog) => void;
}

export default function AssignmentHistory({ currentAssignment, pastAssignments, onEdit, onDelete }: AssignmentHistoryProps) {
  // ▼▼▼ A CHAMADA CORRETA E SEGURA ▼▼▼
  const { user } = useUser();
  const isAdmin = user?.role === 'Administrador';
  const [isOpen, setIsOpen] = useState(true); // Deixa aberto por padrão
  
  const validHistory = pastAssignments || [];

  // O componente só é visível para Admins
  if (!isAdmin) return null;

  return (
    <div className="bg-card p-4 rounded-lg shadow-md">
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="w-full flex justify-between items-center font-semibold text-lg"
      >
        <div className="flex items-center">
          <BookUser className="mr-3 text-primary" />
          Histórico e Designação Atual
        </div>
        <ChevronDown className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <div className="mt-4 pt-4 border-t border-border">
          <ul className="space-y-4">
            {/* Seção para a Designação Atual */}
            {currentAssignment && (
              <li className="flex justify-between items-start p-3 bg-primary/10 rounded-lg border-l-4 border-primary">
                <div>
                  <p className="font-semibold text-base">{currentAssignment.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Designado em: {format(currentAssignment.assignedAt.toDate(), "dd/MM/yy", { locale: ptBR })}
                  </p>
                  <p className="text-sm font-semibold text-primary">
                    Devolver até: {format(currentAssignment.dueDate.toDate(), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                </div>
              </li>
            )}
            {/* Seção para o Histórico Passado */}
            {validHistory.map((log) => (
              <li key={(log as any).id || log.assignedAt.toString()} className="flex justify-between items-start pl-4 border-l-2 border-border">
                <div>
                  <p className="font-semibold">{log.name}</p>
                  <p className="text-sm text-muted-foreground">Designado: {format(log.assignedAt.toDate(), "dd/MM/yy")}</p>
                  <p className="text-sm text-muted-foreground">Devolvido: {format(log.completedAt.toDate(), "dd/MM/yy")}</p>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-2">
                    <button onClick={() => onEdit(log)} className="text-muted-foreground hover:text-white" title="Editar"><Edit size={14} /></button>
                    <button onClick={() => onDelete(log)} className="text-muted-foreground hover:text-red-500" title="Excluir"><Trash2 size={14} /></button>
                  </div>
                )}
              </li>
            ))}
          </ul>
          {!currentAssignment && validHistory.length === 0 && (
            <p className="text-center text-muted-foreground py-4">Nenhuma designação encontrada.</p>
          )}
        </div>
      )}
    </div>
  );
}
