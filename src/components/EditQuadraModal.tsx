"use client";

import { useState } from 'react';
import { Loader, Pencil, Trash2 } from 'lucide-react';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Textarea } from './ui/textarea';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose
} from '@/components/ui/dialog';
import { ConfirmationModal } from './ConfirmationModal';

interface Quadra { id: string; name: string; description?: string; }

interface EditQuadraModalProps {
  quadra: Quadra;
  territoryId: string;
  onQuadraUpdated: () => void;
  congregationId: string;
}

export function EditQuadraModal({ quadra, territoryId, onQuadraUpdated, congregationId }: EditQuadraModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState(quadra.name);
  const [description, setDescription] = useState(quadra.description || '');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  // Reset state on close
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setError('');
      setName(quadra.name);
      setDescription(quadra.description || '');
    }
    setIsOpen(open);
  }

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
      const quadraRef = doc(db, 'congregations', congregationId, 'territories', territoryId, 'quadras', quadra.id);
      await updateDoc(quadraRef, { name, description });
      setIsOpen(false);
      onQuadraUpdated();
    } catch (err) { 
      setError("Falha ao atualizar.");
      console.error(err);
    } 
    finally { setIsLoading(false); }
  };

  const handleDelete = async () => {
    if (!congregationId) {
      setError("ID da congregação não encontrado. Ação bloqueada.");
      return;
    }
    
    setIsLoading(true);
    try {
      const quadraRef = doc(db, 'congregations', congregationId, 'territories', territoryId, 'quadras', quadra.id);
      await deleteDoc(quadraRef);
      setIsConfirmOpen(false);
      setIsOpen(false);
      onQuadraUpdated();
    } catch (err) { 
      setError("Falha ao excluir."); 
      console.error(err);
    } 
    finally { setIsLoading(false); }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
           <Button
            size="sm"
            className="font-semibold text-purple-700 dark:text-purple-400 bg-gray-200 dark:bg-purple-900/50 hover:bg-gray-300 dark:hover:bg-purple-900/80"
          >
            Editar
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Editar Quadra</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdate} id="edit-quadra-form" className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name-edit">Nome da Quadra</Label>
              <Input id="name-edit" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description-edit">Observações</Label>
              <Textarea id="description-edit" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          </form>
          <DialogFooter className="justify-between sm:justify-between">
            <Button variant="destructive" onClick={() => setIsConfirmOpen(true)} disabled={isLoading}>
              <Trash2 className="mr-0 sm:mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Excluir</span>
            </Button>
            <div className="flex gap-2">
              <DialogClose asChild>
                <Button type="button" variant="secondary">Cancelar</Button>
              </DialogClose>
              <Button type="submit" form="edit-quadra-form" disabled={isLoading}>
                {isLoading ? <><Loader className="animate-spin mr-2" /> Salvando...</> : 'Salvar'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmationModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleDelete}
        isLoading={isLoading}
        title="Excluir Quadra?"
        message={`Tem certeza que deseja EXCLUIR a quadra "${quadra.name}"? Todas as casas e dados associados a ela serão perdidos permanentemente. Esta ação não pode ser desfeita.`}
        confirmText="Sim, excluir"
        cancelText="Cancelar"
      />
    </>
  );
}
