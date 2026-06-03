"use client";

import { Assignment, AssignmentHistoryLog } from '@/types/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { User, Calendar, CheckCircle2, ArrowRightLeft, Edit, Trash2, Milestone } from 'lucide-react';
import { Button } from './ui/button';
import { useUser } from '@/contexts/UserContext';
import { cn } from '@/lib/utils';

interface AssignmentHistoryProps {
  currentAssignment?: Assignment | null;
  pastAssignments: AssignmentHistoryLog[];
  onEdit?: (log: AssignmentHistoryLog) => void;
  onDelete?: (log: AssignmentHistoryLog) => void;
}

export default function AssignmentHistory({ 
  currentAssignment, 
  pastAssignments = [], 
  onEdit, 
  onDelete 
}: AssignmentHistoryProps) {
  const { user } = useUser();
  const isAdmin = user?.role === 'Administrador';

  // Combinamos todos os eventos em uma única lista para a linha do tempo
  const events = [
    ...(currentAssignment ? [{
      type: 'current' as const,
      data: currentAssignment,
      date: currentAssignment.assignedAt
    }] : []),
    ...pastAssignments.map(log => ({
      type: 'past' as const,
      data: log,
      date: log.completedAt || log.assignedAt
    }))
  ].sort((a, b) => b.date.toMillis() - a.date.toMillis());

  if (events.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground italic text-sm">
        Nenhuma designação registrada no histórico.
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="relative space-y-6 before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-primary before:via-border before:to-transparent">
        {events.map((event, index) => {
          if (event.type === 'current') {
            const a = event.data as Assignment;
            return (
              <div key="current" className="relative flex items-start gap-4">
                <div className="absolute left-0 flex items-center justify-center w-10 h-10 rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-background">
                  <User size={20} />
                </div>
                <div className="ml-12 flex-1 bg-primary/5 border border-primary/20 p-4 rounded-xl shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Designação Atual</span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      Desde {format(a.assignedAt.toDate(), "dd/MM/yyyy")}
                    </span>
                  </div>
                  <h4 className="font-bold text-lg text-foreground">{a.name}</h4>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Calendar size={14} />
                      <span>Devolver até {format(a.dueDate.toDate(), "dd/MM/yyyy")}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          }

          const log = event.data as AssignmentHistoryLog;
          const isTransfer = log.isCompletion === false;

          return (
            <div key={`${log.uid}-${log.assignedAt.toMillis()}`} className="relative flex items-start gap-4">
              <div className={cn(
                "absolute left-0 flex items-center justify-center w-10 h-10 rounded-full shadow-md ring-4 ring-background",
                isTransfer ? "bg-blue-500/10 text-blue-500" : "bg-green-500/10 text-green-500"
              )}>
                {isTransfer ? <ArrowRightLeft size={18} /> : <CheckCircle2 size={18} />}
              </div>
              <div className="ml-12 flex-1 bg-card border border-border/40 p-4 rounded-xl hover:shadow-md transition-all group">
                <div className="flex justify-between items-start mb-1">
                  <div className="flex items-center gap-2">
                     <span className={cn(
                       "text-[10px] font-bold uppercase tracking-wider",
                       isTransfer ? "text-blue-400" : "text-green-500"
                     )}>
                        {isTransfer ? "Transferência" : "Conclusão"}
                     </span>
                     {isAdmin && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                           <button onClick={() => onEdit?.(log)} className="p-1 hover:text-primary"><Edit size={12}/></button>
                           <button onClick={() => onDelete?.(log)} className="p-1 hover:text-destructive"><Trash2 size={12}/></button>
                        </div>
                     )}
                  </div>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {log.completedAt ? format(log.completedAt.toDate(), "dd/MM/yyyy") : ''}
                  </span>
                </div>
                
                <h4 className="font-bold text-foreground">{log.name}</h4>
                
                <p className="text-xs text-muted-foreground mt-1">
                  Trabalhou de {format(log.assignedAt.toDate(), "dd/MM/yyyy")} até {log.completedAt ? format(log.completedAt.toDate(), "dd/MM/yyyy") : '...'}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
