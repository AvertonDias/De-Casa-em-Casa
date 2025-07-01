"use client";

import { useState, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { MapPin, X } from 'lucide-react';

interface AddRuralTerritoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTerritoryAdded: () => void;
  congregationId: string;
}

export function AddRuralTerritoryModal({ isOpen, onClose, onTerritoryAdded, congregationId }: AddRuralTerritoryModalProps) {
  const [number, setNumber] = useState('');
  const [name, setName] = useState('');
  const [observations, setObservations] = useState('');
  const [mapLink, setMapLink] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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
        description: observations, // compatibility with existing fields
        mapLink: mapLink,
        type: 'rural', // Importante para diferenciar dos territórios urbanos
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
    // Limpa os campos ao fechar
    setNumber('');
    setName('');
    setObservations('');
    setMapLink('');
    setError('');
    onClose();
  }

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
        <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
          <div className="fixed inset-0 bg-black/60" />
        </Transition.Child>
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white dark:bg-[#2a2736] p-6 text-left align-middle shadow-xl transition-all">
               <div className="flex items-center justify-between mb-4">
                    <Dialog.Title as="h3" className="text-xl font-bold leading-6 text-gray-900 dark:text-white">Adicionar Território Rural</Dialog.Title>
                    <button onClick={handleClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"><X size={20}/></button>
               </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input type="text" value={number} onChange={(e) => setNumber(e.target.value)} placeholder="Número (Ex: R01)" required className="w-full px-4 py-2 text-white bg-[#1e1b29] border border-gray-600 rounded-md" />
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome (Ex: Bairro da Usina)" required className="w-full px-4 py-2 text-white bg-[#1e1b29] border border-gray-600 rounded-md" />
                </div>
                <textarea value={observations} onChange={(e) => setObservations(e.target.value)} placeholder="Observações (Ex: Pegar estrada de terra após a ponte...)" rows={4} className="w-full px-4 py-2 text-white bg-[#1e1b29] border border-gray-600 rounded-md"></textarea>
                <input type="url" value={mapLink} onChange={(e) => setMapLink(e.target.value)} placeholder="Link do Google Maps (Opcional)" className="w-full px-4 py-2 text-white bg-[#1e1b29] border border-gray-600 rounded-md" />
                
                {error && <p className="text-red-500 text-sm">{error}</p>}

                <div className="flex justify-end pt-4">
                  <button type="submit" disabled={isLoading} className="px-6 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 disabled:bg-purple-900">
                    {isLoading ? "Salvando..." : "Salvar Território"}
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
