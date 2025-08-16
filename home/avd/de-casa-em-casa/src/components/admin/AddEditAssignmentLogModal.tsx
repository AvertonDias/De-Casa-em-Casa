
"use client";

import { useState, useEffect } from "react";
import { AssignmentHistoryLog } from "@/types/types";
import { X, Calendar, User } from 'lucide-react';
import { Timestamp } from "firebase/firestore";

interface AddEditAssignmentLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (originalLog: AssignmentHistoryLog, updatedData: { name: string; assignedAt: Date; completedAt: Date; }) => void;
  logToEdit: AssignmentHistoryLog | null;
}

const toInputDateString = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

const fromInputDateString = (dateString: string): Date => {
  const [year, month, day] = dateString.split('-').map(Number);
  // Adiciona T12:00:00 para evitar problemas de fuso horário que podem alterar o dia
  return new Date(year, month - 1, day, 12, 0, 0);
};

export default function AddEditAssignmentLogModal({ isOpen, onClose, onSave, logToEdit }: AddEditAssignmentLogModalProps) {
  const [name, setName] = useState('');
  const [assignedAt, setAssignedAt] = useState('');
  const [completedAt, setCompletedAt] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && logToEdit) {
      setName(logToEdit.name);
      setAssignedAt(toInputDateString(logToEdit.assignedAt.toDate()));
      // Garante que a data de devolução seja tratada corretamente
      const completedDate = logToEdit.completedAt instanceof Timestamp ? logToEdit.completedAt.toDate() : new Date();
      setCompletedAt(toInputDateString(completedDate));
      setError('');
    }
  }, [isOpen, logToEdit]);

  const handleSave = () => {
    if (!name || !assignedAt || !completedAt) {
      setError("Todos os campos são obrigatórios.");
      return;
    }
    if (!logToEdit) return;
    
    onSave(logToEdit, { 
        name, 
        assignedAt: fromInputDateString(assignedAt), 
        completedAt: fromInputDateString(completedAt) 
    });
    onClose();
  };

  if (!isOpen || !logToEdit) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 p-4">
      <div className="bg-card text-card-foreground p-6 rounded-lg shadow-xl w-full max-w-md relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground"><X /></button>
        <h2 className="text-xl font-bold">Editar Registro do Histórico</h2>
        {/* DESCRIÇÃO ADICIONADA PARA ACESSIBILIDADE */}
        <p className="text-sm text-muted-foreground mb-4">Ajuste os detalhes desta designação passada.</p>
        
        <div className="space-y-4">
          <div>
            <label className="flex items-center"><User size={14} className="mr-2"/>Designado para:</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-input rounded-md p-2 mt-1"/>
          </div>
          <div className="flex gap-4">
            <div className="w-1/2">
              <label className="flex items-center"><Calendar size={14} className="mr-2"/>Designado em:</label>
              <input type="date" value={assignedAt} onChange={(e) => setAssignedAt(e.target.value)} className="w-full bg-input rounded-md p-2 mt-1"/>
            </div>
            <div className="w-1/2">
              <label className="flex items-center"><Calendar size={14} className="mr-2"/>Devolvido em:</label>
              <input type="date" value={completedAt} onChange={(e) => setCompletedAt(e.target.value)} className="w-full bg-input rounded-md p-2 mt-1"/>
            </div>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex justify-end space-x-3 pt-4 border-t border-border mt-4">
            <button onClick={onClose} className="px-4 py-2 rounded-md bg-muted">Cancelar</button>
            <button onClick={handleSave} className="px-4 py-2 rounded-md bg-primary text-primary-foreground">Salvar Alterações</button>
          </div>
        </div>
      </div>
    </div>
  );
}
