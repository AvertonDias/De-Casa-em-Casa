
"use client";

import { useState, useEffect, Fragment } from 'react';
import { useUser } from '@/contexts/UserContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, arrayUnion, Timestamp, deleteField, orderBy } from 'firebase/firestore';
import Link from 'next/link';
import { Search, MoreVertical, CheckCircle, RotateCw, Map, Trees, LayoutList, BookUser } from 'lucide-react';
import { Menu, Transition } from '@headlessui/react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import AssignTerritoryModal from './AssignTerritoryModal';
import ReturnTerritoryModal from './ReturnTerritoryModal';
import type { Territory, AppUser } from '@/types/types';

const FilterButton = ({ label, value, currentFilter, setFilter, Icon }: {
  label: string;
  value: string;
  currentFilter: string;
  setFilter: (value: any) => void;
  Icon: React.ElementType;
}) => (
  <button
    onClick={() => setFilter(value)}
    className={`flex items-center justify-center flex-grow sm:flex-grow-0 px-3 py-1.5 text-sm rounded-md transition-colors ${
      currentFilter === value 
      ? 'bg-primary text-primary-foreground font-semibold' 
      : 'bg-input hover:bg-white/5'
    }`}
  >
    <Icon size={16} className="mr-2"/>
    {label}
  </button>
);


