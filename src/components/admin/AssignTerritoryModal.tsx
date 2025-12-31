"use client";

import { useState, useEffect } from "react";
import { Territory, AppUser, Congregation } from "@/types/types";
import { X, Search, ChevronsUpDown } from 'lucide-react';
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Input } from "../ui/input";
import { useUser } from "@/contexts/UserContext";

interface AssignTerritoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (territoryId: string, user: { uid: string; name: string }, assignmentDate: string, dueDate: string) => void;
  territory: Territory | null;
  users: AppUser[];
}

export default function AssignTerritoryModal({ isOpen, onClose, onSave, territory, users }: AssignTerritoryModalProps) {
  const { congregation } = useUser();
  const [selectedUid, setSelectedUid] = useState<string>('');
  const [customName, setCustomName] = useState('');
  const [assignmentDate, setAssignmentDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState('');
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  
  const isFreeChoice = selectedUid === 'free-choice';
  const defaultMonths = congregation?.defaultAssignmentMonths || 2;

  useEffect(() => {
    if (isOpen) {
      const newAssignmentDate = new Date();
      newAssignmentDate.setMinutes(newAssignmentDate.getMinutes() - newAssignmentDate.getTimezoneOffset());
      const newDueDate = new Date(newAssignmentDate);
      newDueDate.setMonth(newDueDate.getMonth() + defaultMonths);

      setAssignmentDate(newAssignmentDate.toISOString().split('T')[0]);
      setDueDate(newDueDate.toISOString().split('T')[0]);
      
      setSelectedUid('');
      setCustomName('');
      setError('');
      setUserSearchTerm(''); 
    }
  }, [isOpen, defaultMonths]);
  
  useEffect(() => {
    if (assignmentDate) {
      const baseDate = new Date(assignmentDate);
      baseDate.setMinutes(baseDate.getMinutes() + baseDate.getTimezoneOffset());
      if (!isNaN(baseDate.getTime())) {
          const newDueDate = new Date(baseDate);
          newDueDate.setMonth(newDueDate.getMonth() + defaultMonths);
          setDueDate(newDueDate.toISOString().split('T')[0]);
      }
    }
  }, [assignmentDate, defaultMonths]);


  const handleDueDateSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const monthsToAdd = parseInt(event.target.value, 10);
    if (isNaN(monthsToAdd) || !assignmentDate) return;

    const baseDate = new Date(assignmentDate);
    baseDate.setMinutes(baseDate.getMinutes() + baseDate.getTimezoneOffset());

    if (!isNaN(baseDate.getTime())) {
      const futureDate = new Date(baseDate);
      futureDate.setMonth(futureDate.getMonth() + monthsToAdd);
      setDueDate(futureDate.toISOString().split('T')[0]);
    }
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

  const filteredUsers = users.filter(user => 
    user.name.toLowerCase().includes(userSearchTerm.toLowerCase())
  );
  
  const handleSelectUser = (uid: string) => {
    setSelectedUid(uid);
    setIsPopoverOpen(false);
  }

  const getSelectedUserName = () => {
    if (isFreeChoice) return "Digitar Outro Nome...";
    const selectedUser = users.find(u => u.uid === selectedUid);
    return selectedUser?.name || "Selecione um publicador...";
  }

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
            <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={isPopoverOpen}
                  className="w-full justify-between bg-input border-border"
                >
                  <span className="truncate">{getSelectedUserName()}</span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] max-h-[--radix-popover-content-available-height] p-0">
                  <div className="p-2 border-b border-border">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18}/>
                      <Input
                        placeholder="Buscar publicador..."
                        value={userSearchTerm}
                        onChange={(e) => setUserSearchTerm(e.target.value)}
                        className="pl-9"
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="max-h-60 overflow-y-auto p-1">
                    <button onClick={() => handleSelectUser('free-choice')} className="w-full text-left p-2 rounded-md text-sm font-semibold text-primary hover:bg-accent">-- Digitar Outro Nome --</button>
                    {filteredUsers.map((user) => (
                      <button
                        key={user.uid}
                        onClick={() => handleSelectUser(user.uid)}
                        className="w-full text-left p-2 rounded-md text-sm hover:bg-accent"
                      >
                        {user.name}
                      </button>
                    ))}
                  </div>
              </PopoverContent>
            </Popover>
          </div>

          {isFreeChoice && (
              <div>
                  <label htmlFor="custom-name" className="block text-sm font-medium mb-1">Nome da Designação Livre:</label>
                  <Input
                      id="custom-name"
                      type="text"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      placeholder="Ex: Campanha Especial, Campo de Sábado"
                      className="w-full bg-input rounded-md p-2 border border-border focus:outline-none focus:ring-2 focus:ring-primary"
                  />
              </div>
          )}
          
          <div className="flex gap-4">
            <div className="w-1/2">
              <label className="block text-sm font-medium mb-1">Data de Designação:</label>
              <input type="date" value={assignmentDate} onChange={(e) => setAssignmentDate(e.target.value)} className="w-full bg-input rounded-md p-2 border border-border focus:outline-none focus:ring-2 focus:ring-primary"/>
            </div>
            <div className="w-1/2">
              <label className="block text-sm font-medium mb-1">Data para Devolução:</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full bg-input rounded-md p-2 border border-border focus:outline-none focus:ring-2 focus:ring-primary"/>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Definir Devolução Rápida:</label>
            <select 
              onChange={handleDueDateSelect} 
              className="w-full bg-input rounded-md p-2 border border-border text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              defaultValue={String(defaultMonths)}
            >
              {[...Array(12).keys()].map(i => (
                <option key={i + 1} value={i + 1}>Em {i + 1} {i + 1 > 1 ? 'meses' : 'mês'}</option>
              ))}
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
