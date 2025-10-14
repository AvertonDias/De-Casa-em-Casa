
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useUser } from '@/contexts/UserContext';
import { db, app } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Loader, Search, SlidersHorizontal, ChevronUp, X, Users as UsersIcon, Wifi, Check } from 'lucide-react';
import { Disclosure, Transition } from '@headlessui/react';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { UserListItem } from './UserListItem';
import { subDays, subMonths, subHours } from 'date-fns';
import type { AppUser, Congregation } from '@/types/types';

const functions = getFunctions(app, 'southamerica-east1');
const deleteUserAccountFn = httpsCallable(functions, 'deleteUserAccount');


export default function UserManagement() {
  const { user: currentUser, loading: userLoading } = useUser(); 

  const [users, setUsers] = useState<AppUser[]>([]);
  const [congregation, setCongregation] = useState<Congregation | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [presenceFilter, setPresenceFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [roleFilter, setRoleFilter] = useState<'all' | 'Administrador' | 'Dirigente' | 'Publicador'>('all');
  const [activityFilter, setActivityFilter] = useState<'all' | 'active_hourly' | 'active_weekly' | 'inactive'>('all');

  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<{uid: string, name: string} | null>(null);
  
  const confirmDeleteUser = useCallback(async () => {
    if (!userToDelete || !currentUser || currentUser.role !== 'Administrador' || currentUser.uid === userToDelete.uid) return;
    
    setIsConfirmModalOpen(false);
    try {
        await deleteUserAccountFn({ userIdToDelete: userToDelete.uid });
    } catch (error: any) {
        console.error("Erro ao chamar a função para excluir usuário:", error);
    } finally {
        setUserToDelete(null);
    }
  }, [userToDelete, currentUser]);
  
  const openDeleteConfirm = useCallback((userId: string, userName: string) => {
    if (currentUser?.role !== 'Administrador') return;
    setUserToDelete({uid: userId, name: userName});
    setIsConfirmModalOpen(true);
  }, [currentUser?.role]);


  useEffect(() => {
    if (currentUser?.congregationId) {
      setLoading(true);
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where("congregationId", "==", currentUser.congregationId));
      const unsubUsers = onSnapshot(q, (snapshot) => {
        setUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() })) as AppUser[]);
        setLoading(false);
      }, (error) => {
        console.error("Erro ao buscar usuários:", error);
        setLoading(false);
      });

      const congRef = doc(db, 'congregations', currentUser.congregationId);
      const unsubCong = onSnapshot(congRef, (docSnap) => {
        if (docSnap.exists()) {
          setCongregation({ id: docSnap.id, ...docSnap.data() } as Congregation);
        }
      });

      return () => { 
        unsubUsers(); 
        unsubCong(); 
      };
    } else if (!userLoading) {
      setLoading(false);
    }
  }, [currentUser, userLoading]);
  
  const handleUserUpdate = useCallback(async (userId: string, dataToUpdate: object) => {
    try {
      if (!currentUser) return;
      const permissions = dataToUpdate as Partial<AppUser>;
      if (currentUser.role !== 'Administrador') {
        if (permissions.role) {
          console.error("Apenas administradores podem alterar perfis.");
          return;
        }
      }
      if (currentUser.uid === userId && permissions.role && permissions.role !== 'Administrador') {
          alert("Você não pode rebaixar a si mesmo.");
          return;
      }
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, dataToUpdate);
    } catch (error) {
      console.error("Erro ao atualizar usuário:", error);
    }
  }, [currentUser]);

  const stats = useMemo(() => {
    const onlineCount = users.filter(u => u.isOnline === true).length;
    const pendingCount = users.filter(u => u.status === 'pendente').length;
    return {
      total: users.length,
      online: onlineCount,
      offline: users.length - onlineCount,
      pending: pendingCount
    };
  }, [users]);

  const filteredAndSortedUsers = useMemo(() => {
    let filtered = [...users];

    if (presenceFilter !== 'all') {
      filtered = filtered.filter(user => (user.isOnline === true) === (presenceFilter === 'online'));
    }
    if (roleFilter !== 'all') {
      filtered = filtered.filter(user => user.role === roleFilter);
    }
    
    if (activityFilter !== 'all') {
        if (activityFilter === 'active_hourly') {
            const oneHourAgo = subHours(new Date(), 1);
            filtered = filtered.filter(u => u.lastSeen && u.lastSeen.toDate() > oneHourAgo);
        } else if (activityFilter === 'active_weekly') {
            const oneWeekAgo = subDays(new Date(), 7);
            filtered = filtered.filter(u => u.lastSeen && u.lastSeen.toDate() > oneWeekAgo);
        } else if (activityFilter === 'inactive') {
            const oneMonthAgo = subMonths(new Date(), 1);
            filtered = filtered.filter(u => !u.lastSeen || u.lastSeen.toDate() < oneMonthAgo);
        }
    }

    if (searchTerm) {
      const lowerCaseSearch = searchTerm.toLowerCase();
      filtered = filtered.filter(user =>
        user.name.toLowerCase().includes(lowerCaseSearch) ||
        user.email?.toLowerCase().includes(lowerCaseSearch)
      );
    }
    
    const statusOrder: Record<AppUser['status'], number> = { 'pendente': 1, 'ativo': 2, 'rejeitado': 3, 'inativo': 4 };
    
    return filtered.sort((a, b) => {
      if (a.uid === currentUser?.uid) return -1;
      if (b.uid === currentUser?.uid) return 1;
      const statusA = statusOrder[a.status] || 99;
      const statusB = statusOrder[b.status] || 99;
      if (statusA !== statusB) return statusA - statusB;
      return a.name.localeCompare(b.name);
    });

  }, [users, currentUser, searchTerm, presenceFilter, roleFilter, activityFilter]);
  
  if (userLoading || loading) {
    return <div className="flex justify-center items-center h-full"><Loader className="animate-spin text-purple-500" size={32} /></div>;
  }
  
  if (!currentUser || !['Administrador', 'Dirigente'].includes(currentUser.role)) {
    return (
        <div className="text-center p-8">
            <h1 className="text-2xl font-bold">Acesso Negado</h1>
            <p>Você não tem permissão para visualizar esta página.</p>
        </div>
    );
  }

  const FilterButton = ({ label, value, currentFilter, setFilter }: { label: string, value: string, currentFilter: string, setFilter: (value: any) => void}) => (
    <button onClick={() => setFilter(value)} className={`px-3 py-1 text-sm rounded-full transition-colors ${currentFilter === value ? 'bg-primary text-primary-foreground font-semibold' : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'}`}>
        {label}
    </button>
  );

  return (
    <>
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-3xl font-bold">Gerenciamento de Usuários</h1>
            <p className="text-muted-foreground">Monitore e gerencie os membros da congregação.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-card p-6 rounded-lg shadow-md flex items-center gap-4">
            <div className="bg-blue-500/20 text-blue-400 p-3 rounded-lg">
                <UsersIcon size={28} />
            </div>
            <div>
                <p className="text-muted-foreground text-sm">Total de Usuários</p>
                <p className="text-2xl font-bold">{stats.total}</p>
            </div>
        </div>
        <div className="bg-card p-6 rounded-lg shadow-md flex items-center gap-4">
            <div className="bg-green-500/20 text-green-400 p-3 rounded-lg">
                <Wifi size={28} />
            </div>
            <div>
                <p className="text-muted-foreground text-sm">Online</p>
                <p className="text-2xl font-bold">{stats.online}</p>
            </div>
        </div>
        <div className="bg-card p-6 rounded-lg shadow-md flex items-center gap-4">
            <div className="bg-yellow-500/20 text-yellow-400 p-3 rounded-lg">
                <Check size={28}/>
            </div>
            <div>
                <p className="text-muted-foreground text-sm">Pendentes</p>
                <p className="text-2xl font-bold">{stats.pending}</p>
            </div>
        </div>
      </div>

      <div className="w-full">
        <div className="bg-card rounded-lg p-2">
            <Disclosure as="div">
                {({ open }) => (
                <>
                    <Disclosure.Button className="flex w-full justify-between items-center rounded-lg px-4 py-2 text-left text-lg font-medium hover:bg-white/5 focus:outline-none focus-visible:ring focus-visible:ring-purple-500/75">
                        <div className="flex items-center gap-3">
                           <SlidersHorizontal size={20} />
                           <span>Filtros</span>
                        </div>
                        <ChevronUp className={`${open ? 'rotate-180 transform' : ''} h-5 w-5 transition-transform`} />
                    </Disclosure.Button>
                    <Transition show={open} enter="transition duration-100 ease-out" enterFrom="transform scale-95 opacity-0" enterTo="transform scale-100 opacity-100" leave="transition duration-75 ease-out" leaveFrom="transform scale-100 opacity-100" leaveTo="transform scale-95 opacity-100">
                        <Disclosure.Panel className="px-4 pb-4 pt-4 text-sm text-gray-500 border-t border-border mt-2 space-y-4">
                            <div>
                                <p className="font-semibold mb-2">Status de Presença</p>
                                <div className="flex flex-wrap gap-2">
                                    <FilterButton label="Todos" value="all" currentFilter={presenceFilter} setFilter={setPresenceFilter} />
                                    <FilterButton label="Online" value="online" currentFilter={presenceFilter} setFilter={setPresenceFilter} />
                                    <FilterButton label="Offline" value="offline" currentFilter={presenceFilter} setFilter={setPresenceFilter} />
                                </div>
                            </div>
                            
                            <div>
                                <p className="font-semibold mb-2">Perfil de Usuário</p>
                                <div className="flex flex-wrap gap-2">
                                    <FilterButton label="Todos" value="all" currentFilter={roleFilter} setFilter={setRoleFilter} />
                                    <FilterButton label="Admin" value="Administrador" currentFilter={roleFilter} setFilter={setRoleFilter} />
                                    <FilterButton label="Dirigente" value="Dirigente" currentFilter={roleFilter} setFilter={setRoleFilter} />
                                    <FilterButton label="Publicador" value="Publicador" currentFilter={roleFilter} setFilter={setRoleFilter} />
                                </div>
                            </div>

                            <div>
                                <p className="font-semibold mb-2">Atividade Recente (Visto por último)</p>
                                <div className="flex flex-wrap gap-2">
                                    <FilterButton label="Todos" value="all" currentFilter={activityFilter} setFilter={setActivityFilter} />
                                    <FilterButton label="Ativos na Última Hora" value="active_hourly" currentFilter={activityFilter} setFilter={setActivityFilter} />
                                    <FilterButton label="Ativos na Semana" value="active_weekly" currentFilter={activityFilter} setFilter={setActivityFilter} />
                                    <FilterButton label="Inativos há um Mês" value="inactive" currentFilter={activityFilter} setFilter={setActivityFilter} />
                                </div>
                            </div>
                        </Disclosure.Panel>
                    </Transition>
                </>
                )}
            </Disclosure>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
        <input 
            type="text" 
            placeholder="Buscar por nome ou e-mail..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            className="w-full pl-10 pr-10 py-2 bg-card border border-input rounded-lg" 
        />
        {searchTerm && (
          <button 
            onClick={() => setSearchTerm('')} 
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X size={20} />
          </button>
        )}
      </div>
      
      <div className="bg-card rounded-lg shadow-md">
        {loading ? (
           <div className="text-center p-8 text-muted-foreground"><Loader className="animate-spin mx-auto" /></div>
        ) : filteredAndSortedUsers.length > 0 ? (
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredAndSortedUsers.map((user) => 
                <UserListItem 
                    key={user.uid} 
                    user={user} 
                    currentUser={currentUser!} 
                    onUpdate={handleUserUpdate}
                    onDelete={openDeleteConfirm}
                />
            )}
          </ul>
        ) : ( 
            <div className="text-center p-8 text-muted-foreground">
                <p>Nenhum usuário corresponde aos filtros selecionados.</p>
            </div>
        )}
      </div>
    </div>
    
      <ConfirmationModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={confirmDeleteUser}
        isLoading={false}
        title="Excluir Usuário"
        message={`Você tem certeza que deseja excluir permanentemente o usuário ${userToDelete?.name}? Todos os seus dados serão perdidos e esta ação não pode ser desfeita.`}
        confirmText="Sim, excluir"
        cancelText="Cancelar"
      />
    </>
  );
}
