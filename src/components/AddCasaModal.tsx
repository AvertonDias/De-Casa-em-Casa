
"use client";

import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Plus, X } from 'lucide-react';
import { addDoc, collection, serverTimestamp, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface AddCasaModalProps {
  territoryId: string;
  quadraId: string;
  onCasaAdded: () => void;
  congregationId: string;
}

export function AddCasaModal({ territoryId, quadraId, onCasaAdded, congregationId }: AddCasaModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [number, setNumber] = useState('');
  const [observations, setObservations] = useState('');
  const [status, setStatus] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    if (!congregationId) {
      setError("ID da congregação não encontrado. Ação bloqueada.");
      setIsLoading(false);
      return;
    }

    if (!number) {
        setError('O número da casa é obrigatório.');
        setIsLoading(false);
        return;
    }

    try {
      const casasRef = collection(db, 'congregations', congregationId, 'territories', territoryId, 'quadras', quadraId, 'casas');
      
      const snapshot = await getDocs(casasRef);
      const order = snapshot.size;

      await addDoc(casasRef, { 
        number: number.toUpperCase(), // Garante que o dado salvo seja sempre maiúsculo
        observations, 
        status, 
        createdAt: serverTimestamp(),
        order
      });

      setIsOpen(false);
      onCasaAdded();

    } catch (err) {
      console.error("Erro ao adicionar casa:", err);
      setError("Falha ao adicionar casa.");
    } finally {
        setIsLoading(false);
    }
  };

  const onOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      // Limpa os estados ao abrir o modal
      setNumber('');
      setObservations('');
      setStatus(false);
      setError('');
      setIsLoading(false);
    }
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={onOpenChange}>
      <Dialog.Trigger asChild>
        <button className="flex items-center justify-center bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-colors text-sm">
          <Plus className="h-5 w-5 mr-2" />
          Adicionar Número
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="bg-black/60 fixed inset-0" />
        <Dialog.Content className="fixed top-16 left-1/2 w-[90vw] max-w-md -translate-x-1/2 rounded-lg bg-white dark:bg-[#2f2b3a] p-6 shadow-lg focus:outline-none max-h-[85vh] overflow-y-auto md:top-1/2 md:-translate-y-1/2">
          
          <Dialog.Title className="text-gray-800 dark:text-white text-lg font-medium">
            Adicionar Item
          </Dialog.Title>
          
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label htmlFor="house-number" className="text-sm font-medium text-gray-600 dark:text-gray-400">Número (Necessário)</label>
              <input 
                id="house-number" 
                value={number} 
                onChange={(e) => setNumber(e.target.value)} 
                required 
                placeholder="Ex: 2414 ou 100A"
                className="w-full mt-1 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-white rounded px-3 py-2 border border-gray-300 dark:border-gray-700 uppercase focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label htmlFor="observacoes" className="text-sm font-medium text-gray-600 dark:text-gray-400">Observações</label>
              <textarea 
                id="observacoes" 
                value={observations} 
                onChange={(e) => setObservations(e.target.value)} 
                rows={3} 
                className="w-full mt-1 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-white rounded px-3 py-2 border border-gray-300 dark:border-gray-700" 
                placeholder="Ex: Casa de esquina na Rua dos Pioneiros"
              ></textarea>
            </div>
            <div className="flex items-center justify-between pt-2">
              <label htmlFor="feito" className="font-medium text-gray-800 dark:text-white">Feito</label>
              <button 
                type="button" 
                onClick={() => setStatus(!status)} 
                className={`${status ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'} relative inline-flex h-6 w-11 items-center rounded-full transition-colors`}
              >
                <span className={`${status ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
              </button>
            </div>
            
            {error && <p className="text-red-500 text-sm">{error}</p>}
            
            <div className="flex justify-end gap-4 mt-6">
              <Dialog.Close asChild>
                <button type="button" className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white rounded hover:bg-gray-300 dark:hover:bg-gray-500">Cancelar</button>
              </Dialog.Close>
              <button type="submit" disabled={isLoading} className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:bg-purple-800">
                {isLoading ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </form>
          
          <Dialog.Close asChild>
            <button className="absolute top-3 right-3 text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white">
              <X />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
