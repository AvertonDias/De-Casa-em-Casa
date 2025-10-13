
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useUser } from '@/contexts/UserContext';
import { updateProfile, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { auth, app } from '@/lib/firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, KeyRound, Loader, Eye, EyeOff } from 'lucide-react';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { useToast } from '@/hooks/use-toast';
import { maskPhone } from '@/lib/utils';
import emailjs from '@emailjs/browser';

const functions = getFunctions(app, 'southamerica-east1');
const deleteUserAccountFn = httpsCallable(functions, 'deleteUserAccount');

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
  
  // States for delete confirmation
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [showDeletePassword, setShowDeletePassword] = useState(false);
  const [deleteError, setDeleteError] = useState('');


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
      setDeletePassword('');
      setDeleteError('');
      
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

    if (!whatsapp.trim() || !name.trim()) {
        setError("Nome e WhatsApp são obrigatórios.");
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
      const response = await fetch('https://southamerica-east1-appterritorios-e5bb5.cloudfunctions.net/requestPasswordReset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email }),
      });
      
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Falha ao gerar token de redefinição.");
      }
      
      if (result.token) {
        const resetLink = `${window.location.origin}/auth/action?token=${result.token}`;
        
        await emailjs.send(
          'service_w3xe95d',
          'template_wzczhks',
          { to_email: user.email, reset_link: resetLink },
          'JdR2XKNICKcHc1jny'
        );
      }

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

  const handleSelfDeleteRequest = () => {
    if (!user || !auth.currentUser) return;
    setIsDeleteModalOpen(true);
  }

  const confirmSelfDelete = async () => {
    if (!user || !auth.currentUser?.email || !deletePassword) {
        setDeleteError("A senha é obrigatória.");
        return;
    }
    
    setLoading(true);
    setDeleteError('');
    
    try {
        const credential = EmailAuthProvider.credential(auth.currentUser.email, deletePassword);
        await reauthenticateWithCredential(auth.currentUser, credential);
        
        await deleteUserAccountFn({ userIdToDelete: user.uid });
        
        toast({
          title: "Conta Excluída",
          description: "Sua conta foi removida com sucesso. Você será desconectado.",
        });
        
        setIsDeleteModalOpen(false);
        onOpenChange(false);
        await logout();

    } catch (error: any) {
         console.error("Erro na autoexclusão:", error);
         if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
             setDeleteError("A senha está incorreta. Tente novamente.");
         } else if (error.message.includes("administrador não pode se autoexcluir")) {
            setDeleteError("Um administrador não pode se autoexcluir.");
         } else {
            setDeleteError("Ocorreu um erro ao tentar excluir a conta.");
         }
         // Somente fecha o modal de confirmação se for um erro que não seja de senha incorreta
         if (error.code !== 'auth/wrong-password' && error.code !== 'auth/invalid-credential') {
            setIsDeleteModalOpen(false);
         }
    } finally {
        setLoading(false);
    }
  }

  const whatsappMismatch = whatsapp !== confirmWhatsapp;

  return (
    <>
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
                <p className="text-sm text-muted-foreground mt-1 mb-2">Para habilitar a exclusão, digite sua senha.</p>
                 <div className="relative">
                    <Input
                        id="delete-password-enable"
                        type={showDeletePassword ? "text" : "password"}
                        value={deletePassword}
                        onChange={(e) => setDeletePassword(e.target.value)}
                        placeholder="Digite sua senha para habilitar"
                        className="pr-10"
                    />
                    <button type="button" onClick={() => setShowDeletePassword(!showDeletePassword)} className="absolute bottom-2 right-3 text-muted-foreground">
                        {showDeletePassword ? <EyeOff size={20}/> : <Eye size={20}/>}
                    </button>
                </div>
                {deleteError && <p className="text-destructive text-sm text-center mt-2">{deleteError}</p>}
                
                <Button
                  variant="destructive"
                  onClick={handleSelfDeleteRequest}
                  disabled={loading || !deletePassword}
                  className="w-full mt-2"
                >
                  <Trash2 size={16} className="mr-2"/>
                  Excluir Minha Conta
                </Button>
              </div>
          </div>
          
          {error && <p className="text-destructive text-sm px-6 pb-4 text-center">{error}</p>}
        </DialogContent>
      </Dialog>
      
      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmSelfDelete}
        title="Confirmar Exclusão"
        message={
          <div className="space-y-4">
            <p>Esta é uma ação definitiva e irreversível. Todos os seus dados serão permanentemente apagados. Você tem certeza absoluta que deseja continuar?</p>
            {deleteError && <p className="text-destructive text-sm text-center">{deleteError}</p>}
          </div>
        }
        confirmText="Sim, excluir minha conta"
        isLoading={loading}
      />
    </>
  );
}
