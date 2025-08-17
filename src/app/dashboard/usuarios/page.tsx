"use client";

import { useState, useEffect, useMemo, Fragment, useCallback } from 'react';
import { useUser } from '@/contexts/UserContext';
import { db, app } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Shield, User, MoreVertical, Loader, Check, Trash2, ShieldAlert, Search, XCircle, Wifi, WifiOff, Users as UsersIcon, SlidersHorizontal, ChevronUp } from 'lucide-react';
import { Menu, Transition, Disclosure } from '@headlessui/react';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { getInitials } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { AppUser, Congregation } from '@/types/types';
import withAuth from '@/components/withAuth';

const functions = getFunctions(app, 'southamerica-east1');
const deleteUserFunction = httpsCallable(functions, 'deleteUserAccount');


const UserListItem = ({ user, currentUser, onUpdate, onDelete }: { user: AppUser, currentUser: AppUser, onUpdate: (userId: string, data: object) => void, onDelete: (user: AppUser) => void }) => {
  const isOnline = user.isOnline === true;
  const isAdmin = currentUser.role === 'Administrador';
  const isDirigente = currentUser.role === 'Dirigente';
  
  const canShowMenu = currentUser.uid !== user.uid && 
                      (isAdmin || (isDirigente && (user.status === 'pendente' || user.status === 'rejeitado')));


  const getStatusClass = (status: AppUser['status']) => {
    switch (status) {
      case 'ativo': return 'bg-green-500 text-white';
      case 'pendente': return 'bg-yellow-500 text-white';
      case 'rejeitado': return 'bg-red-500 text-white';
      case 'inativo': return 'bg-gray-500 text-white';
      default: return 'bg-gray-400 text-white';
    }
  };

  const getRoleClass = (role: string) => {
    switch (role) {
      case 'Administrador': return 'bg-purple-500 text-white';
      case 'Dirigente': return 'bg-blue-500 text-white';
      default: return 'bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200';
    }
  };

  return (
    <li className={`p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b dark:border-gray-700 ${user.status === 'pendente' ? 'bg-yellow-500/10' : ''}`}>
      <div className="flex items-center flex-1 min-w-0">
          <div className="relative flex-shrink-0 mr-4">
            <Avatar>
              <AvatarFallback>
                {getInitials(user.name) || <User size={20} />}
              </AvatarFallback>
            </Avatar>
            <span 
              className={`absolute bottom-0 right-0 block h-3.5 w-3.5 rounded-full ring-2 ring-card 
                ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} 
              title={isOnline ? 'Online' : 'Offline'}
            />
          </div>
          <div className="min-w-0">
              <p className="font-semibold text-gray-900 dark:text-white truncate">
                {user.name}
                {user.uid === currentUser.uid && <span className="text-purple-400 font-normal ml-2">(Você)</span>}
              </p>
              <p className={`text-sm ${isOnline ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                {isOnline ? 'Online' : (user.lastSeen ? `Visto ${formatDistanceToNow(user.lastSeen.toDate(), { addSuffix: true, locale: ptBR })}` : 'Offline')}
              </p>
          </div>
      </div>
      
      <div className="flex items-center justify-end gap-3 shrink-0">
          <div className="flex items-center justify-end gap-3 shrink-0">
            {user.status !== 'pendente' && (
              <span className={`px-3 py-1 text-xs font-medium rounded-full ${getRoleClass(user.role)}`}>{user.role}</span>
            )}
            {user.status !== 'ativo' && (
                <span className={`px-3 py-1 text-xs font-medium rounded-full ${getStatusClass(user.status)}`}>
                    {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                </span>
            )}
          </div>
          
          {canShowMenu ? (
              <Menu as="div" className="relative">
                  <Menu.Button className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                    <MoreVertical size={20} />
                  </Menu.Button>
                  <Transition as={Fragment} enter="transition ease-out duration-100" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="transition ease-in duration-75" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                      <Menu.Items className="absolute right-0 mt-2 w-56 origin-top-right bg-white dark:bg-gray-800 divide-y dark:divide-gray-700 rounded-md shadow-lg z-10 ring-1 ring-black ring-opacity-5 focus:outline-none">
                         <div className="p-1">
                            {user.status === 'pendente' ? (
                              <>
                                <Menu.Item>
                                  {({ active }) => (
                                    <button onClick={() => onUpdate(user.uid, { status: 'ativo' })} className={`${active ? 'bg-purple-500 text-white' : 'text-gray-900 dark:text-gray-100'} group flex w-full items-center rounded-md px-2 py-2 text-sm`}>
                                      <Check className="mr-2 h-4 w-4"/>Aprovar
                                    </button>
                                  )}
                                </Menu.Item>
                                <Menu.Item>
                                  {({ active }) => (
                                    <button onClick={() => onUpdate(user.uid, { status: 'rejeitado' })} className={`${active ? 'bg-red-500 text-white' : 'text-red-500 dark:text-red-400'} group flex w-full items-center rounded-md px-2 py-2 text-sm`}>
                                      <XCircle className="mr-2 h-4 w-4"/>Rejeitar
                                    </button>
                                  )}
                                </Menu.Item>
                              </>
                            ) : (
                              <>
                                {user.status === 'rejeitado' && (
                                    <Menu.Item>
                                      {({ active }) => (
                                        <button onClick={() => onUpdate(user.uid, { status: 'ativo' })} className={`${active ? 'bg-purple-500 text-white' : 'text-gray-900 dark:text-gray-100'} group flex w-full items-center rounded-md px-2 py-2 text-sm`}>
                                          <Check className="mr-2 h-4 w-4"/>Aprovar Mesmo Assim
                                        </button>
                                      )}
                                    </Menu.Item>
                                )}
                                
                                {isAdmin && user.role !== 'Administrador' && (
                                  <Menu.Item>
                                    {({ active }) => (
                                      <button onClick={() => onUpdate(user.uid, { role: 'Administrador' })} className={`${active ? 'bg-purple-500 text-white' : 'text-gray-900 dark:text-gray-100'} group flex w-full items-center rounded-md px-2 py-2 text-sm`}>
                                        <ShieldAlert className="mr-2 h-4 w-4"/>Tornar Administrador
                                      </button>
                                    )}
                                  </Menu.Item>
                                )}
                                {isAdmin && user.role === 'Publicador' && (
                                    <Menu.Item>
                                      {({ active }) => (
                                        <button onClick={() => onUpdate(user.uid, { role: 'Dirigente' })} className={`${active ? 'bg-purple-500 text-white' : 'text-gray-900 dark:text-gray-100'} group flex w-full items-center rounded-md px-2 py-2 text-sm`}>
                                          <Shield className="mr-2 h-4 w-4"/>Tornar Dirigente
                                        </button>
                                      )}
                                    </Menu.Item>
                                )}
                                {isAdmin && user.role === 'Dirigente' && (
                                    <Menu.Item>
                                      {({ active }) => (
                                        <button onClick={() => onUpdate(user.uid, { role: 'Publicador' })} className={`${active ? 'bg-purple-500 text-white' : 'text-gray-900 dark:text-gray-100'} group flex w-full items-center rounded-md px-2 py-2 text-sm`}>
                                          <User className="mr-2 h-4 w-4"/>Tornar Publicador
                                        </button>
                                      )}
                                    </Menu.Item>
                                )}
                                {isAdmin && user.role === 'Administrador' && (
                                  <Menu.Item>
                                    {({ active }) => (
                                      <button onClick={() => onUpdate(user.uid, { role: 'Dirigente' })} className={`${active ? 'bg-purple-500 text-white' : 'text-gray-900 dark:text-gray-100'} group flex w-full items-center rounded-md px-2 py-2 text-sm`}>
                                        <Shield className="mr-2 h-4 w-4"/>Rebaixar para Dirigente
                                      </button>
                                    )}
                                  </Menu.Item>
                                )}
                              </>
                            )}
                         </div>
                         {isAdmin && user.status !== 'pendente' && user.uid !== currentUser.uid && (
                           <div className="p-1">
                              <Menu.Item>
                                {({ active }) => (
                                  <button onClick={() => onDelete(user)} className={`${active ? 'bg-red-500 text-white' : 'text-red-500 dark:text-red-400'} group flex w-full items-center rounded-md px-2 py-2 text-sm`}>
                                    <Trash2 className="mr-2 h-4 w-4"/>Excluir Usuário
                                  </button>
                                )}
                              </Menu.Item>
                           </div>
                         )}
                      </Menu.Items>
                  </Transition>
              </Menu>
          ) : (
            <div className="w-9 h-9" />
          )}
      </div>
    </li>
  );
};


function UsersPage() {
  const { user: currentUser, loading: userLoading } = useUser(); 

  const [users, setUsers] = useState<AppUser[]>([]);
  const [congregation, setCongregation] = useState<Congregation | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [presenceFilter, setPresenceFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [roleFilter, setRoleFilter] = useState<'all' | 'Administrador' | 'Dirigente' | 'Publicador'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pendente'>('all');

  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<AppUser | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ action: () => void, title: string, message: string, confirmText: string } | null>(null);


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
  
  const handleUserUpdate = async (userId: string, dataToUpdate: object) => {
    try {
      const permissions = dataToUpdate as Partial<AppUser>;
      if (currentUser?.role !== 'Administrador') {
        if (permissions.role) {
          console.error("Apenas administradores podem alterar perfis.");
          return;
        }
      }
      if (currentUser?.uid === userId && permissions.role && permissions.role !== 'Administrador') {
          alert("Você não pode rebaixar a si mesmo.");
          return;
      }
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, dataToUpdate);
    } catch (error) {
      console.error("Erro ao atualizar usuário:", error);
    }
  };
  
  const openDeleteConfirm = useCallback((user: AppUser) => {
    if (currentUser?.role !== 'Administrador') return;
    setUserToDelete(user);
    setConfirmAction({
      action: async () => {
        if (!user || !currentUser || currentUser.role !== 'Administrador' || currentUser.uid === user.uid) return;
        
        setIsConfirmModalOpen(false);
        try {
            await deleteUserFunction({ uid: user.uid });
        } catch (error: any) {
            console.error("Erro ao chamar a função para excluir usuário:", error);
        } finally {
            setUserToDelete(null);
        }
      },
      title: "Excluir Usuário",
      message: `Você tem certeza que deseja excluir permanentemente o usuário ${user.name}? Todos os seus dados serão perdidos e esta ação não pode ser desfeita.`,
      confirmText: "Sim, excluir",
    });
    setIsConfirmModalOpen(true);
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
    if (statusFilter !== 'all') {
      filtered = filtered.filter(user => user.status === statusFilter);
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

  }, [users, currentUser, searchTerm, presenceFilter, roleFilter, statusFilter]);
  
  if (userLoading || loading) {
    return <div className="flex justify-center items-center h-full"><Loader className="animate-spin text-purple-500" size={32} /></div>;
  }
  
  if (!currentUser || !['Administrador', 'Dirigente'].includes(currentUser.role)) {
    return (
        <div className="text-center">
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
    <div className="p-4 md:p-8 space-y-6">
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
            <div className="bg-gray-500/20 text-gray-400 p-3 rounded-lg">
                <WifiOff size={28} />
            </div>
            <div>
                <p className="text-muted-foreground text-sm">Offline</p>
                <p className="text-2xl font-bold">{stats.offline}</p>
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
                                <p className="font-semibold mb-2">Status de Aprovação</p>
                                <div className="flex flex-wrap gap-2">
                                    <FilterButton label="Todos" value="all" currentFilter={statusFilter} setFilter={setStatusFilter} />
                                    <FilterButton label={`Apenas Pendentes (${stats.pending})`} value="pendente" currentFilter={statusFilter} setFilter={setStatusFilter} />
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
        <input type="text" placeholder="Buscar por nome ou e-mail..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-card border border-input rounded-lg" />
      </div>
      
      <div className="bg-white dark:bg-[#2a2736] rounded-lg shadow-md">
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
    
      {confirmAction && (
          <ConfirmationModal
            isOpen={isConfirmModalOpen}
            onClose={() => setIsConfirmModalOpen(false)}
            onConfirm={() => {
                confirmAction.action();
            }}
            isLoading={false}
            title={confirmAction.title}
            message={confirmAction.message}
            confirmText={confirmAction.confirmText}
            cancelText="Cancelar"
          />
      )}
    </>
  );
}

export default withAuth(UsersPage);