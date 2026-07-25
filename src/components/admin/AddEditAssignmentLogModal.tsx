"use client";

import { useState, useEffect } from "react";
import { AssignmentHistoryLog } from "@/types/types";
import { X, Calendar, User } from 'lucide-react';
import { Timestamp } from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";

interface AddEditAssignmentLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (originalLog: AssignmentHistoryLog, updatedData: { name: string; assignedAt: Date; completedAt: Date; }) => void;
  logToEdit: AssignmentHistoryLog | null;
}

const toInputDateString = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const fromInputDateString = (dateString: string): Date => {
  const [year, month, day] = dateString.split('-').map(Number);
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

  const hasChanges = logToEdit && (
    name !== logToEdit.name ||
    assignedAt !== toInputDateString(logToEdit.assignedAt.toDate()) ||
    completedAt !== toInputDateString(logToEdit.completedAt.toDate())
  );

  return (
    <AnimatePresence>
      {isOpen && logToEdit && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4"
        >
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 12 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="bg-card text-card-foreground p-6 rounded-2xl shadow-2xl w-full max-w-md relative border border-border/50"
          >
            <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-muted transition-colors"><X size={18} /></button>
            <h2 className="text-xl font-bold">Editar Registro do Histórico</h2>
            <p className="text-sm text-muted-foreground mb-4">Ajuste os detalhes desta designação passada.</p>
            
            <div className="space-y-4">
              <div>
                <label className="flex items-center text-sm font-medium"><User size={14} className="mr-2"/>Designado para:</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-input rounded-md p-2 mt-1 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"/>
              </div>
              <div className="flex gap-4">
                <div className="w-1/2">
                  <label className="flex items-center text-sm font-medium"><Calendar size={14} className="mr-2"/>Designado em:</label>
                  <input type="date" value={assignedAt} onChange={(e) => setAssignedAt(e.target.value)} className="w-full bg-input rounded-md p-2 mt-1 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"/>
                </div>
                <div className="w-1/2">
                  <label className="flex items-center text-sm font-medium"><Calendar size={14} className="mr-2"/>Devolvido em:</label>
                  <input type="date" value={completedAt} onChange={(e) => setCompletedAt(e.target.value)} className="w-full bg-input rounded-md p-2 mt-1 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"/>
                </div>
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <div className="flex justify-end space-x-3 pt-4 border-t border-border mt-4">
                <button onClick={onClose} className="px-4 py-2 rounded-md bg-muted hover:bg-muted/80 text-sm font-medium">Cancelar</button>
                <button onClick={handleSave} disabled={!hasChanges} className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/80 text-sm font-medium disabled:opacity-50">Salvar Alterações</button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
