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
  const [customName, setCustomName] = useState('');
  const [assignmentDate, setAssignmentDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState('');
  
  const today = new Date().toISOString().split('T')[0];
  const isFreeChoice = selectedUid === 'free-choice';

  useEffect(() => {
    if (isOpen) {
      setSelectedUid('');
      setCustomName('');
      setAssignmentDate(today);
      const futureDate = new Date();
      futureDate.setMonth(futureDate.getMonth() + 2);
      setDueDate(futureDate.toISOString().split('T')[0]);
      setError('');
      console.log("AssignTerritoryModal: Users received for selection:", users); // <-- ADICIONADO AQUI
    }
  }, [isOpen, today, users]);

  const handleDueDateSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const monthsToAdd = parseInt(event.target.value, 10);
    if (isNaN(monthsToAdd)) return;

    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + monthsToAdd);
    setDueDate(futureDate.toISOString().split('T')[0]);
  };
  
  const handleSave = () => {
    let assignedUser: { uid: string; name: string };

    if (isFreeChoice) {
        if (!customName.trim()) {
            setError("Por favor, digite um nome para a designação.");
            return;
        }
        assignedUser = { uid: 'custom_' + Date.now(), name: customName.trim() };
    } else {
        const selectedUser = users.find(u => u.uid === selectedUid);
        if (!selectedUser) {
            setError("Por favor, selecione um publicador.");
            return;
        }
        assignedUser = { uid: selectedUser.uid, name: selectedUser.name };
    }
    
    if (!territory || !dueDate || !assignmentDate) {
        setError("Por favor, preencha todos os campos necessários.");
        return;
    }
    onSave(territory.id, assignedUser, assignmentDate, dueDate);
    onClose();
  };

  if (!isOpen || !territory) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 p-4">
      <div className="bg-card text-card-foreground p-6 rounded-lg shadow-xl w-full max-w-md relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground hover:text-white"><X /></button>
        <h2 className="text-xl font-bold">Designar Território</h2>
        
        <p className="text-muted-foreground text-sm mt-1 mb-4">
          Atribua o território <span className="font-semibold text-primary">{territory.number} - {territory.name}</span> a um publicador ou grupo.
        </p>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Designar para:</label>
            <select value={selectedUid} onChange={(e) => setSelectedUid(e.target.value)} className="w-full bg-input rounded-md p-2 border border-border">
              <option value="" disabled>Selecione um publicador...</option>
              {users.map(user => (
                <option key={user.uid} value={user.uid}>
                  {user.name}{user.status !== 'ativo' ? ` (${user.status})` : ''}
                </option>
              ))}
              <option value="free-choice" className="font-semibold text-primary">-- Digitar Outro Nome --</option>
            </select>
          </div>

          {isFreeChoice && (
              <div>
                  <label htmlFor="custom-name" className="block text-sm font-medium mb-1">Nome da Designação Livre:</label>
                  <input
                      id="custom-name"
                      type="text"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      placeholder="Ex: Campanha Especial, Grupo de Carro"
                      className="w-full bg-input rounded-md p-2 border border-border"
                  />
              </div>
          )}
          
          <div className="flex gap-4">
            <div className="w-1/2">
              <label className="block text-sm font-medium mb-1">Data de Designação:</label>
              <input type="date" value={assignmentDate} onChange={(e) => setAssignmentDate(e.target.value)} className="w-full bg-input rounded-md p-2 border border-border"/>
            </div>
            <div className="w-1/2">
              <label className="block text-sm font-medium mb-1">Data para Devolução:</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full bg-input rounded-md p-2 border border-border"/>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Definir Devolução Rápida:</label>
            <select 
              onChange={handleDueDateSelect} 
              className="w-full bg-input rounded-md p-2 border border-border text-muted-foreground"
              value=""
            >
              <option value="" disabled>Escolha um período...</option>
              <option value="1">Em 1 Mês</option>
              <option value="2">Em 2 Meses (Padrão)</option>
              <option value="3">Em 3 Meses</option>
              <option value="4">Em 4 Meses</option>
              <option value="5">Em 5 Meses</option>
              <option value="6">Em 6 Meses</option>
              <option value="7">Em 7 Meses</option>
              <option value="8">Em 8 Meses</option>
              <option value="9">Em 9 Meses</option>
              <option value="10">Em 10 Meses</option>
              <option value="11">Em 11 Meses</option>
              <option value="12">Em 1 Ano</option>
            </select>
          </div>

          {error && <p className="text-sm text-red-500 text-center">{error}</p>}

          <div className="flex justify-end space-x-3 pt-4 border-t border-border mt-4">
            <button onClick={onClose} className="px-4 py-2 rounded-md bg-muted hover:bg-muted/80">Cancelar</button>
            <button onClick={handleSave} className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/80">Salvar Designação</button>
          </div>
        </div>
      </div>
    </div>
  );
}
