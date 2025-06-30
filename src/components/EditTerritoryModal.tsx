"use client";

import { useState, useEffect, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Pencil, X, AlertTriangle, Loader } from 'lucide-react';
import { doc, updateDoc, deleteDoc, collection, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useUser } from '@/contexts/UserContext';
import { ConfirmationModal } from './ConfirmationModal'; 

interface Territory {
  id: string;
  number: string;
  name: string;
  description?: string;
  mapLink?: string;
  cardUrl?: string;
}

interface EditTerritoryModalProps {
  territory: Territory;
  onTerritoryUpdated: () => void;
  congregationId: string;
}

export function EditTerritoryModal({ territory, onTerritoryUpdated, congregationId }: EditTerritoryModalProps) {
  const { user } = useUser();
  const [isOpen, setIsOpen] = useState(false);

  const [formData, setFormData] = useState(territory);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [actionToConfirm, setActionToConfirm] = useState<'clean' | 'delete' | null>(null);

  useEffect(() => {
    if (isOpen) {
      setFormData(territory);
      setError(null);
    }
  }, [territory, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.id]: e.target.value }));
  };
  
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setLoading(true);
    setError('');

    if (!congregationId) {
      setError("ID da congregação não encontrado. Ação bloqueada.");
      setLoading(false);
      return;
    }

    const dataToUpdate = {
      number: formData.number,
      name: formData.name,
      description: formData.description || '',
      mapLink: formData.mapLink || '',
      cardUrl: formData.cardUrl || '',
    };

    try {
      const territoryRef = doc(db, 'congregations', congregationId, 'territories', territory.id);
      await updateDoc(territoryRef, dataToUpdate);
      setIsOpen(false);
      onTerritoryUpdated();
    } catch (err) {
      console.error("Erro ao atualizar território:", err);
      setError("Falha ao atualizar.");
    } finally {
      setLoading(false);
    }
  };
  
  const handleCleanTerritory = () => {
    setActionToConfirm('clean');
    setIsConfirmModalOpen(true);
  };

  const handleDeleteTerritory = () => {
    setActionToConfirm('delete');
    setIsConfirmModalOpen(true);
  };
  
  const handleConfirmAction = async () => {
    if (!territory || !user?.congregationId) return;

    setLoading(true);
    setError('');

    try {
      const territoryRef = doc(db, 'congregations', user.congregationId, 'territories', territory.id);

      if (actionToConfirm === 'clean') {
        const quadrasSnapshot = await getDocs(collection(territoryRef, 'quadras'));
        const batch = writeBatch(db);
        let updatesFound = false;

        for (const quadraDoc of quadrasSnapshot.docs) {
          const casasSnapshot = await getDocs(collection(quadraDoc.ref, 'casas'));
          if (!casasSnapshot.empty) {
            updatesFound = true;
            casasSnapshot.forEach(casaDoc => batch.update(casaDoc.ref, { status: false }));
          }
        }
        
        if (updatesFound) {
          await batch.commit();
        }
      } else if (actionToConfirm === 'delete') {
        await deleteDoc(territoryRef);
      }
      onTerritoryUpdated(); 
      setIsOpen(false); 
    } catch (err) {
      console.error(`Erro ao ${actionToConfirm} território:`, err);
      setError(`Não foi possível ${actionToConfirm === 'clean' ? 'limpar' : 'excluir'} o território.`);
    } finally {
      setLoading(false);
      setActionToConfirm(null);
    }
  };

  return (
    <>
      <button 
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(true);
        }} 
        className="flex items-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg"
      >
        <Pencil className="h-4 w-4 mr-2" /> Editar Território
      </button>

      <Transition.Root show={isOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setIsOpen(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/60" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-[#2a2736] p-6 text-left align-middle shadow-xl transition-all">
                  <Dialog.Title as="h3" className="text-lg font-bold leading-6 text-white flex justify-between items-center">
                    Editar Território
                    <button onClick={() => setIsOpen(false)} className="p-1 rounded-full hover:bg-white/10"><X size={20} /></button>
                  </Dialog.Title>

                  <form onSubmit={handleUpdate} className="mt-4 space-y-4">
                    <div className="flex space-x-4">
                      <div className="flex-1">
                        <label htmlFor="number" className="text-sm font-medium text-gray-400">Número</label>
                        <input id="number" value={formData.number} onChange={handleChange} className="w-full mt-1 bg-gray-800 text-white rounded px-3 py-2 border border-gray-700" />
                      </div>
                      <div className="flex-grow">
                        <label htmlFor="name" className="text-sm font-medium text-gray-400">Nome</label>
                        <input id="name" value={formData.name} onChange={handleChange} className="w-full mt-1 bg-gray-800 text-white rounded px-3 py-2 border border-gray-700" />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="description" className="text-sm font-medium text-gray-400">Descrição</label>
                      <textarea id="description" value={formData.description || ''} onChange={handleChange} rows={3} className="w-full mt-1 bg-gray-800 text-white rounded px-3 py-2 border border-gray-700" />
                    </div>
                    <div>
                      <label htmlFor="mapLink" className="text-sm font-medium text-gray-400">Link do Mapa</label>
                      <input id="mapLink" value={formData.mapLink || ''} onChange={handleChange} className="w-full mt-1 bg-gray-800 text-white rounded px-3 py-2 border border-gray-700" />
                    </div>
                    <div>
                      <label htmlFor="cardUrl" className="text-sm font-medium text-gray-400">URL do Cartão</label>
                      <input id="cardUrl" value={formData.cardUrl || ''} onChange={handleChange} className="w-full mt-1 bg-gray-800 text-white rounded px-3 py-2 border border-gray-700" />
                    </div>
                    <div className="flex justify-end mt-6">
                      <button type="submit" disabled={loading} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">
                        {loading && !actionToConfirm ? 'Salvando...' : 'Salvar Alterações'}
                      </button>
                    </div>
                  </form>
                  
                  {user?.role === 'Administrador' && (
                    <div className="mt-6 pt-4 border-t border-red-500/30">
                      <h4 className="flex items-center text-md font-semibold text-red-400">
                        <AlertTriangle size={18} className="mr-2"/> Ações de Risco
                      </h4>
                      <div className="flex space-x-2 mt-2">
                          <button type="button" onClick={handleCleanTerritory} disabled={loading} className="flex-1 bg-yellow-500/20 text-yellow-300 py-2 rounded-md hover:bg-yellow-500/30 transition-colors disabled:opacity-50">
                              Limpar Território
                          </button>
                          <button type="button" onClick={handleDeleteTerritory} disabled={loading} className="flex-1 bg-red-500/20 text-red-300 py-2 rounded-md hover:bg-red-500/30 transition-colors disabled:opacity-50">
                              {loading && actionToConfirm === 'delete' ? <Loader className="mx-auto animate-spin"/> : 'Excluir Território'}
                          </button>
                      </div>
                      {error && <p className="text-red-400 text-sm text-center mt-2">{error}</p>}
                    </div>
                  )}
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition.Root>
      
      <ConfirmationModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={handleConfirmAction}
        title={actionToConfirm === 'clean' ? "Limpar Território?" : "Excluir Território?"}
        message={
          actionToConfirm === 'clean'
            ? "Esta ação irá marcar todas as casas deste território como 'não trabalhadas', reiniciando o progresso. Deseja continuar?"
            : "Esta ação é irreversível e irá apagar permanentemente este território, incluindo todas as suas quadras e casas. Você tem certeza absoluta?"
        }
        confirmButtonText={actionToConfirm === 'clean' ? "Sim, Limpar" : "Sim, Excluir"}
      />
    </>
  );
}
