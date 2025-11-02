
"use client";

import { useState, useRef, useEffect } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Plus, Trash2, Link as LinkIcon } from 'lucide-react';
import { RuralLink } from '@/types/types';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface AddRuralTerritoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTerritoryAdded: () => void;
  congregationId: string;
}

export function AddRuralTerritoryModal({ isOpen, onClose, onTerritoryAdded, congregationId }: AddRuralTerritoryModalProps) {
  const [number, setNumber] = useState('');
  const [name, setName] = useState('');
  const [description, setObservations] = useState('');
  const [mapLink, setMapLink] = useState('');
  
  const [links, setLinks] = useState<RuralLink[]>([]);
  const [linkDesc, setLinkDesc] = useState('');
  const [linkUrl, setLinkUrl] = useState('');

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

  const handleAddLinkToList = () => {
    if (!linkDesc.trim() || !linkUrl.trim()) {
      alert("Por favor, preencha a descrição e a URL do link.");
      return;
    }
    const newLink: RuralLink = {
      id: crypto.randomUUID(),
      description: linkDesc,
      url: linkUrl,
    };
    setLinks([...links, newLink]);
    setLinkDesc('');
    setLinkUrl('');
  };

  const handleRemoveLinkFromList = (idToRemove: string) => {
    setLinks(links.filter(link => link.id !== idToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!number || !name) {
      setError('O número e o nome do território são obrigatórios.');
      return;
    }
    
    setIsLoading(true);
    setError('');

    try {
      const territoriesRef = collection(db, 'congregations', congregationId, 'territories');
      await addDoc(territoriesRef, {
        number: number,
        name: name,
        description: description,
        mapLink: mapLink,
        links: links,
        type: 'rural',
        createdAt: serverTimestamp(),
        lastUpdate: serverTimestamp(),
      });
      
      onTerritoryAdded();
      handleClose();

    } catch (err) {
      console.error("Erro ao adicionar território rural:", err);
      setError('Ocorreu um erro ao salvar. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setNumber('');
    setName('');
    setObservations('');
    setMapLink('');
    setLinks([]);
    setLinkDesc('');
    setLinkUrl('');
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Adicionar Território Rural</DialogTitle>
              <DialogDescription>Preencha os detalhes do novo território rural, incluindo links úteis.</DialogDescription>
            </DialogHeader>
            <form id="add-rural-form" onSubmit={handleSubmit} className="space-y-4 py-4 px-1 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input ref={numberInputRef} value={number} onChange={(e) => setNumber(e.target.value)} placeholder="Número (Ex: R01)" required />
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome (Ex: Pedra Grande)" required />
              </div>
              <Textarea value={description} onChange={(e) => setObservations(e.target.value)} placeholder="Observações (Ex: Pegar estrada de terra após a ponte...)" rows={3} />
              <Input type="url" value={mapLink} onChange={(e) => setMapLink(e.target.value)} placeholder="Link principal do Google Maps (Opcional)" />
              
              <div className="border-t border-border pt-4 space-y-3">
                <h3 className="font-semibold flex items-center text-sm"><LinkIcon size={16} className="mr-2"/> Links Específicos</h3>
                <div className="space-y-2 max-h-32 overflow-y-auto pr-2">
                  {links.map((link) => (
                    <div key={link.id} className="flex items-center justify-between bg-input/50 p-2 rounded-md">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{link.description}</p>
                        <p className="text-xs text-muted-foreground truncate">{link.url}</p>
                      </div>
                      <button onClick={() => handleRemoveLinkFromList(link.id)} type="button" className="p-1 text-red-500 hover:bg-red-500/10 rounded-full">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                  {links.length === 0 && <p className="text-xs text-center text-muted-foreground py-2">Nenhum link adicionado.</p>}
                </div>
                <div className="flex items-end gap-2 border-t border-border pt-3">
                  <div className="flex-grow"><label className="text-xs">Descrição do Link</label><Input value={linkDesc} onChange={(e) => setLinkDesc(e.target.value)} placeholder="Ex: Mapa da Estrada" className="h-9 text-sm"/></div>
                  <div className="flex-grow"><label className="text-xs">URL</label><Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://" className="h-9 text-sm"/></div>
                  <Button onClick={handleAddLinkToList} type="button" size="icon" variant="outline" className="h-9 w-9 flex-shrink-0"><Plus size={16}/></Button>
                </div>
              </div>

              {error && <p className="text-red-500 text-sm">{error}</p>}
            </form>
            <DialogFooter>
                <DialogClose asChild><Button type="button" variant="secondary">Cancelar</Button></DialogClose>
                <Button type="submit" form="add-rural-form" disabled={isLoading}>
                    {isLoading ? "Salvando..." : "Salvar Território"}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
  );
}
