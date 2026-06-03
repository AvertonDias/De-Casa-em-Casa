
"use client";

import { useUser } from '@/contexts/UserContext';
import { Assignment, AssignmentHistoryLog } from '@/types/types';
import { Edit, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AssignmentHistoryProps {
  currentAssignment?: Assignment | null;
  pastAssignments: AssignmentHistoryLog[];
  onEdit: (log: AssignmentHistoryLog) => void;
  onDelete: (log: AssignmentHistoryLog) => void;
}

export default function AssignmentHistory({ currentAssignment, pastAssignments = [], onEdit, onDelete }: AssignmentHistoryProps) {
  const { user } = useUser();
  const isAdmin = user?.role === 'Administrador';

  // Ordenar histórico passado (mais recente primeiro)
  const sortedPast = [...pastAssignments].sort((a, b) => (b.completedAt?.toMillis() || 0) - (a.completedAt?.toMillis() || 0));

  return (
    <div className="bg-transparent px-4 pb-4">
      <div className="space-y-1">
        
        {/* Designação Atual */}
        {currentAssignment && (
          <div className="py-4 border-b border-border/10 group">
            <div className="flex justify-between items-center">
              <div className="space-y-1 flex-1 min-w-0">
                <p className="font-bold text-foreground text-base leading-none">{currentAssignment.name}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground mt-2">
                  <p><span className="opacity-70">Designado:</span> {format(currentAssignment.assignedAt.toDate(), "dd/MM/yyyy")}</p>
                  <p><span className="opacity-70">Devolver até:</span> {format(currentAssignment.dueDate.toDate(), "dd/MM/yyyy")}</p>
                </div>
                <span className="inline-block px-1.5 py-0.5 bg-primary/20 text-primary text-[9px] font-black uppercase rounded mt-2 tracking-tighter">Designação Atual</span>
              </div>
            </div>
          </div>
        )}

        {/* Histórico Passado */}
        {sortedPast.map((log, index) => (
          <div key={index} className="py-4 border-b border-border/10 last:border-0 group">
            <div className="flex justify-between items-center">
              <div className="space-y-1 flex-1 min-w-0">
                <p className="font-bold text-foreground text-base leading-none">{log.name}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground mt-2">
                  <p><span className="opacity-70">Designado:</span> {format(log.assignedAt.toDate(), "dd/MM/yyyy")}</p>
                  <p><span className="opacity-70">Devolvido:</span> {log.completedAt ? format(log.completedAt.toDate(), "dd/MM/yyyy") : '---'}</p>
                </div>
              </div>

              {isAdmin && (
                <div className="flex items-center gap-2 ml-4">
                  <button 
                    onClick={() => onEdit(log)} 
                    className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-white/5"
                    title="Editar Registro"
                  >
                    <Edit size={16} />
                  </button>
                  <button 
                    onClick={() => onDelete(log)} 
                    className="p-2 text-muted-foreground hover:text-red-500 transition-colors rounded-md hover:bg-red-500/10"
                    title="Excluir Registro"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {(!currentAssignment && sortedPast.length === 0) && (
          <div className="py-10 text-center text-muted-foreground italic text-sm">
            Sem registros de designação.
          </div>
        )}
      </div>
    </div>
  );
}
