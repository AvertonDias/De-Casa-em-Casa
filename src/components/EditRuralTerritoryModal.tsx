"use client";

import { useState, useEffect } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useUser } from '@/contexts/UserContext';
import { Trash2, Edit, Loader, Plus, Link as LinkIcon, Save } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { RuralTerritory, RuralLink } from '@/types/types';

interface EditRuralTerritoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTerritoryUpdated: () => void;
  onDeleteRequest: () => void; // Ação para abrir o modal de confirmação
  congregationId: string;
  territory: RuralTerritory; 
}

export function EditRuralTerritoryModal({ isOpen, onClose, onTerritoryUpdated, onDeleteRequest, congregationId, territory }: EditRuralTerritoryModalProps) {
  const { user } = useUser();
  
  // States for territory data
  const [number, setNumber] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [mapLink, setMapLink] = useState('');
  const [links, setLinks] = useState<RuralLink[]>([]);
  
  // States for link editing
  const [linkDesc, setLinkDesc] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && territory) {
      setNumber(territory.number || '');
      setName(territory.name || '');
      setDescription(territory.description || '');
      setMapLink(territory.mapLink || '');
      setLinks(territory.links || []);
      setError('');
      // Reset link form as well
      setLinkDesc('');
      setLinkUrl('');
      setEditingLinkId(null);
    }
  }, [territory, isOpen]);

  const handleAddOrUpdateLink = () => {
    if (!linkDesc.trim() || !linkUrl.trim()) return;

    if (editingLinkId) {
      // Update existing link
      setLinks(links.map(link => 
        link.id === editingLinkId 
          ? { ...link, description: linkDesc, url: linkUrl } 
          : link
      ));
    } else {
      // Add new link
      const newLink: RuralLink = { id: crypto.randomUUID(), description: linkDesc, url: linkUrl };
      setLinks([...links, newLink]);
    }
    
    // Reset form
    setLinkDesc('');
    setLinkUrl('');
    setEditingLinkId(null);
  };
  
  const handleStartEditLink = (linkToEdit: RuralLink) => {
    setEditingLinkId(linkToEdit.id);
    setLinkDesc(linkToEdit.description);
    setLinkUrl(linkToEdit.url);
  };

  const handleRemoveLinkFromList = (idToRemove: string) => {
    setLinks(links.filter(link => link.id !== idToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!territory) return;
    
    setIsLoading(true);
    setError('');

    try {
      const territoryRef = doc(db, 'congregations', congregationId, 'territories', territory.id);
      await updateDoc(territoryRef, {
        number, name, description, mapLink, links,
        lastUpdate: serverTimestamp(),
      });
      
      onTerritoryUpdated();
      onClose();

    } catch (err) {
      console.error("Erro ao atualizar território rural:", err);
      setError('Ocorreu um erro ao salvar. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Território Rural</DialogTitle>
            <DialogDescription>
              Faça alterações nos dados do território.
            </DialogDescription>
          </DialogHeader>
          <form id="edit-rural-form" onSubmit={handleSubmit} className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="number">Número</Label>
                <Input id="number" value={number} onChange={(e) => setNumber(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Observações</Label>
              <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>

            <div className="border-t border-border pt-4 space-y-3">
              <h3 className="font-semibold flex items-center text-sm"><LinkIcon size={16} className="mr-2"/> Links Específicos</h3>
              <div className="space-y-2 max-h-32 overflow-y-auto pr-2">
                {links.map((link) => (
                  <div key={link.id} className="flex items-center justify-between bg-input/50 p-2 rounded-md">
                    <div className="min-w-0"><p className="font-medium text-sm truncate">{link.description}</p><p className="text-xs text-muted-foreground truncate">{link.url}</p></div>
                    <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                      <button onClick={() => handleStartEditLink(link)} type="button" className="p-1 text-blue-500 hover:bg-blue-500/10 rounded-full"><Edit size={16} /></button>
                      <button onClick={() => handleRemoveLinkFromList(link.id)} type="button" className="p-1 text-red-500 hover:bg-red-500/10 rounded-full"><Trash2 size={16} /></button>
                    </div>
                  </div>
                ))}
                {links.length === 0 && <p className="text-xs text-center text-muted-foreground py-2">Nenhum link adicionado.</p>}
              </div>
              <div className="flex items-end gap-2 border-t border-border pt-3">
                <div className="flex-grow"><Label className="text-xs">Descrição do Link</Label><Input value={linkDesc} onChange={(e) => setLinkDesc(e.target.value)} placeholder="Ex: Mapa da Estrada" className="w-full h-9 text-sm"/></div>
                <div className="flex-grow"><Label className="text-xs">URL</Label><Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://" className="w-full h-9 text-sm"/></div>
                <Button onClick={handleAddOrUpdateLink} type="button" size="icon" variant="outline" className="h-9 w-9 flex-shrink-0">
                  {editingLinkId ? <Save size={16} /> : <Plus size={16}/>}
                </Button>
              </div>
            </div>

            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          </form>
          <DialogFooter className="justify-between sm:justify-between pt-4 border-t">
            {user?.role === 'Administrador' ? (
              <Button variant="destructive" onClick={() => { onClose(); onDeleteRequest(); }} disabled={isLoading}>
                <Trash2 className="mr-2 h-4 w-4" /> Excluir
              </Button>
            ) : <div />}
            <div className="flex gap-2">
              <DialogClose asChild>
                <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
              </DialogClose>
              <Button type="submit" form="edit-rural-form" disabled={isLoading}>
                {isLoading ? <><Loader className="animate-spin mr-2" /> Salvando...</> : 'Salvar Alterações'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
  );
}
