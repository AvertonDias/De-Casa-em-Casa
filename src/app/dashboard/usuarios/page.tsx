"use client";

import { useState, useEffect, Fragment } from 'react';
import { useUser } from '@/contexts/UserContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { User, MoreVertical, Loader, Check } from 'lucide-react';
import { Menu, Transition } from '@headlessui/react';

interface AppUser { 
  uid: string; 
  name: string; 
  email?: string; 
  role: string; 
  status: string; 
}

export default function UsersPage() {
  const { user: currentUser, loading: userLoading } = useUser();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser && ['Administrador', 'Dirigente'].includes(currentUser.role)) {
      const q = query(collection(db, 'users'), where("congregationId", "==", currentUser.congregationId));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() })) as AppUser[]);
        setLoading(false);
      }, (error) => {
        console.error("Erro no listener da lista de usuários:", error);
        setLoading(false);
      });
      return () => unsubscribe();
    } else if (!userLoading) {
      setLoading(false);
    }
  }, [currentUser, userLoading]);

  const handleApproveUser = async (userId: string) => {
    if (!currentUser || !['Administrador', 'Dirigente'].includes(currentUser.role)) return;
    setUpdatingUserId(userId);
    try {
      await updateDoc(doc(db, 'users', userId), { status: 'ativo' });
    } catch (error) { 
      console.error("Erro ao aprovar usuário:", error); 
    } finally { 
      setUpdatingUserId(null); 
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
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Gerenciamento de Usuários</h1>
      </div>
      
      <div className="bg-white dark:bg-[#2a2736] rounded-lg shadow-md">
        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {users.map((user) => (
                <li key={user.uid} className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <div className="flex items-center">
                        {updatingUserId === user.uid ? (
                            <Loader className="animate-spin text-purple-500 mr-4" size={20} />
                        ) : (
                            <div className="w-10 h-10 rounded-full bg-purple-600/20 flex items-center justify-center mr-4">
                                <User className="text-purple-500" size={20}/>
                            </div>
                        )}
                        <div>
                            <p className="font-semibold text-gray-900 dark:text-white">{user.name}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{user.email || 'E-mail não disponível'}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className={`px-3 py-1 text-xs font-medium rounded-full ${user.role === 'Administrador' ? 'bg-purple-500 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200'}`}>{user.role}</span>
                        <span className={`px-3 py-1 text-xs font-medium rounded-full ${user.status === 'ativo' ? 'bg-green-500 text-white' : 'bg-yellow-500 text-white'}`}>{user.status}</span>
                        
                        {currentUser && ['Administrador', 'Dirigente'].includes(currentUser.role) && currentUser.uid !== user.uid && user.status === 'pendente' && (
                            <Menu as="div" className="relative">
                                <Menu.Button className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                                    <MoreVertical size={20} />
                                </Menu.Button>
                                <Transition as={Fragment} enter="transition ease-out duration-100" enterFrom="transform opacity-0 scale-95" enterTo="transform opacity-100 scale-100" leave="transition ease-in duration-75" leaveFrom="transform opacity-100 scale-100" leaveTo="transform opacity-0 scale-95">
                                    <Menu.Items className="absolute right-0 mt-2 w-48 origin-top-right bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-10">
                                       <div className="p-1">
                                            <Menu.Item>
                                                {({ active }) => (<button onClick={() => handleApproveUser(user.uid)} className={`${active ? 'bg-purple-500 text-white' : 'text-gray-900 dark:text-gray-100'} group flex rounded-md items-center w-full px-2 py-2 text-sm`}><Check className="mr-2" size={16}/>Aprovar Usuário</button>)}
                                            </Menu.Item>
                                       </div>
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
