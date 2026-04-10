
"use client";

import { useState } from 'react';
import { useUser } from '@/contexts/UserContext';
import { Assignment, AssignmentHistoryLog } from '@/types/types';
import { Edit, Trash2, ChevronDown, ChevronRight, History } from 'lucide-react';
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
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  // Agrupamento por ciclo (mesma data de designação original)
  const cycles: Record<string, {
    head: Assignment | AssignmentHistoryLog | null;
    transfers: AssignmentHistoryLog[];
    isCurrentCycle: boolean;
  }> = {};

  // Processar histórico passado
  pastAssignments.forEach(log => {
    const cycleId = log.assignedAt.toMillis().toString();
    if (!cycles[cycleId]) {
      cycles[cycleId] = { head: null, transfers: [], isCurrentCycle: false };
    }
    
    // Se for uma conclusão real (ou se não houver flag, assumimos conclusão), é o 'head' do ciclo no histórico
    if (log.isCompletion !== false) {
      cycles[cycleId].head = log;
    } else {
      // Se for apenas transferência, entra na sub-lista
      cycles[cycleId].transfers.push(log);
    }
  });

  // Processar designação atual (se houver, ela assume o 'head' do seu ciclo)
  if (currentAssignment) {
    const cycleId = currentAssignment.assignedAt.toMillis().toString();
    if (!cycles[cycleId]) {
      cycles[cycleId] = { head: null, transfers: [], isCurrentCycle: true };
    }
    cycles[cycleId].head = currentAssignment;
    cycles[cycleId].isCurrentCycle = true;
  }

  // Ordenar ciclos pela data de designação (mais recente primeiro)
  const sortedCycleIds = Object.keys(cycles).sort((a, b) => Number(b) - Number(a));

  return (
    <div className="bg-card p-4">
        <div className="mt-4 pt-4 border-t border-border">
          <div className="space-y-4">
            {sortedCycleIds.map(cycleId => {
              const cycle = cycles[cycleId];
              const head = cycle.head;
              
              // Fallback para o cabeçalho caso o head ainda não tenha sido definido (segurança)
              const displayHead = head || cycle.transfers[0];
              if (!displayHead) return null;

              const isCurrent = cycle.isCurrentCycle;
              const transfers = cycle.transfers.sort((a, b) => b.completedAt.toMillis() - a.completedAt.toMillis());
              const hasTransfers = transfers.length > 0;
              const isExpanded = expandedGroups[cycleId];

              // Verificar se está atrasado
              const isOverdue = isCurrent && (displayHead as Assignment).dueDate && (displayHead as Assignment).dueDate.toDate() < new Date();

              return (
                <div key={cycleId} className={cn(
                  "rounded-lg border transition-all",
                  isCurrent ? "border-primary/40 bg-primary/5 shadow-sm" : "border-border bg-card"
                )}>
                  {/* Cabeçalho do Ciclo */}
                  <div className={cn(
                    "p-3 flex items-start justify-between gap-3",
                    isCurrent && "border-l-4 border-l-primary"
                  )}>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className={cn("font-bold truncate text-base", isCurrent ? "text-primary" : "text-foreground")}>
                          {displayHead.name}
                        </p>
                      </div>
                      
                      <div className="text-[13px] text-muted-foreground flex flex-wrap gap-x-4 mt-1">
                        <span>Designado: {format(displayHead.assignedAt.toDate(), "dd/MM/yy")}</span>
                        {isCurrent ? (
                          <span className={cn(
                            "font-bold",
                            isOverdue ? "text-red-500" : "text-foreground"
                          )}>
                            Devolver até: {format((displayHead as Assignment).dueDate.toDate(), "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                        ) : (
                          head && <span>Devolvido: {format((head as AssignmentHistoryLog).completedAt.toDate(), "dd/MM/yy")}</span>
                        )}
                      </div>

                      {hasTransfers && (
                        <button 
                          onClick={() => toggleGroup(cycleId)}
                          className="mt-2 text-[13px] flex items-center gap-1.5 text-primary hover:underline font-bold transition-colors"
                        >
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          {transfers.length} {transfers.length === 1 ? 'Transferência anterior' : 'Transferências anteriores'}
                        </button>
                      )}
                    </div>

                    {/* Ações Administrativas */}
                    {isAdmin && head && !isCurrent && (
                      <div className="flex items-center gap-1">
                        <button onClick={() => onEdit(head as AssignmentHistoryLog)} className="p-1.5 text-muted-foreground hover:bg-muted rounded-md transition-colors"><Edit size={14} /></button>
                        <button onClick={() => onDelete(head as AssignmentHistoryLog)} className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-md transition-colors"><Trash2 size={14} /></button>
                      </div>
                    )}
                  </div>

                  {/* Sub-menu de Transferências (Recolhido por padrão) */}
                  {hasTransfers && isExpanded && (
                    <div className="bg-muted/20 border-t border-border/40 divide-y divide-border/20">
                      {transfers.map((t, idx) => (
                        <div key={idx} className="p-3 pl-8 flex justify-between items-start group">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold truncate text-foreground">{t.name}</p>
                              <span className="text-[9px] bg-muted text-foreground px-1.5 py-0.5 rounded font-bold uppercase">Transferido</span>
                            </div>
                            <p className="text-[11px] text-foreground mt-0.5">
                              Transferido em: {format(t.completedAt.toDate(), "dd/MM/yy", { locale: ptBR })}
                            </p>
                          </div>
                          {isAdmin && (
                            <div className="flex items-center gap-1 shrink-0">
                              <button onClick={() => onEdit(t)} className="p-1.5 text-muted-foreground hover:bg-muted rounded-md transition-colors"><Edit size={12} /></button>
                              <button onClick={() => onDelete(t)} className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-md transition-colors"><Trash2 size={12} /></button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {sortedCycleIds.length === 0 && (
            <div className="text-center py-8">
              <History className="mx-auto h-12 w-12 text-muted-foreground/20 mb-2" />
              <p className="text-sm text-muted-foreground">Nenhuma designação registrada.</p>
            </div>
          )}
        </div>
    </div>
  );
}
