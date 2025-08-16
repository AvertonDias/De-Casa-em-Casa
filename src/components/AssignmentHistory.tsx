
"use client";

import { useState } from 'react';
import { useUser } from '@/contexts/UserContext';
import { Assignment, AssignmentHistoryLog } from '@/types/types';
import { BookUser, ChevronDown, Edit, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"


interface AssignmentHistoryProps {
  currentAssignment?: Assignment | null;
  pastAssignments: AssignmentHistoryLog[];
  onEdit: (log: AssignmentHistoryLog) => void;
  onDelete: (log: AssignmentHistoryLog) => void;
}

export default function AssignmentHistory({ currentAssignment, pastAssignments, onEdit, onDelete }: AssignmentHistoryProps) {
  const { user } = useUser();
  const isAdmin = user?.role === 'Administrador';
  const isManager = isAdmin || user?.role === 'Dirigente';
  
  const sortedHistory = [...(pastAssignments || [])].sort((a, b) => {
    const dateA = a.completedAt?.toMillis() || 0;
    const dateB = b.completedAt?.toMillis() || 0;
    return dateB - dateA;
  }).slice(0, 8);

  if (!isManager) return null;

  return (
    <Accordion type="single" collapsible className="w-full bg-black/10 dark:bg-black/20 px-4">
      <AccordionItem value="history">
        <AccordionTrigger>
          <div className="flex items-center font-semibold text-lg">
            <BookUser className="mr-3 text-primary" />
            Histórico e Designação
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="mt-4 pt-4 border-t border-border">
            <ul className="space-y-4">
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

              {sortedHistory.map((log, index) => (
                <li key={index} className="flex justify-between items-start pl-4 border-l-2 border-border">
                  <div>
                    <p className="font-semibold">{log.name}</p>
                    <p className="text-sm text-muted-foreground">Designado: {format(log.assignedAt.toDate(), "dd/MM/yy")}</p>
                    <p className="text-sm text-muted-foreground">Devolvido: {log.completedAt ? format(log.completedAt.toDate(), "dd/MM/yy") : 'Não devolvido'}</p>
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
            {!currentAssignment && sortedHistory.length === 0 && (
              <p className="text-center text-muted-foreground py-4">Nenhuma designação encontrada.</p>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

