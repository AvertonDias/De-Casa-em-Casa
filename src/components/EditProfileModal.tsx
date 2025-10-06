"use client";

import { useState, useEffect } from 'react';
import { useUser } from '@/contexts/UserContext';
import { updateProfile, sendPasswordResetEmail } from 'firebase/auth';
import { auth, app } from '@/lib/firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Eye, EyeOff, Trash2, KeyRound } from 'lucide-react';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { useToast } from '@/hooks/use-toast';
import { maskPhone } from '@/lib/utils'; // Importa a máscara

const functions = getFunctions(app, 'southamerica-east1');
const deleteUserAccountFn = httpsCallable(functions, 'deleteUserAccount');

export function EditProfileModal({ isOpen, onOpenChange }: { isOpen: boolean, onOpenChange: (isOpen: boolean) => void }) {
  const { user, updateUser, logout } = useUser();
  const { toast } = useToast();
  
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [confirmWhatsapp, setConfirmWhatsapp] = useState(''); 
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  const [passwordForDelete, setPasswordForDelete] = useState('');
  const [showPasswordForDelete, setShowPasswordForDelete] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  
  useEffect(() => {
    if (user && isOpen) {
      setName(user.name);
      const initialWhatsapp = user.whatsapp || '';
      setWhatsapp(initialWhatsapp);
      setConfirmWhatsapp(initialWhatsapp);
      setError(null);
      setSuccess(null);
      setPasswordForDelete('');
    }
  }, [user, isOpen]);

  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    if (whatsapp !== confirmWhatsapp) {
      setError("Os números de WhatsApp não coincidem.");
      setLoading(false);
      return;
    }

    if (!user || !auth.currentUser) {
      setError("Usuário não encontrado. Por favor, faça login novamente.");
      setLoading(false);
      return;
    }

    try {
      let changesMade = false;
      const dataToUpdate: Partial<{ name: string; whatsapp: string }> = {};

      if (name.trim() !== user.name) {
        await updateProfile(auth.currentUser, { displayName: name.trim() });
        dataToUpdate.name = name.trim();
        changesMade = true;
      }
      
      if (whatsapp !== (user.whatsapp || '')) {
        dataToUpdate.whatsapp = whatsapp;
        changesMade = true;
      }

      if (Object.keys(dataToUpdate).length > 0) {
        await updateUser(dataToUpdate);
      }

      if (changesMade) {
        toast({
          title: "Sucesso!",
          description: "Seu perfil foi atualizado com sucesso.",
        });
        onOpenChange(false);
      } else {
         toast({
          title: "Nenhuma alteração detectada",
          description: "Não havia novas informações para salvar.",
        });
      }

    } catch (error: any) {
      console.error("Erro ao salvar perfil:", error);
      setError("Ocorreu um erro ao salvar as alterações.");
    } finally {
      setLoading(false);
    }
  };

  const handleSendPasswordReset = async () => {
    if (!auth.currentUser?.email) {
      toast({ title: "Erro", description: "E-mail do usuário não encontrado.", variant: "destructive" });
      return;
    }
    try {
      await sendPasswordResetEmail(auth, auth.currentUser.email, {
        url: `${window.location.origin}/auth/action`,
      });
      toast({
        title: "Link Enviado!",
        description: "Um e-mail de redefinição de senha foi enviado para você.",
      });
    } catch (error) {
      toast({
        title: "Erro ao enviar e-mail",
        description: "Não foi possível enviar o e-mail de redefinição. Tente novamente.",
        variant: "destructive",
      });
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
    if (!user || !auth.currentUser?.email) return;
    
    setLoading(true);
    setError(null);
    try {
        await deleteUserAccountFn({ userIdToDelete: user.uid });
        toast({
          title: "Conta Excluída",
          description: "Sua conta foi removida com sucesso. Você será desconectado.",
        });
        onOpenChange(false);
        await logout();

    } catch (error: any) {
         console.error("Erro na autoexclusão:", error);
         if (error.message.includes("administrador não pode se autoexcluir")) {
            setError("Um administrador não pode se autoexcluir.");
         } else {
            setError("Ocorreu um erro ao tentar excluir a conta. A senha pode estar incorreta.");
         }
    } finally {
        setLoading(false);
        setIsConfirmModalOpen(false);
    }
  }

  const whatsappMismatch = whatsapp !== confirmWhatsapp;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Perfil</DialogTitle>
          <DialogDescription>
            Altere seu nome e WhatsApp. Para alterar sua senha, use o botão de redefinição por e-mail.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSaveChanges} className="mt-4 space-y-4">
           <div>
              <label htmlFor="name" className="text-sm font-medium text-muted-foreground">Nome Completo</label>
              <Input id="name" type="text" value={name} onChange={e => setName(e.target.value)} required className="mt-1"/>
            </div>
            <div>
              <label htmlFor="whatsapp" className="text-sm font-medium text-muted-foreground">WhatsApp</label>
              <Input 
                id="whatsapp" 
                type="tel" 
                value={whatsapp} 
                onChange={e => setWhatsapp(maskPhone(e.target.value))} 
                placeholder="(XX) XXXXX-XXXX" 
                className="mt-1"
              />
            </div>
            <div>
              <label htmlFor="confirmWhatsapp" className="text-sm font-medium text-muted-foreground">Confirmar WhatsApp</label>
              <Input 
                id="confirmWhatsapp" 
                type="tel" 
                value={confirmWhatsapp} 
                onChange={e => setConfirmWhatsapp(maskPhone(e.target.value))} 
                placeholder="Repita seu WhatsApp" 
                className={`mt-1 ${whatsappMismatch ? 'border-destructive' : ''}`}
              />
              {whatsappMismatch && (
                  <p className="text-xs text-destructive mt-1">Os números de WhatsApp não coincidem.</p>
              )}
            </div>
            
          <div className="mt-6">
            {success && <p className="text-green-500 text-sm mb-2 text-center">{success}</p>}
            <Button type="submit" disabled={loading || whatsappMismatch} className="w-full">
              {loading ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </div>
        </form>

        <div className="mt-6 pt-4 border-t border-border">
          <Button variant="outline" onClick={handleSendPasswordReset} className="w-full">
            <KeyRound className="mr-2" size={16} />
            Enviar Link para Redefinir Senha
          </Button>
        </div>


        <div className="mt-6 pt-4 border-t border-red-500/30">
          <h4 className="text-md font-semibold text-destructive">Zona de Perigo</h4>
          <p className="text-sm text-muted-foreground mt-1">A ação abaixo é permanente e não pode ser desfeita.</p>
          <div className="relative mt-4">
              <Input
                type={showPasswordForDelete ? "text" : "password"}
                value={passwordForDelete}
                onChange={(e) => setPasswordForDelete(e.target.value)}
                placeholder="Digite sua senha atual para confirmar"
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
