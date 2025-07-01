"use client";

import { useState, useEffect } from 'react';
import { Pencil, AlertTriangle, Loader } from 'lucide-react';
import { doc, updateDoc, deleteDoc, collection, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useUser } from '@/contexts/UserContext';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

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
  congregationId: string;
}

export function EditTerritoryModal({ territory, onTerritoryUpdated, congregationId }: EditTerritoryModalProps) {
  const { user } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState(territory);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [actionToConfirm, setActionToConfirm] = useState<'clean' | 'delete' | null>(null);

  useEffect(() => {
    if (isOpen) {
      setFormData(territory);
      setError(null);
    }
  }, [territory, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.id]: e.target.value }));
  };
  
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setLoading(true);
    setError('');

    if (!congregationId) {
      setError("ID da congregação não encontrado. Ação bloqueada.");
      setLoading(false);
      return;
    }

    const dataToUpdate = {
      number: formData.number,
      name: formData.name,
      description: formData.description || '',
      mapLink: formData.mapLink || '',
      cardUrl: formData.cardUrl || '',
    };

    try {
      const territoryRef = doc(db, 'congregations', congregationId, 'territories', territory.id);
      await updateDoc(territoryRef, dataToUpdate);
      setIsOpen(false);
      onTerritoryUpdated();
    } catch (err) {
      console.error("Erro ao atualizar território:", err);
      setError("Falha ao atualizar.");
    } finally {
      setLoading(false);
    }
  };
  
  const triggerConfirmation = (e: React.MouseEvent, action: 'clean' | 'delete') => {
    e.stopPropagation();
    setActionToConfirm(action);
    setIsConfirmOpen(true);
  };
  
  const handleConfirmAction = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!territory || !user?.congregationId) return;

    setLoading(true);
    setError('');

    try {
      const territoryRef = doc(db, 'congregations', user.congregationId, 'territories', territory.id);

      if (actionToConfirm === 'clean') {
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
        }
      } else if (actionToConfirm === 'delete') {
        await deleteDoc(territoryRef);
      }
      onTerritoryUpdated(); 
      setIsConfirmOpen(false);
      setIsOpen(false);
    } catch (err) {
      console.error(`Erro ao ${actionToConfirm} território:`, err);
      setError(`Não foi possível ${actionToConfirm === 'clean' ? 'limpar' : 'excluir'} o território.`);
    } finally {
      setLoading(false);
      setActionToConfirm(null);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => { if (!open) setError(null); setIsOpen(open); }}>
        <DialogTrigger asChild>
          <Button 
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(true);
            }} 
            className="flex items-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg"
          >
            <Pencil className="h-4 w-4 mr-2" /> Editar Território
          </Button>
        </DialogTrigger>
        <DialogContent onClick={(e) => e.stopPropagation()} className="sm:max-w-md bg-card">
          <DialogHeader>
            <DialogTitle>Editar Território</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdate} id="edit-territory-form" className="space-y-4">
            <div className="flex space-x-4">
              <div className="flex-1">
                <Label htmlFor="number" className="text-sm font-medium">Número</Label>
                <Input id="number" value={formData.number} onChange={handleChange} className="w-full mt-1" />
              </div>
              <div className="flex-grow">
                <Label htmlFor="name" className="text-sm font-medium">Nome</Label>
                <Input id="name" value={formData.name} onChange={handleChange} className="w-full mt-1" />
              </div>
            </div>
            <div>
              <Label htmlFor="description" className="text-sm font-medium">Descrição</Label>
              <Textarea id="description" value={formData.description || ''} onChange={handleChange} rows={3} className="w-full mt-1" />
            </div>
            <div>
              <Label htmlFor="mapLink" className="text-sm font-medium">Link do Mapa</Label>
              <Input id="mapLink" value={formData.mapLink || ''} onChange={handleChange} className="w-full mt-1" />
            </div>
            <div>
              <Label htmlFor="cardUrl" className="text-sm font-medium">URL do Cartão</Label>
              <Input id="cardUrl" value={formData.cardUrl || ''} onChange={handleChange} className="w-full mt-1" />
            </div>
          </form>
          
          {user?.role === 'Administrador' && (
            <div className="mt-6 pt-4 border-t border-destructive/20">
              <h4 className="flex items-center text-md font-semibold text-destructive">
                <AlertTriangle size={18} className="mr-2"/> Ações de Risco
              </h4>
              <div className="flex space-x-2 mt-2">
                <Button type="button" variant="outline" onClick={(e) => triggerConfirmation(e, 'clean')} disabled={loading} className="flex-1 border-yellow-500 text-yellow-500 hover:bg-yellow-500/10 hover:text-yellow-600">
                  Limpar Território
                </Button>
                <Button type="button" variant="destructive" onClick={(e) => triggerConfirmation(e, 'delete')} disabled={loading} className="flex-1">
                  {loading && actionToConfirm === 'delete' ? <Loader className="mx-auto animate-spin"/> : 'Excluir Território'}
                </Button>
              </div>
              {error && <p className="text-red-500 text-sm text-center mt-2">{error}</p>}
            </div>
          )}
          <DialogFooter>
             <DialogClose asChild>
                <Button type="button" variant="secondary">Cancelar</Button>
              </DialogClose>
              <Button type="submit" form="edit-territory-form" disabled={loading && !actionToConfirm}>
                {loading && !actionToConfirm ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionToConfirm === 'clean' ? "Limpar Território?" : "Excluir Território?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionToConfirm === 'clean'
                ? "Esta ação irá marcar todas as casas deste território como 'não trabalhadas', reiniciando o progresso. Deseja continuar?"
                : "Esta ação é irreversível e irá apagar permanentemente este território, incluindo todas as suas quadras e casas. Você tem certeza absoluta?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmAction}
              disabled={loading}
              className={cn(actionToConfirm === 'delete' && buttonVariants({ variant: 'destructive' }))}
            >
              {loading ? "Processando..." : (actionToConfirm === 'clean' ? "Sim, Limpar" : "Sim, Excluir")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
