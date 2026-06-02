
"use client";

import { useState, useRef, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { collection, doc, runTransaction, serverTimestamp, getDocs, Timestamp } from 'firebase/firestore';
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
  territoryNumber?: string;
}

export function AddCasaModal({ territoryId, quadraId, onCasaAdded, congregationId, territoryNumber }: AddCasaModalProps) {
  const { user } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [number, setNumber] = useState('');
  const [observations, setObservations] = useState('');
  const [status, setStatus] = useState(false);
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
    
    if (!congregationId || !user) {
      setIsLoading(false);
      return;
    }

    const congRef = doc(db, 'congregations', congregationId);
    const territoryRef = doc(congRef, 'territories', territoryId);
    const quadraRef = doc(territoryRef, 'quadras', quadraId);
    const casasRef = collection(quadraRef, 'casas');

    runTransaction(db, async (transaction) => {
        const [quadraDoc, territoryDoc, congDoc] = await Promise.all([
            transaction.get(quadraRef),
            transaction.get(territoryRef),
            transaction.get(congRef),
        ]);

        if (!quadraDoc.exists() || !territoryDoc.exists() || !congDoc.exists()) {
            throw new Error("Documento não encontrado.");
        }
        
        const newCasaRef = doc(casasRef); 
        const currentTerritoryNumber = territoryDoc.data().number;

        const casaData: any = {
            number: number.toUpperCase(),
            observations, 
            status, 
            createdAt: serverTimestamp(),
            order: (quadraDoc.data().totalHouses || 0)
        };

        if (status) {
            const activityHistoryRef = collection(territoryRef, 'activityHistory');
            const newActivityRef = doc(activityHistoryRef);
            transaction.set(newActivityRef, {
                type: "work",
                activityDate: Timestamp.now(),
                description: `Casa ${number.toUpperCase()} do território ${currentTerritoryNumber} foi feita.`,
                userId: 'automatic_system_log',
                userName: user.name,
                createdAt: serverTimestamp(),
            });
            
            casaData.lastWorkedBy = { uid: user.uid, name: user.name };
            casaData.activityLogId = newActivityRef.id;
        }

        transaction.set(newCasaRef, casaData);

        transaction.update(quadraRef, {
            totalHouses: (quadraDoc.data().totalHouses || 0) + 1,
            housesDone: (quadraDoc.data().housesDone || 0) + (status ? 1 : 0)
        });

        const newTerritoryHousesDone = (territoryDoc.data().stats.housesDone || 0) + (status ? 1 : 0);
        const newTerritoryTotalHouses = (territoryDoc.data().stats.totalHouses || 0) + 1;
        const territoryUpdateData: any = {
            "stats.totalHouses": newTerritoryTotalHouses,
            "stats.housesDone": newTerritoryHousesDone,
            progress: newTerritoryTotalHouses > 0 ? newTerritoryHousesDone / newTerritoryTotalHouses : 0,
            lastUpdate: serverTimestamp()
        };
        if (status) territoryUpdateData.lastWorkedAt = serverTimestamp();
        transaction.update(territoryRef, territoryUpdateData);
        
        transaction.update(congRef, {
            totalHouses: (congDoc.data().totalHouses || 0) + 1,
            totalHousesDone: (congDoc.data().totalHousesDone || 0) + (status ? 1 : 0)
        });
    }).then(() => {
        const finalTerritoryNumber = territoryNumber || territoryId;
        logEvent(congregationId, user.uid, user.name, 'HOUSE_CREATED', `Adicionou a casa ${number.toUpperCase()} no território ${finalTerritoryNumber}.`, { territoryId, quadraId, houseNumber: number, territoryNumber: finalTerritoryNumber });
    }).catch(async (error) => {
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

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="flex items-center justify-center font-bold text-sm">
          <Plus className="h-5 w-5 mr-2" />
          Adicionar Número
        </Button>
      </DialogTrigger>
        <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle>Adicionar Item</DialogTitle>
              <DialogDescription>Preencha os detalhes do novo número.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                <div>
                  <label htmlFor="house-number" className="text-sm font-medium text-muted-foreground">Número</label>
                  <Input id="house-number" ref={numberInputRef} value={number} onChange={(e) => setNumber(e.target.value)} required placeholder="Ex: 2414" className="mt-1 uppercase" />
                </div>
                <div>
                  <label htmlFor="observacoes" className="text-sm font-medium text-muted-foreground">Observações</label>
                  <Textarea id="observacoes" value={observations} onChange={(e) => setObservations(e.target.value)} rows={3} className="w-full mt-1" />
                </div>
                <div className="flex items-center justify-between pt-2">
                  <label className="font-medium">Marcar como feito</label>
                  <button type="button" onClick={() => setStatus(!status)} className={`${status ? 'bg-primary' : 'bg-muted'} relative inline-flex h-6 w-11 items-center rounded-full transition-colors`}>
                      <span className={`${status ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
                  </button>
                </div>
                <DialogFooter className="gap-2 sm:gap-0">
                  <DialogClose asChild><Button type="button" variant="secondary">Cancelar</Button></DialogClose>
                  <Button type="submit" disabled={isLoading}>{isLoading ? 'Salvando...' : 'Salvar'}</Button>
                </DialogFooter>
            </form>
        </DialogContent>
    </Dialog>
  );
}