const TerritoryListItem = ({ territory, onAssign, onReturn, onReassign }: { territory: Territory, onAssign: () => void, onReturn: () => void, onReassign: () => void }) => {
    const isDesignado = territory.status === 'designado' && territory.assignment;
    const assignment = territory.assignment;

    return (
        <div className="bg-card p-4 rounded-lg shadow-sm border-l-4 border-transparent hover:border-primary/50 transition-all">
            <div className="flex justify-between items-start">
                <Link
                  href={territory.type === 'rural' ? `/dashboard/rural/${territory.id}` : `/dashboard/territorios/${territory.id}`}
                  className="font-bold hover:text-primary transition-colors flex-1 min-w-0"
                >
                  <p className="truncate">{territory.number} - {territory.name}</p>
                </Link>
                 <Menu as="div" className="relative ml-2 flex-shrink-0">
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
                                {isDesignado ? (
                                    <>
                                        <Menu.Item>
                                            {({ active }) => (<button onClick={onReturn} className={`${active ? 'bg-accent text-accent-foreground' : ''} group flex rounded-md items-center w-full px-2 py-2 text-sm`}> <CheckCircle size={16} className="mr-2"/>Devolver</button>)}
                                        </Menu.Item>
                                        <Menu.Item>
                                            {({ active }) => (<button onClick={onReassign} className={`${active ? 'bg-accent text-accent-foreground' : ''} group flex rounded-md items-center w-full px-2 py-2 text-sm`}> <RotateCw size={16} className="mr-2"/>Reatribuir</button>)}
                                        </Menu.Item>
                                    </>
                                ) : (
                                     <Menu.Item>
                                        {({ active }) => (<button onClick={onAssign} className={`${active ? 'bg-accent text-accent-foreground' : ''} group flex rounded-md items-center w-full px-2 py-2 text-sm`}> <BookUser size={16} className="mr-2"/>Designar</button>)}
                                    </Menu.Item>
                                )}
                            </div>
                        </Menu.Items>
                    </Transition>
                </Menu>
            </div>
            <div className="mt-2 text-sm text-muted-foreground space-y-1">
                <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${isDesignado ? 'bg-yellow-400' : 'bg-green-400'}`}></span>
                    <span>Status:</span>
                    <span className="font-semibold">{isDesignado ? 'Designado' : 'Disponível'}</span>
                </div>
                 {isDesignado && assignment && (
                    <div className="flex items-center gap-2">
                        <span>→</span>
                        <span>{assignment.name} (até {format(assignment.dueDate.toDate(), 'dd/MM/yy')})</span>
                    </div>
                )}
            </div>
        </div>
    );
};


export default function TerritoryAssignmentPanel() {
  const { user: currentUser } = useUser();
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'disponivel' | 'designado'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'urban' | 'rural'>('all');
  
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false); 
  const [selectedTerritory, setSelectedTerritory] = useState<Territory | null>(null);

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
  
  useEffect(() => {
    if (!currentUser?.congregationId) return;
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('congregationId', '==', currentUser.congregationId), where('status', '==', 'ativo'), orderBy('name'));
    const unsub = onSnapshot(q, (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as AppUser)));
    });
    return () => unsub();
  }, [currentUser]);

  const handleOpenAssignModal = (territory: Territory) => {
    setSelectedTerritory(territory);
    setIsAssignModalOpen(true);
  };
  
  const handleSaveAssignment = async (territoryId: string, user: { uid: string; name: string }, assignmentDate: string, dueDate: string) => {
    if (!currentUser?.congregationId) return;
    const territoryRef = doc(db, 'congregations', currentUser.congregationId, 'territories', territoryId);
    const assignment = {
      uid: user.uid,
      name: user.name,
      assignedAt: Timestamp.fromDate(new Date(assignmentDate + 'T12:00:00')),
      dueDate: Timestamp.fromDate(new Date(dueDate + 'T12:00:00')),
    };
    await updateDoc(territoryRef, { status: 'designado', assignment });
  };

  const handleOpenReturnModal = (territory: Territory) => {
    setSelectedTerritory(territory);
    setIsReturnModalOpen(true);
  };
  
  const handleConfirmReturn = async (territoryId: string, returnDate: string) => {
    if (!currentUser?.congregationId) return;
    const territoryToReturn = territories.find(t => t.id === territoryId);
    if (!territoryToReturn || !territoryToReturn.assignment) return;
    
    const territoryRef = doc(db, 'congregations', currentUser.congregationId, 'territories', territoryId);
    
    const historyLog = {
      uid: territoryToReturn.assignment.uid,
      name: territoryToReturn.assignment.name,
      assignedAt: territoryToReturn.assignment.assignedAt,
      completedAt: Timestamp.fromDate(new Date(returnDate + 'T12:00:00')),
    };

    await updateDoc(territoryRef, {
      status: 'disponivel',
      assignment: deleteField(),
      assignmentHistory: arrayUnion(historyLog)
    });
  };
  
  const filteredTerritories = territories.filter(t => {
      const type = t.type || 'urban';
      const matchesType = typeFilter === 'all' || type === typeFilter;
      const matchesStatus = filterStatus === 'all' || (filterStatus === 'disponivel' ? t.status !== 'designado' : t.status === 'designado');
      const matchesSearch = searchTerm === '' || t.name.toLowerCase().includes(searchTerm.toLowerCase()) || t.number.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesType && matchesStatus && matchesSearch;
  }).sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));

  if(loading) return <div className="text-center p-8">Carregando dados...</div>

  return (
    <>
      <div className="bg-card p-4 sm:p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold mb-4">Designar Territórios</h2>

        <div className="flex flex-col sm:flex-row gap-2 mb-4 p-2 bg-input/40 rounded-lg">
          <FilterButton label="Todos" value="all" currentFilter={typeFilter} setFilter={setTypeFilter} Icon={LayoutList} />
          <FilterButton label="Urbanos" value="urban" currentFilter={typeFilter} setFilter={setTypeFilter} Icon={Map} />
          <FilterButton label="Rurais" value="rural" currentFilter={typeFilter} setFilter={setTypeFilter} Icon={Trees} />
        </div>
        
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
        
        {/* Lista para Mobile, Tabela para Desktop */}
        <div className="space-y-3 sm:hidden">
            {filteredTerritories.map(t => (
                <TerritoryListItem 
                    key={t.id} 
                    territory={t} 
                    onAssign={() => handleOpenAssignModal(t)}
                    onReturn={() => handleOpenReturnModal(t)}
                    onReassign={() => handleOpenAssignModal(t)}
                />
            ))}
        </div>

        <div className="overflow-x-auto hidden sm:block">
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
                  <td className="p-2 font-semibold">
                    <Link
                      href={t.type === 'rural' ? `/dashboard/rural/${t.id}` : `/dashboard/territorios/${t.id}`}
                      className="hover:text-primary transition-colors"
                    >
                      {t.number} - {t.name}
                    </Link>
                  </td>
                  <td className="p-2">{t.status === 'designado' ? <span className="text-yellow-400">Designado</span> : <span className="text-green-400">Disponível</span>}</td>
                  <td className="p-2">
                    {t.assignment ? `${t.assignment.name} (até ${format(t.assignment.dueDate.toDate(), 'dd/MM/yy', { locale: ptBR })})` : 'N/A'}
                  </td>
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
                                            {({ active }) => (<button onClick={() => handleOpenReturnModal(t)} className={`${active ? 'bg-accent text-accent-foreground' : ''} group flex rounded-md items-center w-full px-2 py-2 text-sm`}> <CheckCircle size={16} className="mr-2"/>Devolver</button>)}
                                        </Menu.Item>
                                        <Menu.Item>
                                            {({ active }) => (<button onClick={() => handleOpenAssignModal(t)} className={`${active ? 'bg-accent text-accent-foreground' : ''} group flex rounded-md items-center w-full px-2 py-2 text-sm`}> <RotateCw size={16} className="mr-2"/>Reatribuir</button>)}
                                        </Menu.Item>
                                    </div>
                                </Menu.Items>
                            </Transition>
                        </Menu>
                    ) : (
                        <button onClick={() => handleOpenAssignModal(t)} className="text-primary hover:underline font-semibold text-sm">Designar</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      <AssignTerritoryModal isOpen={isAssignModalOpen} onClose={() => setIsAssignModalOpen(false)} onSave={handleSaveAssignment} territory={selectedTerritory} users={users} />
      <ReturnTerritoryModal
        isOpen={isReturnModalOpen}
        onClose={() => setIsReturnModalOpen(false)}
        onConfirm={handleConfirmReturn}
        territory={selectedTerritory}
      />
    </>
  );
}
