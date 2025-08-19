"use client";

import { useState, useRef, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Plus, X } from 'lucide-react';
import { addDoc, collection, serverTimestamp, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

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
      const casasRef = collection(db, 'congregations', congregationId, 'territories', territoryId, 'quadras', quadraId, 'casas');
      
      const snapshot = await getDocs(casasRef);
      const order = snapshot.size;

      await addDoc(casasRef, { 
        number: number.toUpperCase(),
        observations, 
        status, 
        createdAt: serverTimestamp(),
        order
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
    <Dialog.Root open={isOpen} onOpenChange={onOpenChange}>
      <Dialog.Trigger asChild>
        <button className="flex items-center justify-center bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-colors text-sm">
          <Plus className="h-5 w-5 mr-2" />
          Adicionar Número
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="bg-black/60 fixed inset-0 z-50" />
        <Dialog.Content 
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
            <div className="relative w-full max-w-md rounded-lg bg-card p-6 shadow-lg max-h-[90vh] overflow-y-auto">
                <Dialog.Title className="text-lg font-medium text-card-foreground">
                    Adicionar Item
                </Dialog.Title>
                
                <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                    <div>
                    <label htmlFor="house-number" className="text-sm font-medium text-muted-foreground">Número (Necessário)</label>
                    <input 
                        id="house-number" 
                        ref={numberInputRef}
                        value={number} 
                        onChange={(e) => setNumber(e.target.value)} 
                        required 
                        placeholder="Ex: 2414 ou 100A"
                        className="w-full mt-1 bg-input text-foreground rounded px-3 py-2 border border-border uppercase focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    </div>
                    <div>
                    <label htmlFor="observacoes" className="text-sm font-medium text-muted-foreground">Observações</label>
                    <textarea 
                        id="observacoes" 
                        value={observations} 
                        onChange={(e) => setObservations(e.target.value)} 
                        rows={3} 
                        className="w-full mt-1 bg-input text-foreground rounded px-3 py-2 border border-border focus:outline-none focus:ring-2 focus:ring-primary" 
                        placeholder="Ex: Casa de esquina na Rua dos Pioneiros"
                    ></textarea>
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
                    
                    <div className="flex justify-end gap-4 mt-6">
                    <Dialog.Close asChild>
                        <button type="button" className="px-4 py-2 bg-secondary text-secondary-foreground rounded hover:bg-secondary/80">Cancelar</button>
                    </Dialog.Close>
                    <button type="submit" disabled={isLoading} className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50">
                        {isLoading ? 'Salvando...' : 'Salvar'}
                    </button>
                    </div>
                </form>
                
                <Dialog.Close asChild>
                    <button className="absolute top-3 right-3 text-muted-foreground hover:text-foreground">
                        <X />
                    </button>
                </Dialog.Close>
            </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
