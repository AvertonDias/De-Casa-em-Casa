"use client";

import { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Landmark, X } from 'lucide-react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useUser } from '@/contexts/UserContext';

export function EditCongregationModal() {
  const { user } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  
  const [congregationName, setCongregationName] = useState('');
  const [congregationNumber, setCongregationNumber] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (isOpen) {
        setError(''); 
        setSuccess('');
        
        if (user?.congregationId) {
            const congRef = doc(db, 'congregations', user.congregationId);
            getDoc(congRef).then(snap => {
                if(snap.exists()){
                  setCongregationName(snap.data().name || '');
                  setCongregationNumber(snap.data().number || '');
                }
            });
        }
    }
  }, [user, isOpen]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(''); setSuccess('');

    if (!user || !user.congregationId) {
        setError("Congregação não encontrada.");
        setIsLoading(false);
        return;
    }

    try {
      if(user.role === 'Administrador') {
        const congRef = doc(db, "congregations", user.congregationId);
        await updateDoc(congRef, { name: congregationName, number: congregationNumber });
      } else {
        throw new Error("Você não tem permissão para editar a congregação.");
      }
      
      setSuccess("Congregação atualizada com sucesso!");
      setTimeout(() => setIsOpen(false), 2000);

    } catch (err: any) {
      setError(err.message || "Falha ao salvar as configurações.");
    } finally { 
        setIsLoading(false); 
    }
  };

  const inputClasses = "w-full mt-1 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-white rounded px-3 py-2 border border-gray-300 dark:border-gray-700";

  return (
    <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
      <Dialog.Trigger asChild>
        <button className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center">
          <Landmark className="h-4 w-4 mr-2" /> Editar Congregação
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="bg-black/60 fixed inset-0" />
        <Dialog.Content className="fixed top-1/2 left-1/2 w-[90vw] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white dark:bg-[#2f2b3a] p-6 shadow-lg focus:outline-none max-h-[90vh] overflow-y-auto">
          <Dialog.Title className="text-lg font-medium text-gray-800 dark:text-white">Editar Congregação</Dialog.Title>
          <Dialog.Description className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Edite o nome e o número da sua congregação.
          </Dialog.Description>
          <form onSubmit={handleUpdate} className="mt-4 space-y-6">
            
            <fieldset className="border border-gray-200 dark:border-gray-700 p-4 rounded-lg">
              <legend className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-2 px-2 flex items-center"><Landmark className="mr-2 h-5 w-5 text-purple-500"/>Dados da Congregação</legend>
              <div className="space-y-4">
                <input value={congregationName} onChange={e => setCongregationName(e.target.value)} placeholder="Nome da Congregação" className={inputClasses} />
                <input value={congregationNumber} onChange={e => setCongregationNumber(e.target.value)} placeholder="Número" className={inputClasses} />
              </div>
            </fieldset>

            {error && <p className="text-sm text-center text-red-500">{error}</p>}
            {success && <p className="text-sm text-center text-green-500">{success}</p>}
            
            <div className="flex justify-end gap-4 mt-8 pt-4 border-t border-gray-200 dark:border-gray-700">
                <Dialog.Close asChild>
                    <button type="button" className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white rounded hover:bg-gray-300 dark:hover:bg-gray-500">Cancelar</button>
                </Dialog.Close>
                <button type="submit" disabled={isLoading} className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:bg-purple-800">
                    {isLoading ? "Salvando..." : "Salvar Alterações"}
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
