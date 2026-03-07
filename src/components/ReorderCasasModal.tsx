"use client";

import { useState, useEffect } from 'react';
import { doc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { type Casa } from '@/types/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ArrowUp, ArrowDown, GripVertical, Loader } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ReorderCasasModalProps {
  isOpen: boolean;
  onClose: () => void;
  casas: Casa[];
  territoryId: string;
  quadraId: string;
  congregationId: string;
}

export function ReorderCasasModal({ isOpen, onClose, casas: initialCasas, territoryId, quadraId, congregationId }: ReorderCasasModalProps) {
  const [localCasas, setLocalCasas] = useState<Casa[]>([]);
  const [initialOrderIds, setInitialOrderIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      // Ordena localmente para garantir que o usuário comece da ordem atual salva
      const sorted = [...initialCasas].sort((a, b) => (a.order || 0) - (b.order || 0));
      setLocalCasas(sorted);
      // Armazena a ordem inicial dos IDs para comparação de mudanças
      setInitialOrderIds(sorted.map(c => c.id));
    }
  }, [isOpen, initialCasas]);

  const moveHouse = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === localCasas.length - 1) return;

    const newCasas = [...localCasas];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    // Realiza a troca (swap)
    [newCasas[index], newCasas[targetIndex]] = [newCasas[targetIndex], newCasas[index]];
    setLocalCasas(newCasas);
  };

  const handleSave = async () => {
    if (!congregationId || !territoryId || !quadraId) return;
    
    setIsLoading(true);
    const batch = writeBatch(db);

    localCasas.forEach((casa, index) => {
      const casaRef = doc(db, 'congregations', congregationId, 'territories', territoryId, 'quadras', quadraId, 'casas', casa.id);
      batch.update(casaRef, { order: index });
    });

    try {
      await batch.commit();
      toast({ title: "Sucesso!", description: "A nova ordem das casas foi salva." });
      onClose();
    } catch (error) {
      console.error("Falha ao reordenar:", error);
      toast({ title: "Erro", description: "Não foi possível salvar a nova ordem.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle>Reordenar Casas</DialogTitle>
          <DialogDescription>
            Ajuste a sequência para que as casas fiquem na ordem correta da rua.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[50vh] overflow-y-auto px-6 space-y-2 py-4">
          {localCasas.map((casa, index) => {
            // Verifica se a casa nesta posição atual é diferente da casa que estava originalmente nesta posição
            const hasChangedPosition = casa.id !== initialOrderIds[index];
            
            return (
              <div 
                key={casa.id} 
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg border transition-all duration-200 group",
                  hasChangedPosition 
                    ? "bg-primary/5 border-primary/40 shadow-sm" 
                    : "bg-muted/30 border-border/50 hover:border-primary/30"
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <GripVertical className={cn(
                    "h-4 w-4 shrink-0 transition-colors",
                    hasChangedPosition ? "text-primary" : "text-muted-foreground"
                  )} />
                  <span className={cn(
                    "font-bold text-lg transition-colors",
                    hasChangedPosition ? "text-primary" : "text-foreground"
                  )}>
                    {casa.number}
                  </span>
                  {casa.observations && (
                    <span className="text-xs text-muted-foreground truncate italic">
                      ({casa.observations})
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:bg-primary/10 hover:text-primary"
                    onClick={() => moveHouse(index, 'up')}
                    disabled={index === 0 || isLoading}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:bg-primary/10 hover:text-primary"
                    onClick={() => moveHouse(index, 'down')}
                    disabled={index === localCasas.length - 1 || isLoading}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="p-6 pt-4 border-t bg-muted/10">
          <DialogClose asChild>
            <Button variant="secondary" disabled={isLoading}>Cancelar</Button>
          </DialogClose>
          <Button onClick={handleSave} disabled={isLoading} className="font-bold">
            {isLoading ? <Loader className="animate-spin mr-2" /> : "Confirmar Nova Ordem"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
