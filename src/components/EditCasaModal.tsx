"use client";

import { useState, useEffect, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Trash2 } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Casa } from '@/types/types';

interface EditCasaModalProps {
  isOpen: boolean;
  onClose: () => void;
  casa: Casa;
  territoryId: string;
  quadraId: string;
  onCasaUpdated: () => void;
  congregationId: string;
  onDeleteRequest: (house: Casa) => void;
}

export function EditCasaModal({ isOpen, onClose, casa, territoryId, quadraId, onCasaUpdated, congregationId, onDeleteRequest }: EditCasaModalProps) {
  const [formData, setFormData] = useState(casa);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const numberInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setFormData(casa);
      setError('');
      setTimeout(() => {
        numberInputRef.current?.focus();
        numberInputRef.current?.select();
      }, 100);
    }
  }, [isOpen, casa]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };
  
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (!congregationId) {
      setError("ID da congregação não encontrado. Ação bloqueada.");
      setIsLoading(false);
      return;
    }

    try {
      const casaRef = doc(db, 'congregations', congregationId, 'territories', territoryId, 'quadras', quadraId, 'casas', casa.id);
      await updateDoc(casaRef, {
        number: formData.number.toUpperCase(),
        observations: formData.observations,
      });

      onClose();
      onCasaUpdated();
    } catch (err) {
      setError("Falha ao atualizar.");
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleRequestDelete = () => {
    if (!casa) return;
    onDeleteRequest(casa);
    onClose();
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="bg-black/60 fixed inset-0 z-50" />
        <Dialog.Content 
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div className="relative w-full max-w-md rounded-lg bg-card p-6 shadow-lg max-h-[90vh] overflow-y-auto">
            <Dialog.Title className="text-lg font-medium text-card-foreground">
              Editar Número
            </Dialog.Title>
            <Dialog.Description className="text-sm text-muted-foreground mt-2">
              Altere o número ou as observações deste item.
            </Dialog.Description>
            
            <form onSubmit={handleUpdate} className="mt-4 space-y-4">
              <div>
                <label htmlFor="number" className="text-sm font-medium text-muted-foreground">Número</label>
                <input 
                  id="number" 
                  ref={numberInputRef}
                  value={formData.number} 
                  onChange={handleChange} 
                  placeholder="Número" 
                  className="w-full mt-1 bg-input text-foreground rounded px-3 py-2 border border-border uppercase focus:outline-none focus:ring-2 focus:ring-primary" 
                />
              </div>
              <div>
                <label htmlFor="observations" className="text-sm font-medium text-muted-foreground">Observações</label>
                <textarea 
                  id="observations" 
                  value={formData.observations} 
                  onChange={handleChange} 
                  placeholder="Ex: Casa de esquina na Rua dos Pioneiros" 
                  rows={3} 
                  className="w-full mt-1 bg-input text-foreground rounded px-3 py-2 border border-border focus:outline-none focus:ring-2 focus:ring-primary"
                ></textarea>
              </div>
              
              {error && <p className="text-destructive text-sm text-center">{error}</p>}
              
              <div className="flex justify-between items-center mt-6">
                <button 
                  type="button" 
                  onClick={handleRequestDelete}
                  disabled={isLoading}
                  className="p-2 text-red-500 hover:text-red-400 disabled:opacity-50" 
                  title="Excluir"
                >
                  <Trash2 />
                </button>
                <div className="flex gap-4">
                  <button type="button" onClick={onClose} className="px-4 py-2 bg-secondary text-secondary-foreground rounded hover:bg-secondary/80">Cancelar</button>
                  <button 
                    type="submit" 
                    disabled={isLoading} 
                    className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
                  >
                    {isLoading ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </div>
            </form>
            
            <button onClick={onClose} className="absolute top-3 right-3 text-muted-foreground hover:text-foreground">
              <X />
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
