
"use client";

import { useState, useEffect, useRef } from "react";
import { app } from "@/lib/firebase";
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useUser } from "@/contexts/UserContext"; 
import { Territory } from "@/types/types";
import { X, AlertCircle, FileImage, Loader } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

const functions = getFunctions(app, 'southamerica-east1');
const resetTerritoryProgressFn = httpsCallable(functions, 'resetTerritoryProgress');

interface EditTerritoryModalProps {
  territory: Territory;
  isOpen: boolean;
  onClose: () => void;
  onSave: (territoryId: string, updatedData: Partial<Territory>) => void;
  onReset: (territoryId: string) => void;
  onDelete: (territoryId: string) => void;
}

export default function EditTerritoryModal({ territory, isOpen, onClose, onSave, onReset, onDelete }: EditTerritoryModalProps) {
  const { user } = useUser();
  const isAdmin = user?.role === 'Administrador';
  const { toast } = useToast();

  const [number, setNumber] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [mapLink, setMapLink] = useState('');
  
  const [cardUrl, setCardUrl] = useState(''); 
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const numberInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && territory) {
      setNumber(territory.number || '');
      setName(territory.name || '');
      setDescription(territory.description || '');
      setMapLink(territory.mapLink || '');
      setCardUrl(territory.cardUrl || '');
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      setPreviewUrl(null);
      setError(null);

      setTimeout(() => {
        numberInputRef.current?.focus();
        numberInputRef.current?.select();
      }, 100);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [territory, isOpen]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = event.target.files ? event.target.files[0] : null;

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    if (file) {
      if (file.size > 5 * 1024 * 1024) { // Limite de 5MB
        setError("O arquivo excede 5MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const newCardUrl = reader.result as string;
        setPreviewUrl(newCardUrl); 
        setCardUrl(newCardUrl);
      };
      reader.readAsDataURL(file);
    } else {
      setCardUrl(territory.cardUrl || ''); // Reverte para a URL original se o usuário cancelar
    }
  };
  
  const handleSave = async () => {
    if (isAdmin && (!number || !name)) {
      setError("Número e Nome são obrigatórios.");
      return;
    }
    setIsProcessing(true);
    setError(null);

    const dataToSave: Partial<Territory> = {
      description,
    };

    if (isAdmin) {
      dataToSave.number = number;
      dataToSave.name = name;
      dataToSave.mapLink = mapLink;
      dataToSave.cardUrl = previewUrl || cardUrl;
    }

    await onSave(territory.id, dataToSave);

    setIsProcessing(false);
    onClose();
  };
  
  const handleResetRequest = async () => {
    if (!isAdmin || !user?.congregationId) return;

    setIsProcessing(true);
    try {
      const result:any = await resetTerritoryProgressFn({ 
        congregationId: user.congregationId, 
        territoryId: territory.id 
      });
      
      const { success, message } = result.data;
      if (!success) {
        throw new Error(message || 'Falha ao limpar o território.');
      }
      
      toast({
        title: "Sucesso!",
        description: message,
      });

    } catch (error: any) {
      console.error("Erro ao limpar território:", error);
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      onClose(); // Fecha o modal principal após a ação
    }
  };


  const handleClose = () => {
    onClose();
  };

  const hasChanges = territory && (
    number !== territory.number ||
    name !== territory.name ||
    description !== (territory.description || '') ||
    mapLink !== (territory.mapLink || '') ||
    (previewUrl || cardUrl) !== (territory.cardUrl || '')
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="relative bg-card text-card-foreground p-6 rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <button onClick={handleClose} disabled={isProcessing} className="absolute top-4 right-4 text-muted-foreground"><X /></button>
        <h2 className="text-xl font-bold">Editar Território</h2>
        <p className="text-sm text-muted-foreground mb-4">Faça alterações nos dados do território. Ações de risco como limpar ou excluir só estão disponíveis para Administradores.</p>

        <div className="space-y-4 mt-4">
          <div className="flex items-center gap-4">
            <div className="w-28">
                <label className="block text-sm font-medium mb-1">Número</label>
                <input 
                    ref={numberInputRef}
                    value={number} 
                    onChange={(e) => setNumber(e.target.value)} 
                    disabled={!isAdmin}
                    className="w-full bg-input rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-70 disabled:cursor-not-allowed"
                />
            </div>
            <div className="flex-grow">
                <label className="block text-sm font-medium mb-1">Nome</label>
                <input 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    disabled={!isAdmin}
                    className="w-full bg-input rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-70 disabled:cursor-not-allowed"
                />
            </div>
          </div>
          <div><label>Observações (Opcional)</label><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full bg-input rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-primary"></textarea></div>

          {isAdmin && (
            <div className="border-t border-border pt-4 mt-4 space-y-4">
              <div><label>Link do Mapa (Opcional)</label><input value={mapLink} onChange={(e) => setMapLink(e.target.value)} className="w-full bg-input rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-primary"/></div>
              
              <div>
                <label className="block text-sm mb-1">Imagem do Cartão (Opcional)</label>
                <div className="mt-1 flex justify-center items-center rounded-lg border border-dashed border-gray-500 min-h-[12rem] p-2">
                  {previewUrl || cardUrl ? (
                    <img src={previewUrl || cardUrl} alt="Preview do cartão" className="max-h-40 object-contain rounded-md" />
                  ) : (
                    <div className="text-center">
                      <FileImage className="mx-auto h-12 w-12 text-gray-400" />
                      <p className="text-sm text-muted-foreground">Nenhuma imagem</p>
                    </div>
                  )}
                </div>
                <div className="text-center mt-2">
                   <label htmlFor="edit-file-upload" className="cursor-pointer text-sm font-semibold text-primary hover:underline">Alterar Imagem</label>
                   <input id="edit-file-upload" type="file" className="sr-only" onChange={handleFileChange} accept="image/*" />
                </div>
              </div>

              <div className="border-t border-red-500/30 pt-4 mt-4">
                <h3 className="text-red-400 font-semibold flex items-center mb-2"><AlertCircle className="mr-2"/>Ações de Risco</h3>
                <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => onReset(territory.id)} className="p-2 border border-yellow-500 text-yellow-500 rounded-md hover:bg-yellow-500/20">Limpar Território</button>
                  <button onClick={() => onDelete(territory.id)} className="p-2 bg-red-600 text-white rounded-md hover:bg-red-700">Excluir Território</button>
                </div>
              </div>
            </div>
          )}
          
          {error && (<p className="text-sm text-red-500 text-center">{error}</p>)}

          <div className="flex justify-end space-x-3 pt-4 border-t border-border mt-4">
            <button onClick={handleClose} disabled={isProcessing} className="px-4 py-2 rounded-md bg-muted hover:bg-muted/80">Cancelar</button>
            <button onClick={handleSave} disabled={isProcessing || !hasChanges} className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/80 disabled:opacity-50">
                {isProcessing ? <><Loader className="mr-2 h-4 w-4 animate-spin" /> Salvando...</> : "Salvar Alterações"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
