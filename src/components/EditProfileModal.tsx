
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useUser } from '@/contexts/UserContext';
import { updateProfile } from 'firebase/auth';
import { auth, app } from '@/lib/firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Eye, EyeOff, Trash2, KeyRound, Loader } from 'lucide-react';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { useToast } from '@/hooks/use-toast';
import { maskPhone } from '@/lib/utils'; // Importa a máscara

const functions = getFunctions(app, 'southamerica-east1');
const deleteUserAccountFn = httpsCallable(functions, 'deleteUserAccount');
const requestPasswordResetFn = httpsCallable(functions, 'requestPasswordReset');


export function EditProfileModal({ isOpen, onOpenChange }: { isOpen: boolean, onOpenChange: (isOpen: boolean) => void }) {
  const { user, updateUser, logout } = useUser();
  const { toast } = useToast();
  
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [confirmWhatsapp, setConfirmWhatsapp] = useState(''); 
  const [error, setError] = useState<string | null>(null);
  const [passwordResetSuccess, setPasswordResetSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [passwordResetLoading, setPasswordResetLoading] = useState(false);
  
  const [passwordForDelete, setPasswordForDelete] = useState('');
  const [showPasswordForDelete, setShowPasswordForDelete] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const whatsappInputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    if (user && isOpen) {
      setName(user.name);
      const initialWhatsapp = user.whatsapp || '';
      setWhatsapp(initialWhatsapp);
      setConfirmWhatsapp(initialWhatsapp);
      setError(null);
      setPasswordResetSuccess(null);
      setPasswordForDelete('');
      
      setTimeout(() => {
        if (!initialWhatsapp && whatsappInputRef.current) {
          whatsappInputRef.current.focus();
        } else if (nameInputRef.current) {
          nameInputRef.current.focus();
          nameInputRef.current.select();
        }
      }, 100);
    }
  }, [user, isOpen]);

  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPasswordResetSuccess(null);
    setLoading(true);

    if (!whatsapp.trim()) {
        setError("O campo WhatsApp é obrigatório.");
        setLoading(false);
        return;
    }

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
    if (!user || !user.email) {
      toast({ title: "Erro", description: "E-mail do usuário não encontrado.", variant: "destructive" });
      return;
    }
    setPasswordResetLoading(true);
    setError(null);
    setPasswordResetSuccess(null);

    try {
      await requestPasswordResetFn({ email: user.email });
      setPasswordResetSuccess(
        `Link enviado para ${user.email}. Se não o encontrar, verifique sua caixa de SPAM.`
      );

    } catch (error: any) {
      console.error("Erro no processo de redefinição de senha:", error);
      toast({
        title: "Erro ao enviar e-mail",
        description: error.message || "Não foi possível iniciar o processo de redefinição. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setPasswordResetLoading(false);
    }
  };

  const handleSelfDelete = () => {
    if (!user || !auth.currentUser) return;
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
            setError("Ocorreu um erro ao tentar excluir a conta.");
         }
    } finally {
        setLoading(false);
        setIsConfirmModalOpen(false);
    }
  }

  const whatsappMismatch = whatsapp !== confirmWhatsapp;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-md p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="p-6 pb-4">
          <DialogTitle>Editar Perfil</DialogTitle>
          <DialogDescription>
            Altere seu nome e WhatsApp. Para alterar sua senha, use o botão de redefinição por e-mail.
          </DialogDescription>
        </DialogHeader>
        
        <div className="px-6 space-y-4 max-h-[60vh] overflow-y-auto">
          <form id="edit-profile-form" onSubmit={handleSaveChanges} className="space-y-4">
            <div>
                <label htmlFor="name" className="text-sm font-medium text-muted-foreground">Nome Completo</label>
                <Input ref={nameInputRef} id="name" type="text" value={name} onChange={e => setName(e.target.value)} required className="mt-1"/>
              </div>
              <div>
                <label htmlFor="whatsapp" className="text-sm font-medium text-muted-foreground">WhatsApp</label>
                <Input 
                  ref={whatsappInputRef}
                  id="whatsapp" 
                  type="tel" 
                  value={whatsapp} 
                  onChange={e => setWhatsapp(maskPhone(e.target.value))} 
                  placeholder="(XX) XXXXX-XXXX" 
                  required
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
                  required
                  className={`mt-1 ${whatsappMismatch ? 'border-destructive' : ''}`}
                />
                {whatsappMismatch && (
                    <p className="text-xs text-destructive mt-1">Os números de WhatsApp não coincidem.</p>
                )}
              </div>
              
              <div className="pt-2 border-t border-border">
                <Button 
                  type="button"
                  variant="outline" 
                  onClick={handleSendPasswordReset} 
                  disabled={passwordResetLoading}
                  className="w-full text-blue-500 border-blue-500/50 hover:bg-blue-500/10 hover:text-blue-500 dark:text-blue-400 dark:border-blue-400/50 dark:hover:bg-blue-400/10 dark:hover:text-blue-400"
                >
                  {passwordResetLoading ? <Loader className="animate-spin mr-2" /> : <KeyRound className="mr-2" size={16} />}
                  Enviar Link para Redefinir Senha
                </Button>
                {passwordResetSuccess && (
                  <p className="text-sm text-green-600 dark:text-green-400 font-semibold text-center mt-3 p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                    {passwordResetSuccess.split('SPAM').map((part, index) =>
                      <React.Fragment key={index}>
                        {index > 0 && <strong className="underline">SPAM</strong>}
                        {part}
                      </React.Fragment>
                    )}
                  </p>
                )}
              </div>
          </form>
        </div>


        <DialogFooter className="p-6 pt-4 border-t">
          <DialogClose asChild>
              <Button type="button" variant="secondary" className="bg-muted hover:bg-muted/80">Cancelar</Button>
          </DialogClose>
          <Button type="submit" form="edit-profile-form" disabled={loading || whatsappMismatch || !whatsapp.trim() || !name.trim()}>
            {loading ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </DialogFooter>

        <div className="px-6 pb-6">
            <div className="pt-4 border-t border-red-500/30">
              <h4 className="text-md font-semibold text-destructive">Zona de Perigo</h4>
              <p className="text-sm text-muted-foreground mt-1">A ação abaixo é permanente e não pode ser desfeita.</p>

              <Button
                variant="destructive"
                onClick={handleSelfDelete}
                disabled={loading}
                className="w-full mt-2"
              >
                <Trash2 size={16} className="mr-2"/>
                Excluir Minha Conta
              </Button>
            </div>
        </div>
        
        {error && <p className="text-destructive text-sm px-6 pb-4 text-center">{error}</p>}
        
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