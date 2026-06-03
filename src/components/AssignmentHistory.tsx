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
    // Usamos a data de designação como ID do ciclo
    const cycleId = log.assignedAt.toMillis().toString();
    if (!cycles[cycleId]) {
      cycles[cycleId] = { head: null, transfers: [], isCurrentCycle: false };
    }
    
    // Se for uma conclusão real, é o 'head' do ciclo no histórico
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

  if (sortedCycleIds.length === 0) {
    return (
      <div className="text-center py-8 bg-card/50 rounded-lg border border-dashed border-border/40">
        <History className="mx-auto h-12 w-12 text-muted-foreground/20 mb-2" />
        <p className="text-sm text-muted-foreground italic">Nenhuma designação registrada.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sortedCycleIds.map(cycleId => {
        const cycle = cycles[cycleId];
        const head = cycle.head;
        
        // Fallback para o cabeçalho caso o head ainda não tenha sido definido
        const displayHead = head || cycle.transfers[0];
        if (!displayHead) return null;

        const isCurrent = cycle.isCurrentCycle;
        const transfers = cycle.transfers.sort((a, b) => b.completedAt.toMillis() - a.completedAt.toMillis());
        const hasTransfers = transfers.length > 0;
        const isExpanded = expandedGroups[cycleId];

        return (
          <div key={cycleId} className="rounded-lg border border-border/40 bg-card overflow-hidden transition-all shadow-sm">
            {/* Cabeçalho do Ciclo (Item Principal) */}
            <div className={cn(
              "p-4 flex items-start justify-between gap-4",
              isCurrent && "border-l-4 border-l-primary bg-primary/5"
            )}>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-base text-foreground truncate">
                  {displayHead.name}
                </p>
                
                <div className="text-xs flex flex-wrap gap-x-3 mt-1 text-muted-foreground">
                  <span className="flex items-center gap-1">
                    Designado: <span className="text-foreground/80">{format(displayHead.assignedAt.toDate(), "dd/MM/yyyy")}</span>
                  </span>
                  {isCurrent ? (
                    <span className="flex items-center gap-1 font-semibold text-primary/80">
                      Devolver até: <span>{format((displayHead as Assignment).dueDate.toDate(), "dd/MM/yyyy")}</span>
                    </span>
                  ) : (
                    head && (
                      <span className="flex items-center gap-1">
                        Devolvido: <span className="text-foreground/80">{format((head as AssignmentHistoryLog).completedAt.toDate(), "dd/MM/yyyy")}</span>
                      </span>
                    )
                  )}
                </div>

                {hasTransfers && (
                  <button 
                    onClick={() => toggleGroup(cycleId)}
                    className="mt-3 text-xs flex items-center gap-1.5 text-primary hover:text-primary/80 font-bold transition-colors"
                  >
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    {transfers.length} {transfers.length === 1 ? 'Transferência anterior' : 'Transferências anteriores'}
                  </button>
                )}
              </div>

              {/* Ações Administrativas */}
              {isAdmin && head && !isCurrent && (
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => onEdit(head as AssignmentHistoryLog)} className="p-1.5 text-muted-foreground hover:bg-muted rounded-md transition-colors"><Edit size={14} /></button>
                  <button onClick={() => onDelete(head as AssignmentHistoryLog)} className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-md transition-colors"><Trash2 size={14} /></button>
                </div>
              )}
            </div>

            {/* Sub-lista de Transferências (Recolhida por padrão) */}
            {hasTransfers && isExpanded && (
              <div className="bg-muted/10 border-t border-border/40 divide-y divide-border/20">
                {transfers.map((t, idx) => (
                  <div key={idx} className="p-3 pl-10 flex justify-between items-start group">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold truncate text-foreground">{t.name}</p>
                        <span className="text-[9px] bg-muted-foreground/20 text-muted-foreground px-1.5 py-0.5 rounded font-bold uppercase">Transferido</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Transferido em: {format(t.completedAt.toDate(), "dd/MM/yyyy")}
                      </p>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
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
  );
}