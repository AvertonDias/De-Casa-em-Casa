"use client";

import { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { House, X } from 'lucide-react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useUser } from '@/contexts/UserContext';
import { Button } from '@/components/ui/button';

interface EditCongregationModalProps {
  disabled?: boolean;
}

export function EditCongregationModal({ disabled = false }: EditCongregationModalProps) {
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

  const inputClasses = "w-full mt-1 bg-input text-foreground rounded px-3 py-2 border border-border";

  return (
    <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
      <Dialog.Trigger asChild>
        <Button 
          disabled={disabled}
          className="w-full font-semibold"
        >
          <House className="h-4 w-4 mr-2" /> Editar Congregação
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="bg-black/60 fixed inset-0" />
        <Dialog.Content className="fixed top-1/2 left-1/2 w-[90vw] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg bg-card p-6 shadow-lg focus:outline-none max-h-[90vh] overflow-y-auto">
          <Dialog.Title className="text-lg font-medium text-card-foreground">Editar Congregação</Dialog.Title>
          <Dialog.Description className="text-sm text-muted-foreground mt-1">
            Edite o nome e o número da sua congregação.
          </Dialog.Description>
          <form onSubmit={handleUpdate} className="mt-4 space-y-6">
            
            <fieldset className="border border-input p-4 rounded-lg">
              <legend className="text-md font-semibold text-primary mb-2 px-2 flex items-center"><House className="mr-2 h-5 w-5"/>Dados da Congregação</legend>
              <div className="space-y-4">
                <input value={congregationName} onChange={e => setCongregationName(e.target.value)} placeholder="Nome da Congregação" className={inputClasses} />
                <input type="tel" inputMode="numeric" value={congregationNumber} onChange={e => setCongregationNumber(e.target.value.replace(/\D/g, ''))} placeholder="Número" className={inputClasses} />
              </div>
            </fieldset>

            {error && <p className="text-sm text-center text-destructive">{error}</p>}
            {success && <p className="text-sm text-center text-green-500">{success}</p>}
            
            <div className="flex justify-end gap-4 mt-8 pt-4 border-t border-border">
                <Dialog.Close asChild>
                    <Button type="button" variant="secondary">Cancelar</Button>
                </Dialog.Close>
                <Button type="submit" disabled={isLoading}>
                    {isLoading ? "Salvando..." : "Salvar Alterações"}
                </Button>
            </div>
          </form>
          <Dialog.Close asChild>
              <button className="absolute top-3 right-3 text-muted-foreground hover:text-foreground">
                  <X />
                </button>
            </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
