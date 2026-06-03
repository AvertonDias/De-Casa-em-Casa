"use client";

import { useUser } from '@/contexts/UserContext';
import { Assignment, AssignmentHistoryLog } from '@/types/types';
import { Edit, Trash2, Milestone, CheckCircle, RotateCw } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

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
    <div className="bg-card p-4 sm:p-6">
      <div className="space-y-6 relative before:absolute before:inset-y-0 before:left-[17px] before:w-0.5 before:bg-border/40">
        
        {/* Designação Atual */}
        {currentAssignment && (
          <div className="relative pl-10">
            <div className="absolute left-0 top-1.5 h-9 w-9 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center z-10">
              <Milestone className="h-5 w-5 text-primary" />
            </div>
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 shadow-sm">
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-foreground text-lg leading-tight truncate">
                    {currentAssignment.name}
                  </p>
                  <p className="text-xs font-bold text-primary uppercase tracking-widest mt-1">Designação Atual</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4 text-[13px]">
                <div className="space-y-0.5">
                  <p className="text-muted-foreground font-medium">Designado em:</p>
                  <p className="font-semibold">{format(currentAssignment.assignedAt.toDate(), "dd/MM/yyyy", { locale: ptBR })}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-muted-foreground font-medium">Prazo de Devolução:</p>
                  <p className={cn(
                    "font-bold",
                    currentAssignment.dueDate.toDate() < new Date() ? "text-red-500" : "text-foreground"
                  )}>
                    {format(currentAssignment.dueDate.toDate(), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Histórico Passado */}
        {sortedPast.map((log, index) => {
          const isTransfer = log.isCompletion === false;
          const Icon = isTransfer ? RotateCw : CheckCircle;
          const iconColor = isTransfer ? "text-blue-400 bg-blue-500/10 border-blue-500/20" : "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";

          return (
            <div key={index} className="relative pl-10 group">
              <div className={cn(
                "absolute left-0 top-1.5 h-9 w-9 rounded-full border-2 flex items-center justify-center z-10 transition-colors",
                iconColor
              )}>
                <Icon size={18} />
              </div>
              
              <div className="bg-card border border-border/40 rounded-xl p-4 hover:border-border transition-colors">
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-foreground truncate">{log.name}</p>
                    <p className="text-[10px] font-black uppercase tracking-widest mt-1 opacity-70">
                      {isTransfer ? "Transferência de Posse" : "Trabalho Concluído"}
                    </p>
                  </div>

                  {isAdmin && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => onEdit(log)} 
                        className="p-1.5 text-muted-foreground hover:bg-accent rounded-md"
                        title="Editar Registro"
                      >
                        <Edit size={14} />
                      </button>
                      <button 
                        onClick={() => onDelete(log)} 
                        className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-md"
                        title="Excluir Registro"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 mt-3 text-[12px]">
                   <div className="space-y-0.5">
                    <p className="text-muted-foreground">Início:</p>
                    <p className="font-medium">{format(log.assignedAt.toDate(), "dd/MM/yyyy", { locale: ptBR })}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-muted-foreground">{isTransfer ? "Transferido em:" : "Devolvido em:"}</p>
                    <p className="font-medium">{log.completedAt ? format(log.completedAt.toDate(), "dd/MM/yyyy", { locale: ptBR }) : '---'}</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {(!currentAssignment && sortedPast.length === 0) && (
          <div className="text-center py-10">
            <Milestone className="mx-auto h-12 w-12 text-muted-foreground/20 mb-3" />
            <p className="text-sm text-muted-foreground">Sem registros de designação.</p>
          </div>
        )}
      </div>
    </div>
  );
}