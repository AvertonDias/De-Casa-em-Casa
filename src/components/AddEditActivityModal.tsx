"use client";

import { useState, useEffect } from 'react';
import { Activity } from '@/types/types';
import { useUser } from '@/contexts/UserContext';
import { Timestamp } from 'firebase/firestore';
import { X } from 'lucide-react';

interface AddEditActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (activityData: { activityDate: Date, notes: string }, activityId?: string) => void;
  activityToEdit?: Activity | null;
}

const toDate = (dateString: string) => {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
};

const toInputDateString = (date: Date | Timestamp | undefined): string => {
  const d = date instanceof Timestamp ? date.toDate() : date || new Date();
  return d.toISOString().split('T')[0];
};

export default function AddEditActivityModal({ isOpen, onClose, onSave, activityToEdit }: AddEditActivityModalProps) {
  const { user } = useUser();
  const [date, setDate] = useState<string>(toInputDateString(new Date()));
  const [notes, setNotes] = useState('');

  const isEditing = !!activityToEdit;

  useEffect(() => {
    if (isOpen) {
      if (isEditing && activityToEdit) {
        setDate(toInputDateString(activityToEdit.activityDate));
        setNotes(activityToEdit.notes || '');
      } else {
        setDate(toInputDateString(new Date()));
        setNotes('');
      }
    }
  }, [isOpen, activityToEdit, isEditing]);

  const handleSave = () => {
    if (!user) return;

    const activityData = {
      activityDate: toDate(date),
      notes: notes.trim(),
    };
    
    onSave(activityData, activityToEdit?.id);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="relative bg-card text-card-foreground p-6 rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground"><X /></button>
        <h2 className="text-xl font-bold mb-4">{isEditing ? 'Editar Registro' : 'Adicionar Registro ao Histórico'}</h2>
        
        <div className="space-y-4">
          <div>
            <label htmlFor="date" className="block text-sm font-medium mb-1">Data da Atividade</label>
            <input 
              id="date" 
              type="date"
              value={date} 
              onChange={(e) => setDate(e.target.value)} 
              className="w-full bg-input rounded-md p-2" 
            />
          </div>

          <div>
            <label htmlFor="notes" className="block text-sm font-medium mb-1">Observações (Opcional)</label>
            <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full bg-input rounded-md p-2" placeholder="Ex: Território iniciado pela família Silva."></textarea>
          </div>
          
          <div className="flex justify-end space-x-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-md bg-muted hover:bg-muted/80">Cancelar</button>
            <button type="button" onClick={handleSave} className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/80">Salvar</button>
          </div>
        </div>
      </div>
    </div>
  );
}
