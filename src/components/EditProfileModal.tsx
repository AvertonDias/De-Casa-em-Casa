
"use client";

import { useState, useEffect } from 'react';
import { useUser } from '@/contexts/UserContext';
import { getAuth, updateProfile, reauthenticateWithCredential, EmailAuthProvider, updatePassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Eye, EyeOff, Trash2 } from 'lucide-react';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { useToast } from '@/hooks/use-toast';

export function EditProfileModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const { user, updateUser, logout } = useUser();
  const { toast } = useToast();
  
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
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  
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
      if (name.trim() !== auth.currentUser.displayName) {
        await updateProfile(auth.currentUser, { displayName: name.trim() });
      }
      
      if (name.trim() !== user.name) {
        await updateUser({ name: name.trim() });
      }

      setSuccess("Perfil atualizado com sucesso!");

      if (newPassword && currentPassword && auth.currentUser.email) {
        const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
        await reauthenticateWithCredential(auth.currentUser, credential);
        await updatePassword(auth.currentUser, newPassword);
        setSuccess(name.trim() !== user.name ? "Perfil e senha atualizados com sucesso!" : "Senha atualizada com sucesso!");
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
      }
      
      if (name.trim() === user.name && !newPassword) {
        setSuccess("Nenhuma alteração para salvar.");
      }

    } catch (error: any) {
      console.error("Erro ao salvar perfil:", error);
      setError(error.code === 'auth/wrong-password' ? "Senha atual incorreta." : "Ocorreu um erro ao salvar as alterações.");
    } finally {
      setLoading(false);
      setTimeout(() => setSuccess(null), 4000);
    }
  };

  const handleSelfDelete = () => {
    if (!user || !auth.currentUser) return;

    if(!passwordForDelete) {
        setError("Para excluir sua conta, por favor, insira sua senha atual.");
        return;
    }
    setIsConfirmModalOpen(true);
  }

  const confirmSelfDelete = async () => {
    if (!user || !auth.currentUser) return;
    
    setLoading(true);
    setError(null);
    try {
        const credential = EmailAuthProvider.credential(auth.currentUser.email!, passwordForDelete);
        await reauthenticateWithCredential(auth.currentUser, credential);
        
        const idToken = await auth.currentUser.getIdToken();
        const response = await fetch('/api/deleteUserAccount', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`,
            },
            body: JSON.stringify({ userIdToDelete: user.uid }),
        });

        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.error || 'Falha ao excluir conta.');
        }

        toast({
          title: "Conta Excluída",
          description: "Sua conta foi removida com sucesso. Você será desconectado.",
        });

        onClose();
        await logout(); // Desloga o usuário após a exclusão bem-sucedida

    } catch (error: any) {
         console.error("Erro na autoexclusão:", error);
         if (error.code === 'auth/wrong-password') {
            setError("Senha incorreta. A exclusão não foi realizada.");
         } else if (error.message.includes("administrador não pode se autoexcluir")) {
            setError("Um administrador não pode se autoexcluir.");
         } else {
            setError("Ocorreu um erro ao tentar excluir a conta.");
         }
    } finally {
        setLoading(false);
        setIsConfirmModalOpen(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Perfil</DialogTitle>
          <DialogDescription>
            Altere seu nome ou senha. Para excluir sua conta, use a seção "Zona de Perigo".
          </DialogDescription>
          <DialogClose asChild>
            <button className="absolute top-3 right-3 p-1 rounded-full hover:bg-muted"><X size={20} /></button>
          </DialogClose>
        </DialogHeader>
        
        <form onSubmit={handleSaveChanges} className="mt-4 space-y-4">
           <div>
              <label htmlFor="name" className="text-sm font-medium text-muted-foreground">Nome Completo</label>
              <Input id="name" type="text" value={name} onChange={e => setName(e.target.value)} required className="mt-1"/>
            </div>

            <div className="border-t border-border pt-4">
                <p className="text-sm font-medium text-muted-foreground mb-2">Alterar Senha (Opcional)</p>
                 <div className="relative space-y-2">
                    <div className="relative">
                      <Input type={showCurrentPassword ? 'text' : 'password'} value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="Senha Atual" />
                      <button type="button" onClick={() => setShowCurrentPassword(!showCurrentPassword)} className="absolute inset-y-0 right-0 px-3 flex items-center text-muted-foreground">
                          {showCurrentPassword ? <EyeOff size={20}/> : <Eye size={20}/>}
                      </button>
                    </div>
                     <div className="relative">
                        <Input type={showNewPassword ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Nova Senha" />
                        <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute inset-y-0 right-0 px-3 flex items-center text-muted-foreground">
                            {showNewPassword ? <EyeOff size={20}/> : <Eye size={20}/>}
                        </button>
                    </div>
                    <Input type="password" value={confirmNewPassword} onChange={e => setConfirmNewPassword(e.target.value)} placeholder="Confirmar Nova Senha" />
                </div>
            </div>
            
          <div className="mt-6">
            {success && <p className="text-green-500 text-sm mb-2 text-center">{success}</p>}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </div>
        </form>

        <div className="mt-6 pt-4 border-t border-red-500/30">
          <h4 className="text-md font-semibold text-destructive">Zona de Perigo</h4>
          <p className="text-sm text-muted-foreground mt-1">A ação abaixo é permanente e não pode ser desfeita.</p>
          <div className="relative mt-4">
              <Input
                type={showPasswordForDelete ? "text" : "password"}
                value={passwordForDelete}
                onChange={(e) => setPasswordForDelete(e.target.value)}
                placeholder="Digite sua senha para confirmar"
                className="border-red-500/50 focus-visible:ring-destructive"
              />
              <button type="button" onClick={() => setShowPasswordForDelete(!showPasswordForDelete)} className="absolute inset-y-0 right-0 px-3 flex items-center text-muted-foreground">
                {showPasswordForDelete ? <EyeOff size={20}/> : <Eye size={20}/>}
              </button>
          </div>

          <Button
            variant="destructive"
            onClick={handleSelfDelete}
            disabled={loading || !passwordForDelete}
            className="w-full mt-2"
          >
            <Trash2 size={16} className="mr-2"/>
            Excluir Minha Conta
          </Button>
        </div>
        
        {error && <p className="text-destructive text-sm mt-4 text-center">{error}</p>}
        
        <ConfirmationModal
          isOpen={isConfirmModalOpen}
          onClose={() => setIsConfirmModalOpen(false)}
          onConfirm={confirmSelfDelete}
          title="Excluir Minha Conta"
          message="Esta é uma ação definitiva e irreversível. Todos os seus dados serão permanentemente apagados. Você tem certeza absoluta que deseja continuar?"
          confirmText="Sim, excluir minha conta"
        />

      </DialogContent>
    </Dialog>
  );
}
