"use client";

import { useState, useEffect, useRef } from 'react';
import { doc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { type Casa } from '@/types/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  
  // Ref para controlar se o modal acabou de ser aberto
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (isOpen && !hasInitialized.current) {
      // Ordena localmente para garantir que o usuário comece da ordem atual salva
      const sorted = [...initialCasas].sort((a, b) => (a.order || 0) - (b.order || 0));
      setLocalCasas(sorted);
      // Armazena a ordem inicial dos IDs para comparação de mudanças
      setInitialOrderIds(sorted.map(c => c.id));
      // Reseta a seleção
      setSelectedId(null);
      hasInitialized.current = true;
    } else if (!isOpen) {
      hasInitialized.current = false;
    }
  }, [isOpen, initialCasas]);

  // Verifica se a ordem atual é diferente da original
  const hasChanges = localCasas.some((casa, index) => casa.id !== initialOrderIds[index]);

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
    <Dialog 
      open={isOpen} 
      onOpenChange={(open) => {
        // Bloqueia o fechamento automático (clique fora/ESC) se houver mudanças
        if (!open && hasChanges) return;
        onClose();
      }}
    >
      <DialogContent 
        className="sm:max-w-md p-0 overflow-hidden border-none shadow-2xl"
        // Reforço de bloqueio de interação externa se houver mudanças
        onPointerDownOutside={(e) => { if (hasChanges) e.preventDefault(); }}
        onEscapeKeyDown={(e) => { if (hasChanges) e.preventDefault(); }}
      >
        <DialogHeader className="p-6 pb-2 bg-background/95 backdrop-blur-md sticky top-0 z-10 border-b border-border/50">
          <DialogTitle className="text-xl font-bold">Reordenar Casas</DialogTitle>
          <DialogDescription>
            Clique na casa que deseja mover e use as setas para ajustar.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto px-6 space-y-3 py-6 bg-muted/20">
          {localCasas.map((casa, index) => {
            const isSelected = selectedId === casa.id;
            const hasMoved = casa.id !== initialOrderIds[index];
            
            return (
              <div 
                key={casa.id} 
                onClick={() => setSelectedId(casa.id)}
                className={cn(
                  "flex items-center justify-between p-4 rounded-xl border-2 transition-all duration-300 group cursor-pointer",
                  isSelected 
                    ? (hasMoved 
                        ? "bg-primary/15 border-primary shadow-lg ring-2 ring-primary/20" 
                        : "bg-primary/5 border-primary shadow-sm")
                    : "bg-card border-border/40 hover:border-primary/20 hover:shadow-md"
                )}
              >
                <div className="flex items-center gap-4 min-w-0">
                  <GripVertical className={cn(
                    "h-5 w-5 shrink-0 transition-colors duration-300",
                    isSelected ? "text-primary" : "text-muted-foreground/40"
                  )} />
                  <div className="flex flex-col">
                    <span className={cn(
                      "font-black text-xl transition-all duration-300",
                      isSelected ? "text-primary scale-110 origin-left" : "text-foreground"
                    )}>
                      {casa.number}
                    </span>
                    {casa.observations && (
                      <span className="text-[10px] text-muted-foreground truncate italic max-w-[150px]">
                        {casa.observations}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant={isSelected ? "default" : "ghost"}
                    size="icon"
                    className={cn(
                      "h-10 w-10 transition-all duration-300",
                      isSelected ? "shadow-md scale-105" : "hover:bg-primary/10 hover:text-primary"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedId(casa.id);
                      moveHouse(index, 'up');
                    }}
                    disabled={index === 0 || isLoading}
                  >
                    <ArrowUp className="h-5 w-5" />
                  </Button>
                  <Button
                    variant={isSelected ? "default" : "ghost"}
                    size="icon"
                    className={cn(
                      "h-10 w-10 transition-all duration-300",
                      isSelected ? "shadow-md scale-105" : "hover:bg-primary/10 hover:text-primary"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedId(casa.id);
                      moveHouse(index, 'down');
                    }}
                    disabled={index === localCasas.length - 1 || isLoading}
                  >
                    <ArrowDown className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="p-6 pt-4 border-t bg-background/95 backdrop-blur-md sticky bottom-0 z-10 flex flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose} disabled={isLoading} className="flex-1">
            {hasChanges ? "Descartar Mudanças" : "Cancelar"}
          </Button>
          <Button onClick={handleSave} disabled={isLoading || !hasChanges} className="flex-1 font-bold shadow-lg">
            {isLoading ? <Loader className="animate-spin mr-2 h-4 w-4" /> : "Salvar Nova Ordem"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
