"use client";

import { useState, useEffect } from "react";
import { useUser } from "@/contexts/UserContext"; 
import { Territory } from "@/types/types";
import { X, AlertCircle, FileImage, Loader } from 'lucide-react';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { app } from '@/lib/firebase';

interface EditTerritoryModalProps {
  territory: Territory;
  isOpen: boolean;
  onClose: () => void;
  onSave: (territoryId: string, updatedData: Partial<Territory>) => void;
  onReset: (territoryId: string) => void;
  onDelete: (territoryId: string) => void;
}

const storage = getStorage(app);

export default function EditTerritoryModal({ territory, isOpen, onClose, onSave, onReset, onDelete }: EditTerritoryModalProps) {
  const { user } = useUser();
  const isAdmin = user?.role === 'Administrador';

  const [number, setNumber] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [mapLink, setMapLink] = useState('');
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null); // For local file previews
  const [currentCardUrl, setCurrentCardUrl] = useState<string>(''); // For existing URL

  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && territory) {
      setNumber(territory.number || '');
      setName(territory.name || '');
      setDescription(territory.description || '');
      setMapLink(territory.mapLink || '');
      setCurrentCardUrl(territory.cardUrl || '');
      
      // Reset file-related states
      setSelectedFile(null);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setError(null);
    }
  }, [territory, isOpen]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = event.target.files ? event.target.files[0] : null;

    if (previewUrl) URL.revokeObjectURL(previewUrl);

    if (file) {
      if (file.size > 5 * 1024 * 1024) { setError("O arquivo excede 5MB."); return; }
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      setSelectedFile(null);
    }
  };
  
  const handleSave = async () => {
    if (!number || !name || !user?.congregationId) { setError("Número e Nome são obrigatórios."); return; }
    setIsProcessing(true); setError(null);
    
    try {
      let uploadedCardUrl = currentCardUrl;

      if (selectedFile) {
        // Se há uma nova imagem, faz o upload dela
        const filePath = `congregations/${user.congregationId}/territory_cards/${Date.now()}-${selectedFile.name}`;
        const storageRef = ref(storage, filePath);
        const uploadResult = await uploadBytes(storageRef, selectedFile);
        uploadedCardUrl = await getDownloadURL(uploadResult.ref);

        // Se havia uma imagem antiga, tenta deletá-la
        if (currentCardUrl) {
          try {
            const oldImageRef = ref(storage, currentCardUrl);
            await deleteObject(oldImageRef);
          } catch (deleteError: any) {
            // Não bloqueia o fluxo se a imagem antiga não puder ser deletada, apenas avisa.
            console.warn("Não foi possível deletar a imagem antiga:", deleteError);
          }
        }
      }
      
      const baseData = { number, name, description };
      const adminData = isAdmin ? { mapLink, cardUrl: uploadedCardUrl } : {};
      
      await onSave(territory.id, { ...baseData, ...adminData });
      
      handleClose();

    } catch(saveError: any) {
      console.error("Erro ao salvar:", saveError);
      setError(saveError.message || "Erro ao salvar o território. Tente novamente.");
    } finally {
        setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setSelectedFile(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="relative bg-card text-card-foreground p-6 rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <button onClick={handleClose} disabled={isProcessing} className="absolute top-4 right-4 text-muted-foreground"><X /></button>
        <h2 className="text-xl font-bold">Editar Território</h2>
        
        <div className="space-y-4 mt-4">
          <div className="flex items-center gap-4">
            <div className="w-28"><label className="block text-sm font-medium mb-1">Número</label><input value={number} onChange={(e) => setNumber(e.target.value)} className="w-full bg-input rounded-md p-2"/></div>
            <div className="flex-grow"><label className="block text-sm font-medium mb-1">Nome</label><input value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-input rounded-md p-2"/></div>
          </div>
          <div><label>Observações (Opcional)</label><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full bg-input rounded-md p-2"></textarea></div>

          {isAdmin && (
            <div className="border-t border-border pt-4 mt-4 space-y-4">
              <div><label>Link do Mapa (Opcional)</label><input value={mapLink} onChange={(e) => setMapLink(e.target.value)} className="w-full bg-input rounded-md p-2"/></div>
              
              <div>
                <label className="block text-sm mb-1">Imagem do Cartão (Opcional)</label>
                <div className="mt-1 flex justify-center items-center rounded-lg border border-dashed border-gray-500 min-h-[12rem] p-2">
                  {previewUrl || currentCardUrl ? (
                    <img src={previewUrl || currentCardUrl} alt="Preview do cartão" className="max-h-40 object-contain rounded-md" />
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
            <button onClick={handleSave} disabled={isProcessing} className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/80">
                {isProcessing ? <><Loader className="mr-2 h-4 w-4 animate-spin" /> Salvando...</> : "Salvar Alterações"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
