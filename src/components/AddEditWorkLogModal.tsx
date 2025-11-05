
"use client";

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { RuralWorkLog } from '@/types/types';

interface AddEditWorkLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (logData: { notes: string }, logId?: string) => void;
  workLogToEdit?: RuralWorkLog | null;
}

export default function AddEditWorkLogModal({ isOpen, onClose, onSave, workLogToEdit }: AddEditWorkLogModalProps) {
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const isEditing = !!workLogToEdit;

  useEffect(() => {
    if (isOpen) {
      if (isEditing && workLogToEdit) {
        setNotes(workLogToEdit.notes);
      } else {
        setNotes('');
      }
      setError('');
    }
  }, [isOpen, workLogToEdit, isEditing]);

  const handleSave = () => {
    if (!notes.trim()) {
      setError('A observação não pode estar vazia.');
      return;
    }
    
    onSave({ notes }, workLogToEdit?.id);
    onClose();
  };

  const hasChanges = isEditing ? notes !== workLogToEdit?.notes : notes.trim() !== '';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="relative bg-card text-card-foreground p-6 rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground"><X /></button>
        <h2 className="text-xl font-bold">{isEditing ? 'Editar Registro de Trabalho' : 'Adicionar Novo Registro'}</h2>
        <p className="text-sm text-muted-foreground mb-4">Atualize a observação do trabalho realizado.</p>
        
        <div className="space-y-4">
          <div>
            <label htmlFor="log-notes" className="block text-sm font-medium mb-1">Observações</label>
            <textarea id="log-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="Ex: Visitamos o setor leste..." className="w-full bg-input rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-primary"/>
          </div>
          
          {error && <p className="text-sm text-red-500">{error}</p>}
          
          <div className="flex justify-end space-x-3 pt-4">
            <button onClick={onClose} className="px-4 py-2 rounded-md bg-muted hover:bg-muted/80">Cancelar</button>
            <button onClick={handleSave} disabled={!hasChanges} className="px-4 py-2 rounded-md bg-primary text-primary-foreground disabled:opacity-50">Salvar Alterações</button>
          </div>
        </div>
      </div>
    </div>
  );
}
