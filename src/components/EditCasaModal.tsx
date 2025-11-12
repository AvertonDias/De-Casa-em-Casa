

"use client";

import { useState, useEffect, useRef } from 'react';
import { doc, updateDoc, runTransaction } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Casa } from '@/types/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Trash2, Loader } from 'lucide-react';


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
    runTransaction(db, async (transaction) => {
      const congRef = doc(db, 'congregations', congregationId);
      const congDoc = await transaction.get(congRef);
      if (!congDoc.exists()) {
        throw "Documento da congregação não encontrado!";
      }
      const newTotalHouses = (congDoc.data().totalHouses || 0) - 1;
      const newTotalHousesDone = casa.status ? (congDoc.data().totalHousesDone || 0) - 1 : (congDoc.data().totalHousesDone || 0);

      transaction.update(congRef, { totalHouses: newTotalHouses, totalHousesDone: newTotalHousesDone });
    }).then(() => {
        onDeleteRequest(casa);
        onClose();
    }).catch((error) => {
        console.error("Erro na transação de exclusão:", error);
    });
  };

  const hasChanges = casa && (formData.number !== casa.number || formData.observations !== (casa.observations || ''));
  
  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle>Editar Item</DialogTitle>
              <DialogDescription>
                Altere o número ou as observações deste item.
              </DialogDescription>
            </DialogHeader>
            
            <form id="edit-casa-form" onSubmit={handleUpdate} className="mt-4 space-y-4">
                <div>
                  <label htmlFor="number" className="text-sm font-medium text-muted-foreground">Número</label>
                  <Input 
                      id="number" 
                      ref={numberInputRef}
                      value={formData.number} 
                      onChange={handleChange} 
                      placeholder="Número" 
                      className="mt-1 uppercase"
                  />
                </div>
                <div>
                  <label htmlFor="observations" className="text-sm font-medium text-muted-foreground">Observações</label>
                  <Textarea 
                      id="observations" 
                      value={formData.observations} 
                      onChange={handleChange} 
                      placeholder="Ex: Casa de esquina na Rua dos Pioneiros" 
                      rows={3} 
                      className="w-full mt-1"
                  />
                </div>
                
                {error && <p className="text-destructive text-sm">{error}</p>}
                
            </form>
            <DialogFooter className="justify-between sm:justify-between pt-4 border-t">
                <Button 
                    type="button" 
                    variant="destructive"
                    onClick={handleRequestDelete}
                    disabled={isLoading}
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Excluir
                </Button>
                <div className="flex gap-2">
                    <DialogClose asChild>
                        <Button type="button" variant="secondary">Cancelar</Button>
                    </DialogClose>
                    <Button type="submit" form="edit-casa-form" disabled={isLoading || !hasChanges}>
                      {isLoading ? <><Loader className="mr-2 h-4 w-4 animate-spin"/> Salvando...</> : 'Salvar'}
                    </Button>
                </div>
            </DialogFooter>
        </DialogContent>
    </Dialog>
  );
}
