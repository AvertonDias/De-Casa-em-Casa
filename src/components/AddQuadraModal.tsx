"use client";

import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface AddQuadraModalProps {
  territoryId: string;
  onQuadraAdded: () => void;
  existingQuadrasCount: number;
  congregationId: string;
}

export function AddQuadraModal({ territoryId, onQuadraAdded, existingQuadrasCount, congregationId }: AddQuadraModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const nextNumber = (existingQuadrasCount + 1).toString().padStart(2, '0');
      setName(`Quadra ${nextNumber}`);
    }
  }, [existingQuadrasCount, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setIsLoading(true);
    setError('');

    if (!name) {
      setError('O nome da quadra é obrigatório.');
      setIsLoading(false);
      return;
    }

    try {
      const quadrasRef = collection(db, 'congregations', congregationId, 'territories', territoryId, 'quadras');
      
      await addDoc(quadrasRef, {
        name,
        createdAt: serverTimestamp(),
      });

      setName('');
      setIsOpen(false);
      onQuadraAdded();
      
    } catch (err) {
      console.error("Erro ao adicionar quadra:", err);
      setError("Não foi possível adicionar a quadra. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Quadra
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Adicionar Nova Quadra</DialogTitle>
          <DialogDescription>
            Digite o nome ou identificador da quadra (ex: Quadra 01, Rua Principal).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} id="add-quadra-form" className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome da Quadra</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Quadra 01" required/>
          </div>
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
        </form>
        <DialogFooter>
            <Button type="submit" form="add-quadra-form" disabled={isLoading}>
                {isLoading ? "Salvando..." : "Salvar Quadra"}
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
