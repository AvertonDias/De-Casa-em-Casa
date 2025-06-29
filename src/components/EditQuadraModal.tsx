"use client";

import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Pencil, X, Trash2 } from 'lucide-react';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Textarea } from './ui/textarea';
import { useUser } from '@/contexts/UserContext';

interface Quadra { id: string; name: string; description?: string; }

interface EditQuadraModalProps {
  quadra: Quadra;
  territoryId: string;
  onQuadraUpdated: () => void;
}

export function EditQuadraModal({ quadra, territoryId, onQuadraUpdated }: EditQuadraModalProps) {
  const { user } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState(quadra.name);
  const [description, setDescription] = useState(quadra.description || '');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.congregationId) {
        setError("ID da congregação não encontrado.");
        return;
    }
    setIsLoading(true);
    try {
      const quadraRef = doc(db, 'congregations', user.congregationId, 'territories', territoryId, 'quadras', quadra.id);
      await updateDoc(quadraRef, { name, description });
      setIsOpen(false);
      onQuadraUpdated();
    } catch (err) { setError("Falha ao atualizar."); } 
    finally { setIsLoading(false); }
  };

  const handleDelete = async () => {
    if (!user?.congregationId) {
        setError("ID da congregação não encontrado.");
        return;
    }
    if (!window.confirm(`Tem certeza que deseja EXCLUIR a quadra "${quadra.name}"? Todas as casas dentro dela serão perdidas.`)) return;
    setIsLoading(true);
    try {
      const quadraRef = doc(db, 'congregations', user.congregationId, 'territories', territoryId, 'quadras', quadra.id);
      await deleteDoc(quadraRef);
      setIsOpen(false);
      onQuadraUpdated();
    } catch (err) { setError("Falha ao excluir."); } 
    finally { setIsLoading(false); }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
      <Dialog.Trigger asChild>
        <button className="font-semibold text-purple-700 dark:text-purple-400 bg-gray-200 dark:bg-purple-900/50 px-3 py-1 rounded-md text-sm hover:bg-gray-300 dark:hover:bg-purple-900/80">
          Editar
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="bg-black/60 fixed inset-0" />
        <Dialog.Content className="fixed top-1/2 left-1/2 w-[90vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-[#2f2b3a] p-6 shadow-lg">
          <Dialog.Title className="text-white text-lg font-medium">Editar Quadra</Dialog.Title>
          <form onSubmit={handleUpdate} className="mt-4 space-y-4">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome da Quadra" className="w-full bg-gray-800 text-white rounded px-3 py-2" />
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição da quadra (opcional)" rows={3} className="w-full bg-gray-800 text-white rounded px-3 py-2" />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <div className="flex justify-between items-center mt-6">
              <button type="button" onClick={handleDelete} className="p-2 text-red-400 hover:text-red-200" title="Excluir"><Trash2 /></button>
              <button type="submit" disabled={isLoading} className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700">Salvar</button>
            </div>
          </form>
          <Dialog.Close asChild><button className="absolute top-3 right-3 text-gray-400 hover:text-white"><X /></button></Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
