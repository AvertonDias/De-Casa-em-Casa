"use client";

import { useState, useEffect, useContext, Fragment } from 'react';
import { UserContext } from '@/contexts/UserContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp, arrayUnion, Timestamp, deleteField } from 'firebase/firestore';
import { Search, MoreVertical, CheckCircle, RotateCw } from 'lucide-react';
import { Menu, Transition } from '@headlessui/react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import AssignTerritoryModal from './AssignTerritoryModal';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import type { Territory, AppUser } from '@/types/types';

export default function TerritoryAssignmentPanel() {
  const { user: currentUser } = useContext(UserContext);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Estados para UI
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'disponivel' | 'designado'>('all');
  
  // Estados para Modais
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [selectedTerritory, setSelectedTerritory] = useState<Territory | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ action: () => void, title: string, message: string, confirmText: string } | null>(null);

  // Busca todos os territórios da congregação
  useEffect(() => {
    if (!currentUser?.congregationId) return;
    const terRef = collection(db, 'congregations', currentUser.congregationId, 'territories');
    const unsub = onSnapshot(query(terRef, orderBy('number')), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Territory));
      setTerritories(data);
      setLoading(false);
    });
    return () => unsub();
  }, [currentUser]);
  
  // Busca todos os usuários que podem receber territórios
  useEffect(() => {
    if (!currentUser?.congregationId) return;
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('congregationId', '==', currentUser.congregationId), where('status', '==', 'ativo'), orderBy('name'));
    const unsub = onSnapshot(q, (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }) as AppUser));
    });
    return () => unsub();
  }, [currentUser]);

  const handleOpenModal = (territory: Territory) => {
    setSelectedTerritory(territory);
    setIsAssignModalOpen(true);
  };
  
  const handleSaveAssignment = async (territoryId: string, user: { uid: string; name: string }, dueDate: string) => {
    if (!currentUser?.congregationId) return;
    const territoryRef = doc(db, 'congregations', currentUser.congregationId, 'territories', territoryId);
    const assignment = {
      uid: user.uid,
      name: user.name,
      assignedAt: serverTimestamp(),
      dueDate: Timestamp.fromDate(new Date(dueDate)),
    };
    await updateDoc(territoryRef, { status: 'designado', assignment });
  };

  const handleReturnTerritory = (territory: Territory) => {
    if (!territory.assignment) return;
    setConfirmAction({
        action: async () => {
            if (!currentUser?.congregationId || !territory.assignment) return;
            
            const territoryRef = doc(db, 'congregations', currentUser.congregationId, 'territories', territory.id);
            
            const historyLog = {
                uid: territory.assignment.uid,
                name: territory.assignment.name,
                assignedAt: territory.assignment.assignedAt,
                completedAt: serverTimestamp(),
            };

            await updateDoc(territoryRef, {
                status: 'disponivel',
                assignment: deleteField(),
                assignmentHistory: arrayUnion(historyLog)
            });
            setIsConfirmModalOpen(false);
        },
        title: "Confirmar Devolução",
        message: `Confirmar a devolução do território "${territory.name}" por ${territory.assignment?.name}?`,
        confirmText: 'Sim, devolver'
    });
    setIsConfirmModalOpen(true);
  };
  
  const filteredTerritories = territories.filter(t => {
      const matchesStatus = filterStatus === 'all' || (filterStatus === 'disponivel' ? t.status !== 'designado' : t.status === 'designado');
      const matchesSearch = searchTerm === '' || t.name.toLowerCase().includes(searchTerm.toLowerCase()) || t.number.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesStatus && matchesSearch;
  }).sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));

  return (
    <>
      <div className="bg-card p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold mb-4">Designar Territórios</h2>
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
            <input type="text" placeholder="Buscar por nome ou número..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-input rounded-md p-2 pl-10 border border-border"/>
          </div>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)} className="bg-input rounded-md p-2 border border-border">
            <option value="all">Todos os status</option>
            <option value="disponivel">Disponível</option>
            <option value="designado">Designado</option>
          </select>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border">
                <th className="p-2">Território</th>
                <th className="p-2">Status</th>
                <th className="p-2">Designado a</th>
                <th className="p-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredTerritories.map(t => (
                <tr key={t.id} className="border-b border-border last:border-b-0">
                  <td className="p-2 font-semibold">{t.number} - {t.name}</td>
                  <td className="p-2">{t.status === 'designado' ? <span className="text-yellow-400">Designado</span> : <span className="text-green-400">Disponível</span>}</td>
                  <td className="p-2">{t.assignment ? `${t.assignment.name} (até ${format(t.assignment.dueDate.toDate(), 'dd/MM/yy', { locale: ptBR })})` : 'N/A'}</td>
                  <td className="p-2 text-right">
                    {t.status === 'designado' && t.assignment ? (
                        <Menu as="div" className="relative inline-block text-left">
                            <Menu.Button className="p-1 rounded-full hover:bg-white/10">
                                <MoreVertical size={20} />
                            </Menu.Button>
                            <Transition
                                as={Fragment}
                                enter="transition ease-out duration-100"
                                enterFrom="transform opacity-0 scale-95"
                                enterTo="transform opacity-100 scale-100"
                                leave="transition ease-in duration-75"
                                leaveFrom="transform opacity-100 scale-100"
                                leaveTo="transform opacity-0 scale-95"
                            >
                                <Menu.Items className="absolute right-0 mt-2 w-48 origin-top-right bg-popover text-popover-foreground rounded-md shadow-lg z-10 ring-1 ring-black ring-opacity-5 focus:outline-none">
                                    <div className="p-1">
                                        <Menu.Item>
                                            {({ active }) => (<button onClick={() => handleReturnTerritory(t)} className={`${active ? 'bg-accent text-accent-foreground' : ''} group flex rounded-md items-center w-full px-2 py-2 text-sm`}> <CheckCircle size={16} className="mr-2"/>Devolver</button>)}
                                        </Menu.Item>
                                        <Menu.Item>
                                            {({ active }) => (<button onClick={() => handleOpenModal(t)} className={`${active ? 'bg-accent text-accent-foreground' : ''} group flex rounded-md items-center w-full px-2 py-2 text-sm`}> <RotateCw size={16} className="mr-2"/>Reatribuir</button>)}
                                        </Menu.Item>
                                    </div>
                                </Menu.Items>
                            </Transition>
                        </Menu>
                    ) : (
                        <button onClick={() => handleOpenModal(t)} className="text-primary hover:underline font-semibold text-sm">Designar</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      <AssignTerritoryModal isOpen={isAssignModalOpen} onClose={() => setIsAssignModalOpen(false)} onSave={handleSaveAssignment} territory={selectedTerritory} users={users} />
      {confirmAction && <ConfirmationModal isOpen={isConfirmModalOpen} onClose={() => setIsConfirmModalOpen(false)} onConfirm={confirmAction.action} title={confirmAction.title} message={confirmAction.message} confirmText={confirmAction.confirmText}/>}
    </>
  );
}