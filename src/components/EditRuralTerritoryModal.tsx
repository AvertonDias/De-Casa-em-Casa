"use client";

import { useState, useEffect, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { MapPin, X } from 'lucide-react';

interface RuralTerritory {
  id: string;
  number: string;
  name: string;
  description: string;
  mapLink: string;
}

interface EditRuralTerritoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTerritoryUpdated: () => void;
  congregationId: string;
  territory: RuralTerritory | null; 
}

export function EditRuralTerritoryModal({ isOpen, onClose, onTerritoryUpdated, congregationId, territory }: EditRuralTerritoryModalProps) {
  const [number, setNumber] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [mapLink, setMapLink] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (territory) {
      setNumber(territory.number);
      setName(territory.name);
      setDescription(territory.description || '');
      setMapLink(territory.mapLink || '');
    }
  }, [territory]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!territory) return; 
    
    setIsLoading(true);
    setError('');

    try {
      const territoryRef = doc(db, 'congregations', congregationId, 'territories', territory.id);
      await updateDoc(territoryRef, {
        number: number,
        name: name,
        description: description,
        mapLink: mapLink,
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
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
          <div className="fixed inset-0 bg-black/60" />
        </Transition.Child>
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white dark:bg-[#2a2736] p-6 text-left align-middle shadow-xl transition-all">
               <div className="flex items-center justify-between mb-4">
                    <Dialog.Title as="h3" className="text-xl font-bold leading-6 text-gray-900 dark:text-white">Editar Território Rural</Dialog.Title>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"><X size={20}/></button>
               </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <input type="text" value={number} onChange={(e) => setNumber(e.target.value)} placeholder="Número" required className="w-full px-4 py-2 text-white bg-[#1e1b29] border border-gray-600 rounded-md" />
                      <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome" required className="w-full px-4 py-2 text-white bg-[#1e1b29] border border-gray-600 rounded-md" />
                  </div>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Observações" rows={4} className="w-full px-4 py-2 text-white bg-[#1e1b29] border border-gray-600 rounded-md"></textarea>
                  <input type="url" value={mapLink} onChange={(e) => setMapLink(e.target.value)} placeholder="Link do Google Maps" className="w-full px-4 py-2 text-white bg-[#1e1b29] border border-gray-600 rounded-md" />
                  
                  {error && <p className="text-red-500 text-sm">{error}</p>}

                  <div className="flex justify-end pt-4">
                    <button type="submit" disabled={isLoading} className="px-6 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 disabled:bg-purple-900">
                      {isLoading ? "Salvando..." : "Salvar Alterações"}
                    </button>
                  </div>
              </form>
            </Dialog.Panel>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
