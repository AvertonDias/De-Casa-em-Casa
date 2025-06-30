"use client";

import { useState, useEffect, Fragment } from 'react';
import { useUser } from '@/contexts/UserContext';
import { db, auth } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { reauthenticateWithCredential, EmailAuthProvider, updatePassword, updateProfile } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Dialog, Transition } from '@headlessui/react';
import { X, Eye, EyeOff, Trash2 } from 'lucide-react';

export function EditProfileModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const { user, updateUser } = useUser();
  
  const [name, setName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordForDelete, setPasswordForDelete] = useState('');
  const [showPasswordForDelete, setShowPasswordForDelete] = useState(false);
  
  useEffect(() => {
    if (user && isOpen) {
      setName(user.name);
      setError(null);
      setSuccess(null);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setPasswordForDelete('');
    }
  }, [user, isOpen]);

  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    if (!user || !auth.currentUser) {
      setError("Usuário não encontrado. Por favor, faça login novamente.");
      setLoading(false);
      return;
    }

    if (newPassword && newPassword !== confirmNewPassword) {
      setError("A nova senha e a confirmação não coincidem.");
      setLoading(false);
      return;
    }
    
    if (newPassword && !currentPassword) {
        setError("Você precisa fornecer sua senha atual para alterar a senha.");
        setLoading(false);
        return;
    }
    
    try {
      const dataToUpdate: { name?: string; } = {};
      if (name.trim() !== user.name) dataToUpdate.name = name.trim();
      
      if (Object.keys(dataToUpdate).length > 0) {
        const userDocRef = doc(db, 'users', user.uid);
        await updateDoc(userDocRef, dataToUpdate);
        if (dataToUpdate.name) {
          await updateProfile(auth.currentUser, { displayName: dataToUpdate.name });
        }
        updateUser(dataToUpdate);
        setSuccess("Perfil atualizado com sucesso!");
      }

      if (newPassword && currentPassword && auth.currentUser.email) {
        const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
        await reauthenticateWithCredential(auth.currentUser, credential);
        await updatePassword(auth.currentUser, newPassword);
        setSuccess(Object.keys(dataToUpdate).length > 0 ? "Perfil e senha atualizados com sucesso!" : "Senha atualizada com sucesso!");
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
      }
      
    } catch (error: any) {
      console.error("Erro ao salvar perfil:", error);
      setError(error.code === 'auth/wrong-password' ? "Senha atual incorreta." : "Ocorreu um erro ao salvar as alterações.");
    } finally {
      setLoading(false);
      setTimeout(() => setSuccess(null), 4000);
    }
  };

  const handleSelfDelete = async () => {
    if (!user || !auth.currentUser) return;

    if(!passwordForDelete) {
        setError("Para excluir sua conta, por favor, insira sua senha atual.");
        return;
    }

    if (confirm("ATENÇÃO: Você está prestes a excluir PERMANENTEMENTE sua conta. Todos os seus dados serão perdidos e esta ação não pode ser desfeita. Você tem certeza?")) {
        setLoading(true);
        setError(null);
        try {
            const credential = EmailAuthProvider.credential(auth.currentUser.email!, passwordForDelete);
            await reauthenticateWithCredential(auth.currentUser, credential);
            
            const functionsInstance = getFunctions();
            const deleteUser = httpsCallable(functionsInstance, 'deleteUserAccount');
            await deleteUser({ uid: user.uid });
            
            onClose();

        } catch (error: any) {
             console.error("Erro na autoexclusão:", error);
             if (error.code === 'auth/wrong-password') {
                setError("Senha incorreta. A exclusão não foi realizada.");
             } else {
                setError("Ocorreu um erro ao tentar excluir a conta.");
             }
        } finally {
            setLoading(false);
        }
    }
  }

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        
        <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
          <div className="fixed inset-0 bg-black/50" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            
            <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-[#2f2b3a] p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title as="h3" className="text-lg font-bold leading-6 text-white flex justify-between items-center">
                  Editar Perfil
                  <button onClick={onClose} className="p-1 rounded-full hover:bg-white/10"><X size={20} /></button>
                </Dialog.Title>
                
                <form onSubmit={handleSaveChanges} className="mt-4 space-y-4">
                   <div>
                      <label htmlFor="name" className="text-sm font-medium text-gray-300">Nome Completo</label>
                      <input id="name" type="text" value={name} onChange={e => setName(e.target.value)} required className="mt-1 w-full px-4 py-2 text-white bg-[#1e1b29] border border-gray-600 rounded-md"/>
                    </div>

                    <div className="border-t border-gray-600 pt-4">
                        <p className="text-sm font-medium text-gray-300 mb-2">Alterar Senha (Opcional)</p>
                         <div className="relative">
                            <input type={showCurrentPassword ? 'text' : 'password'} value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="Senha Atual" className="mt-1 w-full px-4 py-2 text-white bg-[#1e1b29] border border-gray-600 rounded-md pr-10"/>
                            <button type="button" onClick={() => setShowCurrentPassword(!showCurrentPassword)} className="absolute inset-y-0 right-0 px-3 text-gray-400 mt-1 flex items-center">
                                {showCurrentPassword ? <EyeOff size={20}/> : <Eye size={20}/>}
                            </button>
                        </div>
                         <div className="relative mt-2">
                            <input type={showNewPassword ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Nova Senha" className="w-full px-4 py-2 text-white bg-[#1e1b29] border border-gray-600 rounded-md pr-10"/>
                            <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute inset-y-0 right-0 px-3 text-gray-400 flex items-center">
                                {showNewPassword ? <EyeOff size={20}/> : <Eye size={20}/>}
                            </button>
                        </div>
                        <input type="password" value={confirmNewPassword} onChange={e => setConfirmNewPassword(e.target.value)} placeholder="Confirmar Nova Senha" className="mt-2 w-full px-4 py-2 text-white bg-[#1e1b29] border border-gray-600 rounded-md"/>
                    </div>
                    
                  <div className="mt-6">
                    {success && <p className="text-green-400 text-sm mb-2 text-center">{success}</p>}
                    <button type="submit" disabled={loading} className="w-full inline-flex justify-center rounded-md border border-transparent bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 disabled:bg-gray-500">
                      {loading ? 'Salvando...' : 'Salvar Alterações'}
                    </button>
                  </div>
                </form>

                {user?.role !== 'Administrador' && (
                  <div className="mt-6 pt-4 border-t border-red-500/30">
                    <h4 className="text-md font-semibold text-red-400">Zona de Perigo</h4>
                    <p className="text-sm text-gray-400 mt-1">A ação abaixo é permanente e não pode ser desfeita.</p>
                    <div className="relative mt-4">
                        <input
                          type={showPasswordForDelete ? "text" : "password"}
                          value={passwordForDelete}
                          onChange={(e) => setPasswordForDelete(e.target.value)}
                          placeholder="Digite sua senha para confirmar"
                          className="w-full pl-4 pr-10 py-2 text-white bg-[#1e1b29] border border-red-500/50 rounded-md focus:ring-2 focus:ring-red-500"
                        />
                        <button type="button" onClick={() => setShowPasswordForDelete(!showPasswordForDelete)} className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400">
                          {showPasswordForDelete ? <EyeOff size={20}/> : <Eye size={20}/>}
                        </button>
                    </div>

                    <button
                      onClick={handleSelfDelete}
                      disabled={loading || !passwordForDelete}
                      className="w-full mt-2 flex items-center justify-center px-4 py-2 font-bold text-white bg-red-600 rounded-md hover:bg-red-700 disabled:bg-red-900 disabled:text-gray-400 disabled:cursor-not-allowed"
                    >
                      <Trash2 size={16} className="mr-2"/>
                      Excluir Minha Conta
                    </button>
                  </div>
                )}
                
                {error && <p className="text-red-400 text-sm mt-4 text-center">{error}</p>}

              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
