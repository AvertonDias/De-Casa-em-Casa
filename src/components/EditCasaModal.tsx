"use client";

import { useState, useEffect } from 'react';
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

  useEffect(() => {
    if (isOpen) {
      setFormData(casa);
      setError('');
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
        <Dialog.Content className="fixed top-16 left-1/2 w-[90vw] max-w-md -translate-x-1/2 rounded-lg bg-white dark:bg-[#2f2b3a] p-6 shadow-lg focus:outline-none z-50 max-h-[85vh] overflow-y-auto md:top-1/2 md:-translate-y-1/2">
          
          <Dialog.Title className="text-gray-800 dark:text-white text-lg font-medium">
            Editar Número
          </Dialog.Title>
          
          <form onSubmit={handleUpdate} className="mt-4 space-y-4">
            <div>
              <label htmlFor="number" className="text-sm font-medium text-gray-600 dark:text-gray-400">Número</label>
              <input 
                id="number" 
                value={formData.number} 
                onChange={handleChange} 
                placeholder="Número" 
                className="w-full mt-1 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-white rounded px-3 py-2 border border-gray-300 dark:border-gray-700 uppercase" 
              />
            </div>
            <div>
              <label htmlFor="observations" className="text-sm font-medium text-gray-600 dark:text-gray-400">Observações</label>
              <textarea 
                id="observations" 
                value={formData.observations} 
                onChange={handleChange} 
                placeholder="Ex: Casa de esquina na Rua dos Pioneiros" 
                rows={3} 
                className="w-full mt-1 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-white rounded px-3 py-2 border border-gray-300 dark:border-gray-700"
              ></textarea>
            </div>
            
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            
            <div className="flex justify-between items-center mt-6">
              <button 
                type="button" 
                onClick={handleRequestDelete}
                disabled={isLoading}
                className="p-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50" 
                title="Excluir"
              >
                <Trash2 />
              </button>
              <div className="flex gap-4">
                <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white rounded hover:bg-gray-300 dark:hover:bg-gray-500">Cancelar</button>
                <button 
                  type="submit" 
                  disabled={isLoading} 
                  className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:bg-purple-800"
                >
                  {isLoading ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </form>
          
          <button onClick={onClose} className="absolute top-3 right-3 text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white">
            <X />
          </button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
