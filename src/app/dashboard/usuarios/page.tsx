
"use client";

import { useState, useEffect, Fragment } from 'react';
import { useUser } from '@/contexts/UserContext';
import { db, functions } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { Shield, User, MoreVertical, Loader, Check, Trash2, ShieldAlert, Search, PlusCircle } from 'lucide-react';
import { Menu, Transition } from '@headlessui/react';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { getInitials } from '@/lib/utils';
import { Button } from '@/components/ui/button';

// Interface do usuário
interface AppUser {
  uid: string;
  name: string;
  email?: string;
  role: 'Administrador' | 'Dirigente' | 'Publicador';
  status: 'ativo' | 'pendente' | 'inativo';
}

export default function UsersPage() {
  const { user: currentUser, loading: userLoading } = useUser();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<AppUser | null>(null);

  useEffect(() => {
    // Busca a lista de usuários em tempo real
    if (currentUser && ['Administrador', 'Dirigente'].includes(currentUser.role) && currentUser.congregationId) {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where("congregationId", "==", currentUser.congregationId));
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() })) as AppUser[]);
        setLoading(false);
      }, (error) => {
        console.error("Erro ao buscar usuários:", error);
        setLoading(false);
      });
      return () => unsubscribe();
    } else if (!userLoading) {
      setLoading(false);
    }
  }, [currentUser, userLoading]);
  
  const handleUserUpdate = async (userId: string, dataToUpdate: object) => {
    setUpdatingUserId(userId);
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, dataToUpdate);
    } catch (error) {
      console.error("Erro ao atualizar usuário:", error);
      // Adicionar toast de erro aqui
    } finally {
      setUpdatingUserId(null);
    }
  };
  
  const openDeleteConfirm = (user: AppUser) => {
    setUserToDelete(user);
    setIsConfirmModalOpen(true);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete || !currentUser || currentUser.role !== 'Administrador' || currentUser.uid === userToDelete.uid) return;

    setUpdatingUserId(userToDelete.uid);
    setIsConfirmModalOpen(false); // Fechar o modal imediatamente
    try {
        const deleteUser = httpsCallable(functions, 'deleteUserAccount');
        await deleteUser({ uid: userToDelete.uid });
        // O onSnapshot vai atualizar a UI automaticamente.
    } catch (error: any) {
        console.error("Erro ao chamar a função para excluir usuário:", error);
        // Adicionar toast de erro aqui
    } finally {
        setUpdatingUserId(null);
        setUserToDelete(null);
    }
  };
  
  const getStatusClass = (status: string) => {
    switch (status) {
      case 'ativo': return 'bg-green-500 text-white';
      case 'pendente': return 'bg-yellow-500 text-white';
      case 'inativo': return 'bg-red-500 text-white';
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

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.email && user.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold">Gerenciamento de Usuários</h1>
        {currentUser.role === 'Administrador' && (
          <Button disabled>
            <PlusCircle size={20} className="mr-2"/> Adicionar Usuário
          </Button>
        )}
      </div>

      <div className="mb-6 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        <input
          type="text"
          placeholder="Buscar por nome ou e-mail..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-card border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>
      
      <div className="bg-white dark:bg-[#2a2736] rounded-lg shadow-md">
        {loading ? (
           <div className="text-center p-8 text-muted-foreground"><Loader className="animate-spin mx-auto" /></div>
        ) : filteredUsers.length > 0 ? (
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredUsers.map((user) => (
                  <li key={user.uid} className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      {/* Seção 1: Informações do Usuário */}
                      <div className="flex items-center flex-1 min-w-0">
                          <Avatar className="mr-4 flex-shrink-0">
                            <AvatarFallback>
                              {getInitials(user.name) || <User size={20} />}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                              <p className="font-semibold text-gray-900 dark:text-white truncate">{user.name}</p>
                              <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{user.email || 'E-mail não disponível'}</p>
                          </div>
                      </div>
                      
                      {/* Seção 2: Badges e Ações */}
                      <div className="flex items-center justify-end gap-3 shrink-0">
                          <span className={`px-3 py-1 text-xs font-medium rounded-full ${getRoleClass(user.role)}`}>{user.role}</span>
                          <span className={`px-3 py-1 text-xs font-medium rounded-full ${getStatusClass(user.status)}`}>{user.status.charAt(0).toUpperCase() + user.status.slice(1)}</span>
                          
                          {currentUser && currentUser.uid !== user.uid && (
                              <Menu as="div" className="relative">
                                  <Menu.Button className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 disabled:cursor-not-allowed" disabled={updatingUserId === user.uid}>
                                    {updatingUserId === user.uid ? <Loader size={20} className="animate-spin"/> : <MoreVertical size={20} />}
                                  </Menu.Button>
                                  <Transition as={Fragment} enter="transition ease-out duration-100" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="transition ease-in duration-75" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                                      <Menu.Items className="absolute right-0 mt-2 w-56 origin-top-right bg-white dark:bg-gray-800 divide-y dark:divide-gray-700 rounded-md shadow-lg z-10 ring-1 ring-black ring-opacity-5 focus:outline-none">
                                         <div className="p-1">
                                            {user.status === 'pendente' && (
                                              <Menu.Item>
                                                {({ active }) => (
                                                  <button onClick={() => handleUserUpdate(user.uid, { status: 'ativo' })} className={`${active ? 'bg-purple-500 text-white' : 'text-gray-900 dark:text-gray-100'} group flex w-full items-center rounded-md px-2 py-2 text-sm`}>
                                                    <Check className="mr-2 h-4 w-4"/>Aprovar
                                                  </button>
                                                )}
                                              </Menu.Item>
                                            )}
                                            
                                            {currentUser.role === 'Administrador' && user.status === 'ativo' && (
                                              <>
                                                {user.role === 'Publicador' && (
                                                  <Menu.Item>
                                                    {({ active }) => (
                                                      <button onClick={() => handleUserUpdate(user.uid, { role: 'Dirigente' })} className={`${active ? 'bg-purple-500 text-white' : 'text-gray-900 dark:text-gray-100'} group flex w-full items-center rounded-md px-2 py-2 text-sm`}>
                                                        <Shield className="mr-2 h-4 w-4"/>Tornar Dirigente
                                                      </button>
                                                    )}
                                                  </Menu.Item>
                                                )}
                                                {user.role === 'Dirigente' && (
                                                  <>
                                                    <Menu.Item>
                                                      {({ active }) => (
                                                        <button onClick={() => handleUserUpdate(user.uid, { role: 'Administrador' })} className={`${active ? 'bg-purple-500 text-white' : 'text-gray-900 dark:text-gray-100'} group flex w-full items-center rounded-md px-2 py-2 text-sm`}>
                                                          <ShieldAlert className="mr-2 h-4 w-4"/>Tornar Administrador
                                                        </button>
                                                      )}
                                                    </Menu.Item>
                                                    <Menu.Item>
                                                      {({ active }) => (
                                                        <button onClick={() => handleUserUpdate(user.uid, { role: 'Publicador' })} className={`${active ? 'bg-purple-500 text-white' : 'text-gray-900 dark:text-gray-100'} group flex w-full items-center rounded-md px-2 py-2 text-sm`}>
                                                          <User className="mr-2 h-4 w-4"/>Tornar Publicador
                                                        </button>
                                                      )}
                                                    </Menu.Item>
                                                  </>
                                                )}
                                                {user.role === 'Administrador' && (
                                                  <Menu.Item>
                                                    {({ active }) => (
                                                      <button onClick={() => handleUserUpdate(user.uid, { role: 'Dirigente' })} className={`${active ? 'bg-purple-500 text-white' : 'text-gray-900 dark:text-gray-100'} group flex w-full items-center rounded-md px-2 py-2 text-sm`}>
                                                        <Shield className="mr-2 h-4 w-4"/>Rebaixar para Dirigente
                                                      </button>
                                                    )}
                                                  </Menu.Item>
                                                )}
                                              </>
                                            )}
                                         </div>
                                         {currentUser.role === 'Administrador' && (
                                           <div className="p-1">
                                              <Menu.Item>
                                                {({ active }) => (
                                                  <button onClick={() => openDeleteConfirm(user)} className={`${active ? 'bg-red-500 text-white' : 'text-red-500 dark:text-red-400'} group flex w-full items-center rounded-md px-2 py-2 text-sm`}>
                                                    <Trash2 className="mr-2 h-4 w-4"/>Excluir Usuário
                                                  </button>
                                                )}
                                              </Menu.Item>
                                           </div>
                                         )}
                                      </Menu.Items>
                                  </Transition>
                              </Menu>
                          )}
                      </div>
                  </li>
              ))}
          </ul>
        ) : (
          <div className="text-center p-8 text-muted-foreground">
            <p>{searchTerm ? "Nenhum usuário encontrado para sua busca." : "Nenhum usuário para exibir."}</p>
          </div>
        )}
      </div>
      <ConfirmationModal
          isOpen={isConfirmModalOpen}
          onClose={() => setIsConfirmModalOpen(false)}
          onConfirm={confirmDeleteUser}
          isLoading={!!updatingUserId}
          title="Excluir Usuário"
          message={`Você tem certeza que deseja excluir permanentemente o usuário ${userToDelete?.name}? Todos os seus dados serão perdidos e esta ação não pode ser desfeita.`}
          confirmText="Sim, excluir"
          cancelText="Cancelar"
      />
    </div>
  );
}
