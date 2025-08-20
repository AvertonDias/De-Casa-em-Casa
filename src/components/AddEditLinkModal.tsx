"use client";

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { RuralLink } from '@/types/types';

interface AddEditLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (linkData: Omit<RuralLink, 'id'>, id?: string) => void;
  linkToEdit?: RuralLink | null;
}

export default function AddEditLinkModal({ isOpen, onClose, onSave, linkToEdit }: AddEditLinkModalProps) {
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const isEditing = !!linkToEdit;

  useEffect(() => {
    if (isOpen) {
      if (isEditing && linkToEdit) {
        setDescription(linkToEdit.description);
        setUrl(linkToEdit.url);
      } else {
        setDescription('');
        setUrl('');
      }
      setError('');
    }
  }, [isOpen, linkToEdit, isEditing]);

  const handleSave = () => {
    if (!description.trim() || !url.trim()) {
      setError('A descrição e a URL são obrigatórias.');
      return;
    }
    try {
      new URL(url);
    } catch (_) {
      setError('Por favor, insira uma URL válida.');
      return;
    }
    
    onSave({ description, url }, linkToEdit?.id);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="relative bg-card text-card-foreground p-6 rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground"><X /></button>
        <h2 className="text-xl font-bold">{isEditing ? 'Editar Link' : 'Adicionar Novo Link'}</h2>
        <p className="text-sm text-muted-foreground mb-4">Preencha os detalhes do link abaixo.</p>
        
        <div className="space-y-4">
          <div>
            <label htmlFor="link-desc" className="block text-sm font-medium mb-1">Descrição</label>
            <input id="link-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex: Mapa de Estradas Vicinais" className="w-full bg-input rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-primary"/>
          </div>
          <div>
            <label htmlFor="link-url" className="block text-sm font-medium mb-1">URL</label>
            <input id="link-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" className="w-full bg-input rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-primary"/>
          </div>
          
          {error && <p className="text-sm text-red-500">{error}</p>}
          
          <div className="flex justify-end space-x-3 pt-4">
            <button onClick={onClose} className="px-4 py-2 rounded-md bg-muted hover:bg-muted/80">Cancelar</button>
            <button onClick={handleSave} className="px-4 py-2 rounded-md bg-primary text-primary-foreground">Salvar</button>
          </div>
        </div>
      </div>
    </div>
  );
}
