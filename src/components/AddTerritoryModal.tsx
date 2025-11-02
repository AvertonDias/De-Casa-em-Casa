
"use client";

import { useState, useRef, useEffect } from "react";
import { X, FileImage, Loader } from 'lucide-react';
import { addDoc, collection, serverTimestamp, FieldValue } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Territory } from '@/types/types';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface AddTerritoryModalProps {
  isOpen: boolean; 
  onClose: () => void; 
  onTerritoryAdded: () => void;
  congregationId: string;
}

export default function AddTerritoryModal({ isOpen, onClose, onTerritoryAdded, congregationId }: AddTerritoryModalProps) {
  const [number, setNumber] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [mapLink, setMapLink] = useState('');
  
  const [cardDataUrl, setCardDataUrl] = useState<string>('');
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const numberInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        numberInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = event.target.files ? event.target.files[0] : null;

    if (file) {
      if (file.size > 5 * 1024 * 1024) { // Limite de 5MB
        setError("O arquivo é muito grande. O limite é de 5MB.");
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setCardDataUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setCardDataUrl('');
    }
  };
  
  const removeSelectedImage = () => {
    setCardDataUrl('');
  }

  const handleSave = async () => {
    if (!number || !name) { setError("Número e Nome são obrigatórios."); return; }
    if (!congregationId) {
      setError("ID da Congregação não encontrado. Impossível salvar.");
      return;
    }

    setIsProcessing(true); setError(null);
    
    const newTerritoryData: Omit<Territory, "id" | "lastUpdate" | "createdAt"> & { lastUpdate: FieldValue, createdAt: FieldValue } = {
        number, 
        name, 
        description, 
        mapLink, 
        cardUrl: cardDataUrl,
        type: 'urban' as const,
        status: 'disponivel',
        createdAt: serverTimestamp(),
        lastUpdate: serverTimestamp(),
        stats: { totalHouses: 0, housesDone: 0 },
        progress: 0,
        quadraCount: 0,
    };
    
    try {
      const territoriesRef = collection(db, 'congregations', congregationId, 'territories');
      await addDoc(territoriesRef, newTerritoryData);
      onTerritoryAdded();
      handleClose();
    } catch (saveError: any) {
      console.error("Erro ao salvar:", saveError);
      setError(saveError.message || "Erro ao salvar o território. Tente novamente.");
    } finally {
        setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setNumber(''); setName(''); setDescription(''); setMapLink('');
    setCardDataUrl(''); setError(null); setIsProcessing(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle>Adicionar Novo Território</DialogTitle>
              <DialogDescription>Preencha os detalhes do novo território abaixo.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto px-1">
              <div className="flex items-center gap-4">
                <div className="w-28"><label className="block text-sm mb-1">Número</label><Input ref={numberInputRef} value={number} onChange={(e) => setNumber(e.target.value)} placeholder="Ex: 12"/></div>
                <div className="flex-grow"><label className="block text-sm mb-1">Nome</label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Centro Comercial"/></div>
              </div>
              <div><label>Observações (Opcional)</label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Ex: Território da prefeitura..."></Textarea></div>
              <div><label>Link do Mapa (Opcional)</label><Input value={mapLink} onChange={(e) => setMapLink(e.target.value)} placeholder="https://maps.google.com/..."/></div>
              <div>
                <label className="block text-sm font-medium mb-1">Imagem do Cartão (Opcional)</label>
                <div className="mt-1 flex justify-center items-center rounded-lg border border-dashed border-gray-500 min-h-[12rem] relative group">
                  {cardDataUrl ? (<><img src={cardDataUrl} alt="Preview" className="max-h-32 object-contain rounded-md" /><button onClick={removeSelectedImage} className="absolute top-2 right-2 bg-red-600/80 text-white rounded-full p-1 opacity-0 group-hover:opacity-100"><X size={16} /></button></>) : (<div className="text-center"><FileImage className="mx-auto h-12 w-12 text-gray-400" /><label htmlFor="file-upload" className="cursor-pointer font-semibold text-primary"><span>Selecione um arquivo</span><input id="file-upload" type="file" className="sr-only" onChange={handleFileChange} accept="image/*"/></label><p className="text-xs text-gray-500">PNG, JPG até 5MB</p></div>)}
                </div>
              </div>
              {error && (<p className="text-sm text-red-500 text-center">{error}</p>)}
            </div>
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="secondary">Cancelar</Button></DialogClose>
              <Button onClick={handleSave} disabled={isProcessing}>
                {isProcessing ? <><Loader className="mr-2 h-4 w-4 animate-spin" /> Salvando...</> : "Salvar"}
              </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
  );
}
