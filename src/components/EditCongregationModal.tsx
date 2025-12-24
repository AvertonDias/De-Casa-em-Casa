
"use client";

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { House, Loader } from 'lucide-react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useUser } from '@/contexts/UserContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface EditCongregationModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function EditCongregationModal({ isOpen, onOpenChange }: EditCongregationModalProps) {
  const { user } = useUser();
  
  const [congregationName, setCongregationName] = useState('');
  const [congregationNumber, setCongregationNumber] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (isOpen && user?.congregationId) {
        setError(''); 
        setSuccess('');
        
        const congRef = doc(db, 'congregations', user.congregationId);
        getDoc(congRef).then(snap => {
            if(snap.exists()){
              setCongregationName(snap.data().name || '');
              setCongregationNumber(snap.data().number || '');
            }
        });
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
      setTimeout(() => onOpenChange(false), 2000);

    } catch (err: any) {
      setError(err.message || "Falha ao salvar as configurações.");
    } finally { 
        setIsLoading(false); 
    }
  };

  const inputClasses = "w-full mt-1 bg-input text-foreground rounded px-3 py-2 border border-border";

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><House />Editar Congregação</DialogTitle>
          <DialogDescription>
            Edite o nome e o número da sua congregação.
          </DialogDescription>
        </DialogHeader>
          
        <form onSubmit={handleUpdate} className="mt-4 space-y-6">
          <div className="space-y-4">
            <input value={congregationName} onChange={e => setCongregationName(e.target.value)} placeholder="Nome da Congregação" className={inputClasses} />
            <input type="tel" inputMode="numeric" value={congregationNumber} onChange={e => setCongregationNumber(e.target.value.replace(/\D/g, ''))} placeholder="Número" className={inputClasses} />
          </div>

          {error && <p className="text-sm text-center text-destructive">{error}</p>}
          {success && <p className="text-sm text-center text-green-500">{success}</p>}
        </form>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">Cancelar</Button>
          </DialogClose>
          <Button type="submit" form="edit-profile-form" disabled={isLoading}>
            {isLoading ? <><Loader className="mr-2 h-4 w-4 animate-spin"/>Salvando...</> : "Salvar Alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
