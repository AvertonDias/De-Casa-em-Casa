
"use client";

import { useState, useEffect, useRef } from "react";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface AddQuadraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { name: string; description: string }) => Promise<void>;
  existingQuadrasCount: number; 
}

export default function AddQuadraModal({ isOpen, onSave, onClose, existingQuadrasCount }: AddQuadraModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const descriptionInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      const nextQuadraNumber = (existingQuadrasCount + 1).toString().padStart(2, '0');
      setName(`Quadra ${nextQuadraNumber}`);
      setDescription('');
      
      setTimeout(() => {
        descriptionInputRef.current?.focus();
        descriptionInputRef.current?.select();
      }, 100);
    }
  }, [isOpen, existingQuadrasCount]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setIsProcessing(true);
    try {
      await onSave({ name, description });
      onClose();
    } catch (error) {
      console.error("Erro ao salvar nova quadra:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Adicionar Nova Quadra</DialogTitle>
          <DialogDescription>Digite o nome ou identificador da quadra e adicione observações se necessário.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <label htmlFor="quadra-name" className="block text-sm font-medium mb-1">Nome da Quadra</label>
            <Input id="quadra-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label htmlFor="quadra-desc" className="block text-sm font-medium mb-1">Observações (Opcional)</label>
            <Textarea ref={descriptionInputRef} id="quadra-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary" disabled={isProcessing}>Cancelar</Button>
          </DialogClose>
          <Button onClick={handleSave} disabled={isProcessing}>
            {isProcessing ? "Salvando..." : "Salvar Quadra"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
