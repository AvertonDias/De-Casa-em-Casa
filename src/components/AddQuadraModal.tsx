"use client";

import { useState, useEffect, useRef } from "react";
import { X } from 'lucide-react';

interface AddQuadraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { name: string; description: string }) => Promise<void>;
  existingQuadrasCount: number; 
}

export default function AddQuadraModal({ isOpen, onSave, onClose, existingQuadrasCount }: AddQuadraModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const nextQuadraNumber = (existingQuadrasCount + 1).toString().padStart(2, '0');
      setName(`Quadra ${nextQuadraNumber}`);
      setDescription('');
      
      setTimeout(() => {
        nameInputRef.current?.focus();
        nameInputRef.current?.select();
      }, 100);
    }
  }, [isOpen, existingQuadrasCount]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setIsProcessing(true);
    try {
      await onSave({ name, description });
      onClose();
    } catch (error) {
      console.error("Erro ao salvar nova quadra:", error);
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleClose = () => {
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="relative bg-card text-card-foreground p-6 rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <button onClick={handleClose} disabled={isProcessing} className="absolute top-4 right-4 text-muted-foreground"><X /></button>
        <h2 className="text-xl font-bold">Adicionar Nova Quadra</h2>
        <p className="text-sm text-muted-foreground mb-4">Digite o nome ou identificador da quadra.</p>
        <div className="space-y-4">
          <div>
            <label htmlFor="quadra-name" className="block text-sm font-medium mb-1">Nome da Quadra</label>
            <input 
              id="quadra-name" 
              ref={nameInputRef}
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              className="w-full bg-input rounded-md p-2" 
            />
          </div>
          <div>
            <label htmlFor="quadra-desc" className="block text-sm font-medium mb-1">Observações (Opcional)</label>
            <textarea id="quadra-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full bg-input rounded-md p-2"></textarea>
          </div>
          <div className="flex justify-end space-x-3 pt-4">
            <button onClick={handleClose} disabled={isProcessing} className="px-4 py-2 rounded-md bg-muted hover:bg-muted/80">Cancelar</button>
            <button onClick={handleSave} disabled={isProcessing} className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/80">
              {isProcessing ? "Salvando..." : "Salvar Quadra"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
