
"use client";

import { Fragment } from 'react';
import type { AppUser } from '@/types/types';
import { Menu, Transition } from '@headlessui/react';
import { MoreVertical, Check, Trash2, XCircle, Edit, User } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { getInitials } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const UserListItem = ({ 
    user, 
    currentUser, 
    onUpdate, 
    onDelete,
    onEdit
}: { 
    user: AppUser, 
    currentUser: AppUser, 
    onUpdate: (userId: string, data: object) => void, 
    onDelete: (userId: string, userName: string) => void,
    onEdit: (user: AppUser) => void
}) => {
  const isOnline = user.isOnline === true;
  const isAdmin = currentUser.role === 'Administrador';
  const isDirigente = currentUser.role === 'Dirigente';
  
  const canShowMenu = currentUser.uid !== user.uid && (isAdmin || (isDirigente && user.status === 'pendente'));

  const handleApprove = () => onUpdate(user.uid, { status: 'ativo' });
  const handleDelete = () => onDelete(user.uid, user.name);
  const handleEdit = () => onEdit(user);


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
      case 'Servo de Territórios': return 'bg-cyan-500 text-white';
      default: return 'bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200';
    }
  };

  return (
    <li className={`p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b dark:border-gray-700 ${user.status === 'pendente' ? 'bg-yellow-500/10' : ''}`}>
      <div className="flex items-center flex-1 min-w-0">
          <div className="relative flex-shrink-0 mr-4">
            <Avatar className="border-2 border-primary">
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
                                    <button onClick={handleApprove} className={`${active ? 'bg-purple-500 text-white' : 'text-gray-900 dark:text-gray-100'} group flex w-full items-center rounded-md px-2 py-2 text-sm`}>
                                      <Check className="mr-2 h-4 w-4"/>Aprovar
                                    </button>
                                  )}
                                </Menu.Item>
                                <Menu.Item>
                                  {({ active }) => (
                                    <button onClick={handleDelete} className={`${active ? 'bg-red-500 text-white' : 'text-red-500 dark:text-red-400'} group flex w-full items-center rounded-md px-2 py-2 text-sm`}>
                                      <XCircle className="mr-2 h-4 w-4"/>Rejeitar (Excluir)
                                    </button>
                                  )}
                                </Menu.Item>
                              </>
                            ) : (
                               isAdmin && (
                                  <Menu.Item>
                                      {({ active }) => (
                                        <button onClick={handleEdit} className={`${active ? 'bg-purple-500 text-white' : 'text-gray-900 dark:text-gray-100'} group flex w-full items-center rounded-md px-2 py-2 text-sm`}>
                                          <Edit className="mr-2 h-4 w-4"/>Editar Usuário
                                        </button>
                                      )}
                                  </Menu.Item>
                                )
                            )}
                         </div>
                         {isAdmin && user.status !== 'pendente' && user.uid !== currentUser.uid && (
                           <div className="p-1">
                              <Menu.Item>
                                {({ active }) => (
                                  <button onClick={handleDelete} className={`${active ? 'bg-red-500 text-white' : 'text-red-500 dark:text-red-400'} group flex w-full items-center rounded-md px-2 py-2 text-sm`}>
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
