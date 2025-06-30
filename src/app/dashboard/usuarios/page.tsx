"use client";

import { useState, useEffect, Fragment } from 'react';
import { useUser } from '@/contexts/UserContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Shield, User, MoreVertical, Loader, Check, Trash2, ShieldAlert } from 'lucide-react';
import { Menu, Transition } from '@headlessui/react';

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
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  useEffect(() => {
    // Busca a lista de usuários em tempo real
    if (currentUser && ['Administrador', 'Dirigente'].includes(currentUser.role)) {
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
    } finally {
      setUpdatingUserId(null);
    }
  };
  
  const handleDeleteUser = async (userId: string) => {
    if (currentUser?.role !== 'Administrador') return;
    if (confirm("Tem certeza que deseja excluir este usuário permanentemente? Esta ação não pode ser desfeita.")) {
      setUpdatingUserId(userId);
      try {
        await deleteDoc(doc(db, 'users', userId));
        // NOTA: Em produção, seria ideal chamar uma Cloud Function para deletar o usuário da Authentication também.
      } catch (error) {
        console.error("Erro ao excluir usuário:", error);
      } finally {
        setUpdatingUserId(null);
      }
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

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Gerenciamento de Usuários</h1>
      </div>
      
      <div className="bg-white dark:bg-[#2a2736] rounded-lg shadow-md">
        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {users.map((user) => (
                <li key={user.uid} className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <div className="flex items-center">
                        <div className="w-10 h-10 rounded-full bg-purple-600/20 flex items-center justify-center mr-4">
                            <User className="text-purple-500" size={20}/>
                        </div>
                        <div>
                            <p className="font-semibold text-gray-900 dark:text-white">{user.name}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{user.email || 'E-mail não disponível'}</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                        <span className={`px-3 py-1 text-xs font-medium rounded-full ${user.role === 'Administrador' ? 'bg-purple-500 text-white' : (user.role === 'Dirigente' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200')}`}>{user.role}</span>
                        <span className={`px-3 py-1 text-xs font-medium rounded-full ${user.status === 'ativo' ? 'bg-green-500 text-white' : 'bg-yellow-500 text-white'}`}>{user.status}</span>
                        
                        {currentUser && currentUser.uid !== user.uid && (
                            <Menu as="div" className="relative">
                                <Menu.Button className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 disabled:cursor-not-allowed" disabled={updatingUserId === user.uid}>
                                  {updatingUserId === user.uid ? <Loader size={20} className="animate-spin"/> : <MoreVertical size={20} />}
                                </Menu.Button>
                                <Transition as={Fragment} enter="transition ease-out duration-100" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="transition ease-in duration-75" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                                    <Menu.Items className="absolute right-0 mt-2 w-56 origin-top-right bg-white dark:bg-gray-800 divide-y dark:divide-gray-700 rounded-md shadow-lg z-10 ring-1 ring-black ring-opacity-5 focus:outline-none">
                                       <div className="p-1">
                                          {user.status === 'pendente' && (
                                            <Menu.Item>{({ active }) => <button onClick={() => handleUserUpdate(user.uid, { status: 'ativo' })} className={`${active ? 'bg-purple-500 text-white' : 'text-gray-900 dark:text-gray-100'} group flex w-full items-center rounded-md px-2 py-2 text-sm`}><Check className="mr-2 h-4 w-4"/>Aprovar</button>}</Menu.Item>
                                          )}
                                          
                                          {currentUser.role === 'Administrador' && user.status === 'ativo' && (
                                            <>
                                              {user.role === 'Publicador' && (
                                                <Menu.Item>{({ active }) => <button onClick={() => handleUserUpdate(user.uid, { role: 'Dirigente' })} className={`${active ? 'bg-purple-500 text-white' : 'text-gray-900 dark:text-gray-100'} group flex w-full items-center rounded-md px-2 py-2 text-sm`}><Shield className="mr-2 h-4 w-4"/>Tornar Dirigente</button>}</Menu.Item>
                                              )}
                                              {user.role === 'Dirigente' && (
                                                <>
                                                  <Menu.Item>{({ active }) => <button onClick={() => handleUserUpdate(user.uid, { role: 'Administrador' })} className={`${active ? 'bg-purple-500 text-white' : 'text-gray-900 dark:text-gray-100'} group flex w-full items-center rounded-md px-2 py-2 text-sm`}><ShieldAlert className="mr-2 h-4 w-4"/>Tornar Administrador</button>}</Menu.Item>}
                                                  <Menu.Item>{({ active }) => <button onClick={() => handleUserUpdate(user.uid, { role: 'Publicador' })} className={`${active ? 'bg-purple-500 text-white' : 'text-gray-900 dark:text-gray-100'} group flex w-full items-center rounded-md px-2 py-2 text-sm`}><User className="mr-2 h-4 w-4"/>Tornar Publicador</button>}</Menu.Item>}
                                                </>
                                              )}
                                              {user.role === 'Administrador' && (
                                                <Menu.Item>{({ active }) => <button onClick={() => handleUserUpdate(user.uid, { role: 'Dirigente' })} className={`${active ? 'bg-purple-500 text-white' : 'text-gray-900 dark:text-gray-100'} group flex w-full items-center rounded-md px-2 py-2 text-sm`}><Shield className="mr-2 h-4 w-4"/>Rebaixar para Dirigente</button>}</Menu.Item>
                                              )}
                                            </>
                                          )}
                                       </div>
                                       {currentUser.role === 'Administrador' && (
                                         <div className="p-1">
                                             <Menu.Item>{({ active }) => <button onClick={() => handleDeleteUser(user.uid)} className={`${active ? 'bg-red-500 text-white' : 'text-red-500 dark:text-red-400'} group flex w-full items-center rounded-md px-2 py-2 text-sm`}><Trash2 className="mr-2 h-4 w-4"/>Excluir Usuário</button>}</Menu.Item>
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
      </div>
    </div>
  );
}
