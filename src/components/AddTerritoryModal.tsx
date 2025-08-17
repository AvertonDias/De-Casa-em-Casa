"use client";

import { useState } from "react";
import { useUser } from "@/contexts/UserContext"; 
import { X, FileImage, Loader } from 'lucide-react';
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { app } from '@/lib/firebase';

interface AddTerritoryModalProps {
  isOpen: boolean; onClose: () => void; onSave: (data: Partial<NewTerritoryData>) => Promise<void>;
}

interface NewTerritoryData {
  number: string; name: string; description: string; mapLink: string; 
  cardUrl: string;
  type: 'urban';
}

const storage = getStorage(app);

export default function AddTerritoryModal({ isOpen, onClose, onSave }: AddTerritoryModalProps) {
  const { user } = useUser();
  const [number, setNumber] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [mapLink, setMapLink] = useState('');
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = event.target.files ? event.target.files[0] : null;

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }

    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError("O arquivo é muito grande. O limite é de 5MB.");
        return;
      }
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      setSelectedFile(null);
    }
  };
  
  const removeSelectedImage = () => {
    setSelectedFile(null);
    if(previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  }

  const handleSave = async () => {
    if (!number || !name || !user?.congregationId) { 
      setError("Número e Nome são obrigatórios."); return; 
    }
    setIsProcessing(true); setError(null);
    
    let uploadedCardUrl = '';
    
    try {
      if (selectedFile) {
        const filePath = `congregations/${user.congregationId}/territory_cards/${Date.now()}-${selectedFile.name}`;
        const storageRef = ref(storage, filePath);
        
        const uploadResult = await uploadBytes(storageRef, selectedFile);
        uploadedCardUrl = await getDownloadURL(uploadResult.ref);
      }
    
      const newTerritoryData: Partial<NewTerritoryData> = {
          number, name, description, mapLink, 
          cardUrl: uploadedCardUrl,
          type: 'urban',
      };
    
      await onSave(newTerritoryData);
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
    setSelectedFile(null);
    if(previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null); 
    setError(null); 
    setIsProcessing(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="relative bg-card text-card-foreground p-6 rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <button onClick={handleClose} className="absolute top-4 right-4"><X/></button>
        <h2 className="text-xl font-bold">Adicionar Novo Território</h2>
        <p className="text-sm text-muted-foreground mb-6">Preencha os detalhes do novo território abaixo.</p>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-28"><label className="block text-sm mb-1">Número</label><input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="Ex: 12" className="w-full bg-input p-2 rounded-md"/></div>
            <div className="flex-grow"><label className="block text-sm mb-1">Nome</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Centro Comercial" className="w-full bg-input p-2 rounded-md"/></div>
          </div>
          <div><label>Observações (Opcional)</label><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Ex: Território da prefeitura..." className="w-full bg-input p-2 rounded-md"></textarea></div>
          <div><label>Link do Mapa (Opcional)</label><input value={mapLink} onChange={(e) => setMapLink(e.target.value)} placeholder="https://maps.google.com/..." className="w-full bg-input p-2 rounded-md"/></div>
          <div>
            <label className="block text-sm font-medium mb-1">Imagem do Cartão (Opcional)</label>
            <div className="mt-1 flex justify-center items-center rounded-lg border border-dashed border-gray-500 min-h-[12rem] relative group">
              {previewUrl ? (<><img src={previewUrl} alt="Preview" className="max-h-32 object-contain rounded-md" /><button onClick={removeSelectedImage} className="absolute top-2 right-2 bg-red-600/80 text-white rounded-full p-1 opacity-0 group-hover:opacity-100"><X size={16} /></button></>) : (<div className="text-center"><FileImage className="mx-auto h-12 w-12 text-gray-400" /><label htmlFor="file-upload" className="cursor-pointer font-semibold text-primary"><span>Selecione um arquivo</span><input id="file-upload" type="file" className="sr-only" onChange={handleFileChange} accept="image/*"/></label><p className="text-xs text-gray-500">PNG, JPG até 5MB</p></div>)}
            </div>
          </div>
          {error && (<p className="text-sm text-red-500 text-center">{error}</p>)}
          <div className="flex justify-end space-x-3 pt-4">
            <button onClick={handleClose} className="px-4 py-2 rounded-md bg-muted">Cancelar</button>
            <button onClick={handleSave} disabled={isProcessing} className="px-4 py-2 rounded-md bg-primary text-primary-foreground">
              {isProcessing ? <><Loader className="mr-2 h-4 w-4 animate-spin" /> Salvando...</> : "Salvar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
