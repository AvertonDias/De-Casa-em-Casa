"use client";

import { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Pencil, X, Trash2, ShieldAlert } from 'lucide-react';
import { doc, updateDoc, deleteDoc, collection, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useUser } from '@/contexts/UserContext';

interface Territory {
  id: string;
  number: string;
  name: string;
  description?: string;
  mapLink?: string;
  cardUrl?: string;
}

interface EditTerritoryModalProps {
  territory: Territory;
  onTerritoryUpdated: () => void;
}

export function EditTerritoryModal({ territory, onTerritoryUpdated }: EditTerritoryModalProps) {
  const { user } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState(territory);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFormData(territory);
    }
  }, [territory, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.id]: e.target.value }));
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!user?.congregationId) {
      setError("ID da congregação não encontrado. Não é possível salvar.");
      return;
    }

    setIsLoading(true);
    setError('');

    const dataToUpdate = {
      number: formData.number,
      name: formData.name,
      description: formData.description || '',
      mapLink: formData.mapLink || '',
      cardUrl: formData.cardUrl || '',
    };

    try {
      const territoryRef = doc(db, 'congregations', user.congregationId, 'territories', territory.id);
      await updateDoc(territoryRef, dataToUpdate);
      setIsOpen(false);
      onTerritoryUpdated();
    } catch (err) {
      console.error("Erro ao atualizar território:", err);
      setError("Falha ao atualizar.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearTerritory = async () => {
    if (!user?.congregationId) {
        setError("ID da congregação não encontrado. Ação cancelada.");
        alert("ID da congregação não encontrado. Ação cancelada.");
        return;
    }
    if (!window.confirm(`Tem certeza que deseja LIMPAR o território "${territory.name}"? Todas as casas serão marcadas como "não feitas".`)) {
      return; 
    }
    
    setIsLoading(true);
    setError('');
    try {
      const territoryRef = doc(db, 'congregations', user.congregationId, 'territories', territory.id);
      const quadrasSnapshot = await getDocs(collection(territoryRef, 'quadras'));
      const batch = writeBatch(db);
      let updatesFound = false;

      for (const quadraDoc of quadrasSnapshot.docs) {
        const casasSnapshot = await getDocs(collection(quadraDoc.ref, 'casas'));
        if (!casasSnapshot.empty) {
          updatesFound = true;
          casasSnapshot.forEach(casaDoc => batch.update(casaDoc.ref, { status: false }));
        }
      }
      
      if (updatesFound) {
        await batch.commit();
        alert("Território limpo com sucesso!");
      } else {
        alert("Nenhuma casa encontrada para limpar neste território.");
      }
      
      setIsOpen(false);
      onTerritoryUpdated();
    } catch (err) {
      console.error("Erro ao limpar território:", err);
      setError("Falha ao limpar o território.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!user?.congregationId) {
        setError("ID da congregação não encontrado. Ação cancelada.");
        alert("ID da congregação não encontrado. Ação cancelada.");
        return;
    }
    if (!window.confirm(`Tem certeza que deseja EXCLUIR o território "${territory.name}"? Esta ação é permanente e não pode ser desfeita.`)) {
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const territoryRef = doc(db, 'congregations', user.congregationId, 'territories', territory.id);
      await deleteDoc(territoryRef);
      setIsOpen(false);
      onTerritoryUpdated();
    } catch (err) {
      console.error("Erro ao excluir território:", err);
      setError("Falha ao excluir o território.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
      <Dialog.Trigger asChild>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(true);
          }} 
          className="flex items-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg"
        >
          <Pencil className="h-4 w-4 mr-2" /> Editar Território
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="bg-black/60 fixed inset-0" />
        <Dialog.Content 
            onPointerDownOutside={(e) => e.preventDefault()}
            onClick={(e) => e.stopPropagation()}
            className="fixed top-1/2 left-1/2 max-h-[90vh] overflow-y-auto w-[90vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white dark:bg-[#2f2b3a] p-6 shadow-lg focus:outline-none"
        >
          <Dialog.Title className="text-gray-800 dark:text-white text-lg font-medium">Editar Território</Dialog.Title>
          <form onSubmit={handleUpdate} className="mt-4 space-y-4">
            <div className="flex space-x-4">
              <div className="flex-1">
                <label htmlFor="number" className="text-sm font-medium text-gray-600 dark:text-gray-400">Número</label>
                <input id="number" value={formData.number} onChange={handleChange} className="w-full mt-1 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-white rounded px-3 py-2 border border-gray-300 dark:border-gray-700" />
              </div>
              <div className="flex-grow">
                <label htmlFor="name" className="text-sm font-medium text-gray-600 dark:text-gray-400">Nome do Território</label>
                <input id="name" value={formData.name} onChange={handleChange} className="w-full mt-1 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-white rounded px-3 py-2 border border-gray-300 dark:border-gray-700" />
              </div>
            </div>
            <div>
              <label htmlFor="description" className="text-sm font-medium text-gray-600 dark:text-gray-400">Descrição</label>
              <textarea id="description" value={formData.description || ''} onChange={handleChange} rows={3} className="w-full mt-1 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-white rounded px-3 py-2 border border-gray-300 dark:border-gray-700" />
            </div>
            <div>
              <label htmlFor="mapLink" className="text-sm font-medium text-gray-600 dark:text-gray-400">Link do Mapa</label>
              <input id="mapLink" value={formData.mapLink || ''} onChange={handleChange} className="w-full mt-1 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-white rounded px-3 py-2 border border-gray-300 dark:border-gray-700" />
            </div>
            <div>
              <label htmlFor="cardUrl" className="text-sm font-medium text-gray-600 dark:text-gray-400">URL do Cartão</label>
              <input id="cardUrl" value={formData.cardUrl || ''} onChange={handleChange} className="w-full mt-1 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-white rounded px-3 py-2 border border-gray-300 dark:border-gray-700" />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <div className="flex justify-end mt-6">
              <button type="submit" disabled={isLoading} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">
                {isLoading ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </form>
          <div className="mt-6 border-t border-gray-200 dark:border-red-500/30 pt-4">
             <h3 className="text-md font-semibold text-red-600 dark:text-red-300 flex items-center"><ShieldAlert className="mr-2" />Ações de Risco</h3>
             <div className="flex gap-4 mt-2">
               <button onClick={handleClearTerritory} disabled={isLoading} className="flex-1 text-sm bg-yellow-100 text-yellow-800 dark:bg-yellow-800/50 dark:text-yellow-200 hover:bg-yellow-200 dark:hover:bg-yellow-700/50 p-2 rounded disabled:opacity-50">Limpar Território</button>
               <button onClick={handleDelete} disabled={isLoading} className="flex-1 text-sm bg-red-100 text-red-800 dark:bg-red-800/50 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-700/50 p-2 rounded disabled:opacity-50">Excluir Território</button>
             </div>
          </div>
          <Dialog.Close asChild><button className="absolute top-3 right-3 text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white"><X /></button></Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
