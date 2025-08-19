"use client";

import { useState, useEffect } from "react";
import { Territory } from "@/types/types";
import { X, CalendarCheck } from 'lucide-react';

interface ReturnTerritoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (territoryId: string, returnDate: string) => void;
  territory: Territory | null;
}

export default function ReturnTerritoryModal({ isOpen, onClose, onConfirm, territory }: ReturnTerritoryModalProps) {
  const [returnDate, setReturnDate] = useState('');
  const [error, setError] = useState('');

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (isOpen) {
      setReturnDate(today);
      setError('');
    }
  }, [isOpen, today]);

  const handleConfirm = () => {
    if (!returnDate) {
      setError("Por favor, selecione uma data de devolução.");
      return;
    }
    if (!territory) return;
    
    onConfirm(territory.id, returnDate);
    onClose();
  };

  if (!isOpen || !territory) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 p-4">
      <div className="bg-card text-card-foreground p-6 rounded-lg shadow-xl w-full max-w-md relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground"><X /></button>
        <h2 className="text-xl font-bold flex items-center"><CalendarCheck className="mr-3 text-primary"/>Devolver Território</h2>
        
        <p className="text-muted-foreground text-sm mt-2 mb-4">
          Confirme a devolução do território <span className="font-semibold text-primary">{territory.number} - {territory.name}</span> por <span className="font-semibold text-white">{territory.assignment?.name}</span>.
        </p>
        
        <div className="space-y-4">
          <div>
            <label htmlFor="return-date" className="block text-sm font-medium mb-1">Data da Devolução:</label>
            <input
              id="return-date"
              type="date"
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
              max={today} 
              className="w-full bg-input rounded-md p-2 border border-border focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          
          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex justify-end space-x-3 pt-4 border-t border-border mt-4">
            <button onClick={onClose} className="px-4 py-2 rounded-md bg-muted hover:bg-muted/80">Cancelar</button>
            <button onClick={handleConfirm} className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/80">Confirmar Devolução</button>
          </div>
        </div>
      </div>
    </div>
  );
}
