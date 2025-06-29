"use client";

import { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { User as UserIcon, X } from 'lucide-react';
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { useUser } from '@/contexts/UserContext';

export function EditProfileModal() {
  const { user, loading } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  
  const [name, setName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (user && isOpen) {
      setName(user.name);
    }
    // Reset form state when modal is closed
    if (!isOpen) {
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
      // Atualiza o nome no Firestore
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { name: name });

      // Se o usuário digitou uma nova senha, tenta atualizá-la
      if (newPassword) {
        if (newPassword.length < 6) {
          throw new Error("A nova senha precisa ter no mínimo 6 caracteres.");
        }
        if (newPassword !== confirmNewPassword) {
          throw new Error("As novas senhas não coincidem.");
        }
        if (!currentPassword) {
          throw new Error("Você precisa fornecer sua senha atual para alterar a senha.");
        }

        const firebaseUser = auth.currentUser;
        if (firebaseUser) {
          const credential = EmailAuthProvider.credential(user.email, currentPassword);
          await reauthenticateWithCredential(firebaseUser, credential);
          await updatePassword(firebaseUser, newPassword);
        }
      }

      setSuccess("Perfil atualizado com sucesso!");
      
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');

      setTimeout(() => setIsOpen(false), 2000); 

    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/wrong-password') {
        setError("Senha atual incorreta.");
      } else {
        setError(err.message || "Falha ao atualizar o perfil.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) {
    return (
      <button className="w-full bg-gray-300 dark:bg-gray-700 h-10 rounded-lg animate-pulse" disabled></button>
    )
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
      <Dialog.Trigger asChild>
        <button className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center">
            <UserIcon className="h-4 w-4 mr-2" /> Editar Perfil
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="bg-black/60 fixed inset-0 z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 w-[90vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white dark:bg-[#2f2b3a] p-6 shadow-lg focus:outline-none">
          <Dialog.Title className="text-gray-800 dark:text-white text-lg font-medium">Editar Perfil</Dialog.Title>
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label htmlFor='name' className="text-sm font-medium text-gray-600 dark:text-gray-400">Nome Completo</label>
              <input id="name" value={name} onChange={(e) => setName(e.target.value)} required className="w-full mt-1 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-white rounded px-3 py-2 border border-gray-300 dark:border-gray-700" />
            </div>
            <div className="border-t border-gray-200 dark:border-gray-700 my-4"></div>
            <h3 className="text-md font-semibold text-gray-800 dark:text-white">Alterar Senha (Opcional)</h3>
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Senha Atual" className="w-full mt-1 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-white rounded px-3 py-2 border border-gray-300 dark:border-gray-700"/>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Nova Senha (mín. 6 caracteres)" className="w-full mt-1 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-white rounded px-3 py-2 border border-gray-300 dark:border-gray-700"/>
            <input type="password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} placeholder="Confirmar Nova Senha" className="w-full mt-1 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-white rounded px-3 py-2 border border-gray-300 dark:border-gray-700"/>
            
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            {success && <p className="text-green-500 text-sm text-center">{success}</p>}
            
            <div className="flex justify-end gap-4 mt-6">
                <Dialog.Close asChild>
                    <button type="button" className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white rounded hover:bg-gray-300 dark:hover:bg-gray-500">Cancelar</button>
                </Dialog.Close>
                <button type="submit" disabled={isLoading} className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:bg-purple-800">
                    {isLoading ? "Salvando..." : "Salvar Alterações"}
                </button>
            </div>
          </form>
          <Dialog.Close asChild>
            <button className="absolute top-3 right-3 text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white">
                <X />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
