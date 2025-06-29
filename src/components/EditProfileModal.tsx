"use client";

import { useState, useEffect, type ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { User as UserIcon, X, Eye, EyeOff } from 'lucide-react';
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { useUser } from '@/contexts/UserContext';

export function EditProfileModal() {
  const { user } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  
  const [name, setName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (user && isOpen) {
      setName(user.name);
      setError('');
      setSuccess('');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    }
  }, [user, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');

    if (!user || !user.email) {
      setError("Usuário não encontrado.");
      setIsLoading(false);
      return;
    }

    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { name: name });

      if (newPassword) {
        if (newPassword !== confirmNewPassword) throw new Error("As novas senhas não coincidem.");
        if (newPassword.length < 6) throw new Error("A nova senha deve ter no mínimo 6 caracteres.");
        if (!currentPassword) throw new Error("Forneça sua senha atual para definir uma nova.");

        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        const firebaseUser = auth.currentUser;
        if (firebaseUser) {
          await reauthenticateWithCredential(firebaseUser, credential);
          await updatePassword(firebaseUser, newPassword);
        } else {
          throw new Error("Sessão do usuário expirada. Faça login novamente.");
        }
      }

      setSuccess("Perfil atualizado com sucesso!");
      setTimeout(() => {
        setIsOpen(false);
      }, 2000);

    } catch (err: any) {
      if (err.code === 'auth/wrong-password') {
        setError("Senha atual incorreta.");
      } else {
        setError(err.message || "Falha ao atualizar o perfil.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
      <Dialog.Trigger asChild>
        <button className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center">
          <UserIcon className="h-4 w-4 mr-2" />
          Editar Perfil
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="bg-black/60 fixed inset-0" />
        <Dialog.Content className="fixed top-1/2 left-1/2 w-[90vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white dark:bg-[#2f2b3a] p-6 shadow-lg focus:outline-none">
          <Dialog.Title className="text-gray-800 dark:text-white text-lg font-medium">Editar Perfil</Dialog.Title>
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Nome Completo</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required className="w-full mt-1 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-white rounded px-3 py-2 border border-gray-300 dark:border-gray-700" />
            </div>
            
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
              <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300">Alterar Senha (Opcional)</h3>
              <div className="space-y-4 mt-2">
                <div className="relative">
                  <input type={showCurrentPassword ? "text" : "password"} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Senha Atual" className="w-full bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-white rounded px-3 py-2 border border-gray-300 dark:border-gray-700 pr-10"/>
                  <button type="button" onClick={() => setShowCurrentPassword(!showCurrentPassword)} className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 dark:text-gray-400">
                    {showCurrentPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                <div className="relative">
                  <input type={showNewPassword ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Nova Senha" className="w-full bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-white rounded px-3 py-2 border border-gray-300 dark:border-gray-700 pr-10"/>
                  <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 dark:text-gray-400">
                    {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                <div className="relative">
                  <input type={showConfirmNewPassword ? "text" : "password"} value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} placeholder="Confirmar Nova Senha" className="w-full bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-white rounded px-3 py-2 border border-gray-300 dark:border-gray-700 pr-10"/>
                   <button type="button" onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)} className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 dark:text-gray-400">
                    {showConfirmNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
            </div>
            
            {error && <p className="text-sm text-center text-red-500">{error}</p>}
            {success && <p className="text-sm text-center text-green-500">{success}</p>}
            
            <div className="flex justify-end mt-6">
               <Dialog.Close asChild>
                <button type="button" className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white rounded hover:bg-gray-300 dark:hover:bg-gray-500 mr-4">Cancelar</button>
              </Dialog.Close>
              <button type="submit" disabled={isLoading} className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:bg-purple-800">
                {isLoading ? "Salvando..." : "Salvar Alterações"}
              </button>
            </div>
          </form>
          <Dialog.Close asChild>
            <button className="absolute top-3 right-3 text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white"><X /></button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
