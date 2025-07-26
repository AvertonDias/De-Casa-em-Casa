"use client";

import { useState, useEffect } from "react";
import { useUser } from "@/contexts/UserContext"; 
import { Quadra } from "@/types/types";
import { X } from 'lucide-react';

interface EditQuadraModalProps {
  quadra: Quadra | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (quadraId: string, updatedData: { name: string; description: string }) => void;
  onDelete: (quadraId: string) => void;
}

export const EditQuadraModal = ({ quadra, isOpen, onClose, onSave, onDelete }: EditQuadraModalProps) => {
  const { user } = useUser();
  const isAdmin = user?.role === 'Administrador';
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (quadra && isOpen) {
      setName(quadra.name || '');
      setDescription(quadra.description || '');
    }
  }, [quadra, isOpen]);

  const handleSave = () => {
    if (!quadra || !name.trim()) return;
    onSave(quadra.id, { name, description });
    onClose();
  };

  const handleDeleteClick = () => {
    if (!quadra) return;
    onDelete(quadra.id);
  };

  if (!isOpen || !quadra) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="relative bg-card text-card-foreground p-6 rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground hover:text-white"><X /></button>
        <h2 className="text-xl font-bold">Editar Quadra</h2>
        <p className="text-sm text-muted-foreground mb-4">Altere o nome e a descrição desta quadra.</p>
        
        <div className="space-y-4">
          <div>
            <label htmlFor="quadra-name" className="block text-sm font-medium mb-1">Nome da Quadra</label>
            <input id="quadra-name" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-input rounded-md p-2" />
          </div>
          <div>
            <label htmlFor="quadra-desc" className="block text-sm font-medium mb-1">Descrição</label>
            <textarea id="quadra-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full bg-input rounded-md p-2"></textarea>
          </div>
        </div>

        <div className="flex justify-between items-center pt-6 mt-6 border-t border-border">
            {isAdmin ? (
                <button onClick={handleDeleteClick} className="px-4 py-2 bg-red-600/10 text-red-500 border border-red-500/50 rounded-md hover:bg-red-500/20 font-semibold text-sm">
                    Excluir
                </button>
            ) : (
                <div /> 
            )}
            
            <div className="flex space-x-3">
                <button onClick={onClose} className="px-4 py-2 rounded-md bg-muted hover:bg-muted/80">Cancelar</button>
                <button onClick={handleSave} className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/80">Salvar Alterações</button>
            </div>
        </div>
      </div>
    </div>
  );
}
