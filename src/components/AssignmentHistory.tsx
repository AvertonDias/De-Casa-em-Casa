"use client";

import { useUser } from '@/contexts/UserContext';
import { Assignment, AssignmentHistoryLog } from '@/types/types';
import { Edit, Trash2, History, ArrowRightLeft, CheckCircle2, Milestone } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface AssignmentHistoryProps {
  currentAssignment?: Assignment | null;
  pastAssignments: AssignmentHistoryLog[];
  onEdit: (log: AssignmentHistoryLog) => void;
  onDelete: (log: AssignmentHistoryLog) => void;
}

export default function AssignmentHistory({ currentAssignment, pastAssignments, onEdit, onDelete }: AssignmentHistoryProps) {
  const { user } = useUser();
  const isAdmin = user?.role === 'Administrador';

  // Criamos uma lista única com todos os eventos para uma visualização linear
  const allEvents = [
    ...(currentAssignment ? [{
      ...currentAssignment,
      isCurrent: true,
      completedAt: null
    }] : []),
    ...pastAssignments.map(log => ({ ...log, isCurrent: false }))
  ];

  // Ordenar por data (mais recente primeiro)
  // Usamos completedAt (se existir) ou assignedAt para determinar a ordem cronológica da "ação"
  allEvents.sort((a, b) => {
    const dateA = (a.completedAt || a.assignedAt).toMillis();
    const dateB = (b.completedAt || b.assignedAt).toMillis();
    return dateB - dateA;
  });

  return (
    <div className="bg-card p-4">
      <div className="mt-2 space-y-3">
        {allEvents.length > 0 ? (
          allEvents.map((event, index) => {
            const isCurrent = 'isCurrent' in event && event.isCurrent;
            const isTransfer = !isCurrent && event.isCompletion === false;
            const isReturn = !isCurrent && event.isCompletion !== false;
            
            // Verificar se está atrasado
            const isOverdue = isCurrent && event.dueDate && event.dueDate.toDate() < new Date();

            return (
              <div 
                key={index} 
                className={cn(
                  "relative pl-8 pb-4 last:pb-0 border-l-2 ml-3 transition-all",
                  isCurrent ? "border-primary" : "border-border"
                )}
              >
                {/* Ícone da Linha do Tempo */}
                <div className={cn(
                  "absolute -left-[11px] top-0 p-1 rounded-full border-2 bg-background z-10",
                  isCurrent ? "border-primary text-primary" : "border-border text-muted-foreground"
                )}>
                  {isCurrent ? <Milestone size={14} /> : (isTransfer ? <ArrowRightLeft size={14} /> : <CheckCircle2 size={14} />)}
                </div>

                <div className={cn(
                  "p-3 rounded-lg border shadow-sm transition-all",
                  isCurrent ? "bg-primary/5 border-primary/30" : "bg-muted/30 border-border/50"
                )}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-sm sm:text-base truncate">
                          {event.name}
                        </p>
                        {isCurrent && (
                          <span className="text-[10px] bg-primary text-primary-foreground px-2 py-0.5 rounded-full font-bold uppercase tracking-tighter">
                            Atual
                          </span>
                        )}
                        {isTransfer && (
                          <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-bold uppercase tracking-tighter">
                            Transferido
                          </span>
                        )}
                      </div>
                      
                      <div className="text-xs sm:text-sm mt-1 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <span className="font-medium">Início:</span> 
                          {format(event.assignedAt.toDate(), "dd/MM/yyyy", { locale: ptBR })}
                        </div>

                        {isCurrent ? (
                          <div className={cn("flex items-center gap-1 font-bold", isOverdue ? "text-red-500" : "text-foreground")}>
                            <span>Devolver:</span>
                            {format((event as Assignment).dueDate.toDate(), "dd/MM/yyyy", { locale: ptBR })}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <span className="font-medium">{isTransfer ? "Transferido:" : "Devolvido:"}</span>
                            {event.completedAt ? format(event.completedAt.toDate(), "dd/MM/yyyy", { locale: ptBR }) : '---'}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Ações para Administrador */}
                    {isAdmin && !isCurrent && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button 
                          onClick={() => onEdit(event as AssignmentHistoryLog)} 
                          className="p-1.5 text-muted-foreground hover:bg-background rounded-md transition-colors"
                          title="Editar registro"
                        >
                          <Edit size={14} />
                        </button>
                        <button 
                          onClick={() => onDelete(event as AssignmentHistoryLog)} 
                          className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-md transition-colors"
                          title="Excluir registro"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-8">
            <History className="mx-auto h-12 w-12 text-muted-foreground/20 mb-2" />
            <p className="text-sm text-muted-foreground">Nenhuma designação registrada.</p>
          </div>
        )}
      </div>
    </div>
  );
}
