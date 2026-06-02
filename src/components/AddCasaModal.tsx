
"use client";

import { useState, useRef, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import { addDoc, collection, doc, runTransaction, serverTimestamp, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useUser } from '@/contexts/UserContext';
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
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { logEvent } from '@/lib/audit';

interface AddCasaModalProps {
  territoryId: string;
  quadraId: string;
  onCasaAdded: () => void;
  congregationId: string;
}

export function AddCasaModal({ territoryId, quadraId, onCasaAdded, congregationId }: AddCasaModalProps) {
  const { user } = useUser();
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
    
    if (!congregationId || !user) {
      setError("ID da congregação ou dados do usuário não encontrados. Ação bloqueada.");
      setIsLoading(false);
      return;
    }

    if (!number) {
        setError('O número da casa é obrigatório.');
        setIsLoading(false);
        return;
    }

    const congRef = doc(db, 'congregations', congregationId);
    const territoryRef = doc(congRef, 'territories', territoryId);
    const quadraRef = doc(territoryRef, 'quadras', quadraId);
    const casasRef = collection(quadraRef, 'casas');

    runTransaction(db, async (transaction) => {
        const [quadraDoc, territoryDoc, congDoc, casasSnapshot] = await Promise.all([
            transaction.get(quadraRef),
            transaction.get(territoryRef),
            transaction.get(congRef),
            getDocs(casasRef),
        ]);

        if (!quadraDoc.exists() || !territoryDoc.exists() || !congDoc.exists()) {
            throw new Error("Quadra, Território ou Congregação não encontrado.");
        }
        
        const order = casasSnapshot.size;
        const newCasaRef = doc(casasRef); 

        const casaData: any = {
            number: number.toUpperCase(),
            observations, 
            status, 
            createdAt: serverTimestamp(),
            order
        };

        if (status) {
            const activityHistoryRef = collection(territoryRef, 'activityHistory');
            const newActivityRef = doc(activityHistoryRef);
            transaction.set(newActivityRef, {
                type: "work",
                activityDate: Timestamp.now(),
                description: `Casa ${number.toUpperCase()} (da ${quadraDoc.data().name}) do território ${territoryDoc.data().number} foi feita ao ser adicionada.`,
                userId: 'automatic_system_log',
                userName: user.name,
                createdAt: serverTimestamp(),
            });
            
            casaData.lastWorkedBy = { uid: user.uid, name: user.name };
            casaData.activityLogId = newActivityRef.id;
        }

        transaction.set(newCasaRef, casaData);

        const newQuadraTotalHouses = (quadraDoc.data().totalHouses || 0) + 1;
        const newQuadraHousesDone = (quadraDoc.data().housesDone || 0) + (status ? 1 : 0);
        transaction.update(quadraRef, {
            totalHouses: newQuadraTotalHouses,
            housesDone: newQuadraHousesDone
        });

        const newTerritoryTotalHouses = (territoryDoc.data().stats.totalHouses || 0) + 1;
        const newTerritoryHousesDone = (territoryDoc.data().stats.housesDone || 0) + (status ? 1 : 0);
        const newProgress = newTerritoryTotalHouses > 0 ? newTerritoryHousesDone / newTerritoryTotalHouses : 0;
        const territoryUpdateData: any = {
            "stats.totalHouses": newTerritoryTotalHouses,
            "stats.housesDone": newTerritoryHousesDone,
            progress: newProgress,
            lastUpdate: serverTimestamp()
        };
        if (status) {
            territoryUpdateData.lastWorkedAt = serverTimestamp();
        }
        transaction.update(territoryRef, territoryUpdateData);
        
        const newCongTotalHouses = (congDoc.data().totalHouses || 0) + 1;
        const newCongTotalHousesDone = (congDoc.data().totalHousesDone || 0) + (status ? 1 : 0);
        transaction.update(congRef, {
            totalHouses: newCongTotalHouses,
            totalHousesDone: newCongTotalHousesDone
        });
    }).then(() => {
        logEvent(congregationId, user.uid, user.name, 'HOUSE_CREATED', `Adicionou a casa ${number.toUpperCase()} à quadra ${quadraId} do território ${territoryId}.`, { territoryId, quadraId, houseNumber: number });
    }).catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
            path: quadraRef.path,
            operation: 'create',
            requestResourceData: { number, status },
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
    });

    setIsOpen(false);
    onCasaAdded();
    setIsLoading(false);
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
