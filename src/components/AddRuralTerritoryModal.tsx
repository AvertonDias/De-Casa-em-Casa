"use client";

import { useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { X, Plus, Trash2, Link as LinkIcon } from 'lucide-react';
import { RuralLink } from '@/types/types';

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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="relative bg-card text-card-foreground p-6 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <button onClick={handleClose} className="absolute top-4 right-4"><X /></button>
        <h2 className="text-xl font-bold">Adicionar Território Rural</h2>
        <p className="text-sm text-muted-foreground mb-4">Preencha os detalhes do novo território rural, incluindo links úteis.</p>
        
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input 
                type="text" value={number} onChange={(e) => setNumber(e.target.value)} 
                placeholder="Número (Ex: R01)" required
                className="w-full px-4 py-2 bg-input border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <input 
                type="text" value={name} onChange={(e) => setName(e.target.value)} 
                placeholder="Nome (Ex: Pedra Grande)" required
                className="w-full px-4 py-2 bg-input border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
          </div>
          <textarea 
            value={description} onChange={(e) => setObservations(e.target.value)} 
            placeholder="Observações (Ex: Pegar estrada de terra após a ponte...)" rows={3}
            className="w-full px-4 py-2 bg-input border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          ></textarea>
          <input 
            type="url" value={mapLink} onChange={(e) => setMapLink(e.target.value)} 
            placeholder="Link principal do Google Maps (Opcional)"
            className="w-full px-4 py-2 bg-input border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          />
          
           <div className="border-t border-border pt-4 space-y-3">
            <h3 className="font-semibold flex items-center"><LinkIcon size={16} className="mr-2"/> Links Específicos</h3>
            
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
              <div className="flex-grow">
                <label className="text-xs">Descrição do Link</label>
                <input value={linkDesc} onChange={(e) => setLinkDesc(e.target.value)} placeholder="Ex: Mapa da Estrada" className="w-full bg-input p-2 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"/>
              </div>
              <div className="flex-grow">
                <label className="text-xs">URL</label>
                <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://" className="w-full bg-input p-2 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"/>
              </div>
              <button onClick={handleAddLinkToList} type="button" className="p-2 bg-primary/20 text-primary rounded-md h-10"><Plus size={20}/></button>
            </div>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="flex justify-end pt-4">
            <button type="submit" disabled={isLoading} className="px-6 py-2 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-50">
              {isLoading ? "Salvando..." : "Salvar Território"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
