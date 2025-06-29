"use client";

import { useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface AddTerritoryModalProps {
  onTerritoryAdded: () => void;
  congregationId: string;
}

export function AddTerritoryModal({ onTerritoryAdded, congregationId }: AddTerritoryModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [number, setNumber] = useState('');
  const [name, setName] = useState('');
  const [mapLink, setMapLink] = useState('');
  const [cardUrl, setCardUrl] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (!number || !name) {
      setError('Número e Nome são campos obrigatórios.');
      setIsLoading(false);
      return;
    }

    if (!congregationId) {
      setError("ID da congregação não encontrado. Ação bloqueada.");
      setIsLoading(false);
      return;
    }

    try {
      const territoriesRef = collection(db, 'congregations', congregationId, 'territories');
      
      await addDoc(territoriesRef, {
        number,
        name,
        mapLink,
        cardUrl,
        lastUpdate: serverTimestamp(),
        progress: 0,
      });

      setNumber('');
      setName('');
      setMapLink('');
      setCardUrl('');
      setIsOpen(false);
      onTerritoryAdded();
      
    } catch (err) {
      console.error("Erro ao adicionar território:", err);
      setError("Não foi possível adicionar o território. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>+ Adicionar Território</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Adicionar Novo Território</DialogTitle>
          <DialogDescription>
            Preencha os detalhes do novo território abaixo.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} id="add-territory-form" className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="number">Número</Label>
              <Input id="number" value={number} onChange={(e) => setNumber(e.target.value)} placeholder="Ex: 12" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Centro Comercial" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mapLink">Link do Mapa (Opcional)</Label>
              <Input id="mapLink" value={mapLink} onChange={(e) => setMapLink(e.target.value)} placeholder="https://maps.google.com/..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cardUrl">URL do Cartão (Opcional)</Label>
              <Input id="cardUrl" value={cardUrl} onChange={(e) => setCardUrl(e.target.value)} placeholder="https://drive.google.com/..." />
            </div>
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
        </form>
        <DialogFooter>
          <Button type="submit" form="add-territory-form" disabled={isLoading}>
            {isLoading ? "Salvando..." : "Salvar Território"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
