"use client";

import { useState, useEffect } from 'react';
import { doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useUser } from '@/contexts/UserContext';
import { cn } from '@/lib/utils';
import { Trash2, Edit, Loader } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { RuralTerritory } from '@/types/types';

interface EditRuralTerritoryModalProps {
  onTerritoryUpdated: () => void;
  congregationId: string;
  territory: RuralTerritory; 
}

export function EditRuralTerritoryModal({ onTerritoryUpdated, congregationId, territory }: EditRuralTerritoryModalProps) {
  const { user } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [formData, setFormData] = useState({
    number: '',
    name: '',
    description: '',
    mapLink: '',
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && territory) {
      setFormData({
        number: territory.number || '',
        name: territory.name || '',
        description: territory.description || '',
        mapLink: territory.mapLink || '',
      });
      setError('');
    }
  }, [territory, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!territory) return;
    
    setIsLoading(true);
    setError('');

    try {
      const territoryRef = doc(db, 'congregations', congregationId, 'territories', territory.id);
      await updateDoc(territoryRef, {
        ...formData,
        lastUpdate: serverTimestamp(),
      });
      
      onTerritoryUpdated();
      setIsOpen(false);

    } catch (err) {
      console.error("Erro ao atualizar território rural:", err);
      setError('Ocorreu um erro ao salvar. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleDelete = async () => {
    if (!user || user.role !== 'Administrador' || !territory) {
      setError("Ação não permitida.");
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const territoryRef = doc(db, 'congregations', congregationId, 'territories', territory.id);
      await deleteDoc(territoryRef);
      onTerritoryUpdated();
      setIsConfirmOpen(false);
      setIsOpen(false);
    } catch (err) {
      console.error("Erro ao excluir território rural:", err);
      setError("Falha ao excluir o território.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <button className="flex items-center px-3 py-1 text-sm font-semibold text-blue-500 bg-blue-500/10 rounded-md hover:bg-blue-500/20"><Edit size={14} className="mr-1"/> Editar</button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Território Rural</DialogTitle>
            <DialogDescription>
              Faça alterações nos dados do território.
            </DialogDescription>
          </DialogHeader>
          <form id="edit-rural-form" onSubmit={handleSubmit} className="space-y-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="number">Número</Label>
                <Input id="number" value={formData.number} onChange={(e) => setFormData({...formData, number: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input id="name" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Observações</Label>
              <Textarea id="description" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mapLink">Link do Mapa</Label>
              <Input id="mapLink" type="url" value={formData.mapLink} onChange={(e) => setFormData({...formData, mapLink: e.target.value})} />
            </div>
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          </form>
          <DialogFooter className="justify-between sm:justify-between">
            {user?.role === 'Administrador' ? (
              <Button variant="destructive" onClick={() => setIsConfirmOpen(true)} disabled={isLoading}>
                <Trash2 className="mr-2 h-4 w-4" /> Excluir
              </Button>
            ) : <div />}
            <div className="flex gap-2">
              <DialogClose asChild>
                <Button type="button" variant="secondary">Cancelar</Button>
              </DialogClose>
              <Button type="submit" form="edit-rural-form" disabled={isLoading}>
                {isLoading ? <><Loader className="animate-spin mr-2" /> Salvando...</> : 'Salvar Alterações'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Território Rural?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o território "{territory.name}"? Esta ação é permanente e não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete} 
              disabled={isLoading}
              className={cn(buttonVariants({ variant: "destructive" }))}
            >
              {isLoading ? "Excluindo..." : "Sim, excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
