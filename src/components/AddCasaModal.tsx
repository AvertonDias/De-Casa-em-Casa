
"use client";

import { useState, useRef, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import { addDoc, collection, doc, runTransaction, serverTimestamp, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface AddCasaModalProps {
  territoryId: string;
  quadraId: string;
  onCasaAdded: () => void;
  congregationId: string;
}

export function AddCasaModal({ territoryId, quadraId, onCasaAdded, congregationId }: AddCasaModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [number, setNumber] = useState('');
  const [observations, setObservations] = useState('');
  const [status, setStatus] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const numberInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        numberInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    if (!congregationId) {
      setError("ID da congregação não encontrado. Ação bloqueada.");
      setIsLoading(false);
      return;
    }

    if (!number) {
        setError('O número da casa é obrigatório.');
        setIsLoading(false);
        return;
    }

    try {
        const quadraRef = doc(db, 'congregations', congregationId, 'territories', territoryId, 'quadras', quadraId);
        const casasRef = collection(quadraRef, 'casas');
        const territoryRef = doc(db, 'congregations', congregationId, 'territories', territoryId);

        await runTransaction(db, async (transaction) => {
            const quadraDoc = await transaction.get(quadraRef);
            const territoryDoc = await transaction.get(territoryRef);
            const casasSnapshot = await getDocs(casasRef);

            if (!quadraDoc.exists() || !territoryDoc.exists()) {
                throw new Error("Quadra ou Território não encontrado.");
            }
            
            const order = casasSnapshot.size;
            const newCasaRef = doc(casasRef); // Cria referência para a nova casa

            transaction.set(newCasaRef, {
                number: number.toUpperCase(),
                observations, 
                status, 
                createdAt: serverTimestamp(),
                order
            });

            const newQuadraTotalHouses = (quadraDoc.data().totalHouses || 0) + 1;
            const newQuadraHousesDone = (quadraDoc.data().housesDone || 0) + (status ? 1 : 0);
            
            transaction.update(quadraRef, {
                totalHouses: newQuadraTotalHouses,
                housesDone: newQuadraHousesDone
            });

            const newTerritoryTotalHouses = (territoryDoc.data().stats.totalHouses || 0) + 1;
            const newTerritoryHousesDone = (territoryDoc.data().stats.housesDone || 0) + (status ? 1 : 0);
            const newProgress = newTerritoryTotalHouses > 0 ? newTerritoryHousesDone / newTerritoryTotalHouses : 0;
            
            transaction.update(territoryRef, {
                "stats.totalHouses": newTerritoryTotalHouses,
                "stats.housesDone": newTerritoryHousesDone,
                progress: newProgress
            });
        });

      setIsOpen(false);
      onCasaAdded();

    } catch (err) {
      console.error("Erro ao adicionar casa:", err);
      setError("Falha ao adicionar casa.");
    } finally {
        setIsLoading(false);
    }
  };

  const onOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      setNumber('');
      setObservations('');
      setStatus(false);
      setError('');
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button className="flex items-center justify-center font-bold text-sm">
          <Plus className="h-5 w-5 mr-2" />
          Adicionar Número
        </Button>
      </DialogTrigger>
        <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle>Adicionar Item</DialogTitle>
              <DialogDescription>
                Preencha os detalhes do novo número a ser adicionado nesta quadra.
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                <div>
                  <label htmlFor="house-number" className="text-sm font-medium text-muted-foreground">Número (Necessário)</label>
                  <Input 
                      id="house-number" 
                      ref={numberInputRef}
                      value={number} 
                      onChange={(e) => setNumber(e.target.value)} 
                      required 
                      placeholder="Ex: 2414 ou 100A"
                      className="mt-1 uppercase"
                  />
                </div>
                <div>
                  <label htmlFor="observacoes" className="text-sm font-medium text-muted-foreground">Observações</label>
                  <Textarea 
                      id="observacoes" 
                      value={observations} 
                      onChange={(e) => setObservations(e.target.value)} 
                      rows={3} 
                      className="w-full mt-1" 
                      placeholder="Ex: Casa de esquina na Rua dos Pioneiros"
                  />
                </div>
                <div className="flex items-center justify-between pt-2">
                  <label htmlFor="feito" className="font-medium text-foreground">Feito</label>
                  <button 
                      type="button" 
                      onClick={() => setStatus(!status)} 
                      className={`${status ? 'bg-primary' : 'bg-muted'} relative inline-flex h-6 w-11 items-center rounded-full transition-colors`}
                  >
                      <span className={`${status ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
                  </button>
                </div>
                
                {error && <p className="text-destructive text-sm">{error}</p>}
                
                <DialogFooter className="gap-2 sm:gap-0">
                  <DialogClose asChild>
                      <Button type="button" variant="secondary">Cancelar</Button>
                  </DialogClose>
                  <Button type="submit" disabled={isLoading}>
                      {isLoading ? 'Salvando...' : 'Salvar'}
                  </Button>
                </DialogFooter>
            </form>
        </DialogContent>
    </Dialog>
  );
}
