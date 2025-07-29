"use client";

import { useState, useEffect } from "react";
import { Territory, AppUser } from "@/types/types";
import { X, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface AssignTerritoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (territoryId: string, user: { uid: string; name: string }, assignmentDate: string, dueDate: string) => void;
  territory: Territory | null;
  users: AppUser[];
}

export default function AssignTerritoryModal({ isOpen, onClose, onSave, territory, users }: AssignTerritoryModalProps) {
  const [selectedUid, setSelectedUid] = useState<string>('');
  const [assignmentDate, setAssignmentDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState('');
  
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (isOpen) {
      setSelectedUid('');
      setAssignmentDate(today);
      const futureDate = new Date();
      futureDate.setMonth(futureDate.getMonth() + 4);
      setDueDate(futureDate.toISOString().split('T')[0]);
      setError('');
    }
  }, [isOpen, today]);

  const handleSave = () => {
    if (!selectedUid || !dueDate || !assignmentDate) {
      setError("Por favor, preencha todos os campos.");
      return;
    }
    const selectedUser = users.find(u => u.uid === selectedUid);
    if (!territory || !selectedUser) return;

    onSave(territory.id, { uid: selectedUser.uid, name: selectedUser.name }, assignmentDate, dueDate);
    onClose();
  };

  if (!isOpen || !territory) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 p-4">
      <div className="bg-card text-card-foreground p-6 rounded-lg shadow-xl w-full max-w-md relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground"><X /></button>
        <h2 className="text-xl font-bold">Designar Território</h2>
        
        <Link 
          href={`/dashboard/territorios/${territory.id}`} 
          target="_blank"
          className="text-muted-foreground text-sm mb-4 inline-flex items-center hover:text-primary transition-colors"
        >
          {territory.number} - {territory.name}
          <ExternalLink size={14} className="ml-2" />
        </Link>
        
        <div className="space-y-4 mt-2">
          <div>
            <label htmlFor="user-select" className="block text-sm font-medium mb-1">Designar para:</label>
            <select id="user-select" value={selectedUid} onChange={(e) => setSelectedUid(e.target.value)} className="w-full bg-input rounded-md p-2 border border-border">
              <option value="" disabled>Selecione um publicador</option>
              {users.map(user => (<option key={user.uid} value={user.uid}>{user.name}</option>))}
            </select>
          </div>
          <div className="flex gap-4">
            <div className="w-1/2">
              <label htmlFor="assignment-date" className="block text-sm font-medium mb-1">Data de Designação:</label>
              <input id="assignment-date" type="date" value={assignmentDate} onChange={(e) => setAssignmentDate(e.target.value)} className="w-full bg-input rounded-md p-2 border border-border"/>
            </div>
            <div className="w-1/2">
              <label htmlFor="due-date" className="block text-sm font-medium mb-1">Data para Devolução:</label>
              <input id="due-date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full bg-input rounded-md p-2 border border-border"/>
            </div>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex justify-end space-x-3 pt-4">
            <button onClick={onClose} className="px-4 py-2 rounded-md bg-muted hover:bg-muted/80">Cancelar</button>
            <button onClick={handleSave} className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/80">Salvar Designação</button>
          </div>
        </div>
      </div>
    </div>
  );
}
