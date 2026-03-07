
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useUser } from '@/contexts/UserContext';
import { reauthenticateWithCredential, EmailAuthProvider, updateProfile, sendPasswordResetEmail, deleteUser, GoogleAuthProvider, reauthenticateWithPopup } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Eye, EyeOff, Trash2, KeyRound, Loader, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { maskPhone } from '@/lib/utils';
import { useAndroidBack } from '@/hooks/useAndroidBack';
import { doc, deleteDoc } from 'firebase/firestore';

export function EditProfileModal({ isOpen, onOpenChange }: { isOpen: boolean, onOpenChange: (isOpen: boolean) => void }) {
  const { user, updateUser, logout } = useUser();
  const { toast } = useToast();
  
  useAndroidBack({
    enabled: isOpen,
    onClose: () => onOpenChange(false),
  });

  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [confirmWhatsapp, setConfirmWhatsapp] = useState(''); 
  const [error, setError] = useState<string | null>(null);
  const [passwordResetSuccess, setPasswordResetSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [passwordResetLoading, setPasswordResetLoading] = useState(false);
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [passwordForDelete, setPasswordForDelete] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const whatsappInputRef = useRef<HTMLInputElement>(null);

  const isGoogleUser = auth.currentUser?.providerData.some(p => p.providerId === 'google.com');

  useEffect(() => {
    if (user && isOpen) {
      setName(user.name);
      const initialWhatsapp = user.whatsapp || '';
      setWhatsapp(initialWhatsapp);
      setConfirmWhatsapp(initialWhatsapp);
      setError(null);
      setPasswordResetSuccess(null);
      setPasswordForDelete('');
      setShowDeleteConfirm(false);
      
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

    if (whatsapp.length < 15 || confirmWhatsapp.length < 15) {
        setError("Por favor, preencha os números de WhatsApp completos.");
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
      const dataToUpdate: Partial<{ name: string; whatsapp: string }> = {};

      if (name.trim() !== user.name) {
        await updateProfile(auth.currentUser, { displayName: name.trim() });
        dataToUpdate.name = name.trim();
      }
      
      if (whatsapp !== (user.whatsapp || '')) {
        dataToUpdate.whatsapp = whatsapp;
      }

      if (Object.keys(dataToUpdate).length > 0) {
        await updateUser(dataToUpdate);
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
    setPasswordResetLoading(true);
    setError(null);
    setPasswordResetSuccess(null);

    try {
        await sendPasswordResetEmail(auth, auth.currentUser.email);
        setPasswordResetSuccess(
            `Link enviado para ${auth.currentUser.email}. Se não o encontrar, verifique sua caixa de SPAM.`
        );
    } catch (error: any) {
      console.error("Erro ao enviar reset de senha:", error);
      toast({
        title: "Erro ao enviar e-mail",
        description: "Não foi possível enviar o link de redefinição no momento.",
        variant: "destructive",
      });
    } finally {
      setPasswordResetLoading(false);
    }
  };

  const confirmSelfDelete = async () => {
    if (!user || !auth.currentUser?.email) return;
    
    setLoading(true);
    setError(null);
    
    try {
        const currentUser = auth.currentUser;
        
        if (isGoogleUser) {
            const provider = new GoogleAuthProvider();
            await reauthenticateWithPopup(currentUser, provider);
        } else {
            if (!passwordForDelete) {
                setError("Senha é necessária para exclusão.");
                setLoading(false);
                return;
            }
            const credential = EmailAuthProvider.credential(currentUser.email!, passwordForDelete);
            await reauthenticateWithCredential(currentUser, credential);
        }
        
        await deleteDoc(doc(db, 'users', user.uid));
        await deleteUser(currentUser);
        
        toast({
          title: "Conta Excluída",
          description: "Sua conta foi removida com sucesso.",
        });
        
        onOpenChange(false);

    } catch (error: any) {
         console.error("Erro na autoexclusão:", error);
         if (error.code?.includes('auth/invalid-credential') || error.code?.includes('auth/wrong-password')) {
             setError("Senha incorreta. A exclusão foi cancelada.");
         } else if (error.code?.includes('auth/popup-closed-by-user')) {
             setError("A autenticação com Google foi cancelada.");
         } else {
            setError(error.message || "Ocorreu um erro ao tentar excluir a conta.");
         }
    } finally {
        setLoading(false);
    }
  }

  const whatsappMismatch = whatsapp !== confirmWhatsapp;
  const hasChanges = (user && (name !== user.name || whatsapp !== (user.whatsapp || '')));
  const isSaveDisabled = loading || whatsappMismatch || whatsapp.length < 15 || !name.trim() || !hasChanges;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-md p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="p-6 pb-4">
          <DialogTitle>Editar Perfil</DialogTitle>
          <DialogDescription>
            Altere seu nome e WhatsApp. {isGoogleUser && "Como você entrou com o Google, use a redefinição abaixo para criar uma senha própria."}
          </DialogDescription>
          {user?.email && (
            <div className="mt-2 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  E-mail: <span className="font-semibold text-foreground">{user.email}</span>
                </p>
                {isGoogleUser && (
                    <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full font-bold">CONTA GOOGLE</span>
                )}
            </div>
          )}
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
                <div className="mb-3 p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                    <p className="text-xs text-blue-400 flex items-start gap-2">
                        <AlertCircle size={14} className="shrink-0 mt-0.5" />
                        <span>Se você quiser entrar usando apenas e-mail e senha (sem o Google), clique abaixo para <b>criar sua senha pela primeira vez</b>.</span>
                    </p>
                </div>
                <Button 
                  type="button"
                  variant="outline" 
                  onClick={handleSendPasswordReset} 
                  disabled={passwordResetLoading}
                  className="w-full text-blue-500 border-blue-500/50 hover:bg-blue-500/10 hover:text-blue-500 dark:text-blue-400 dark:border-blue-400/50 dark:hover:bg-blue-400/10 dark:hover:text-blue-400"
                >
                  {passwordResetLoading ? <Loader className="animate-spin mr-2" /> : <KeyRound className="mr-2" size={16} />}
                  {isGoogleUser ? "Criar Senha / Redefinir" : "Redefinir Minha Senha"}
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
          <Button type="submit" form="edit-profile-form" disabled={isSaveDisabled}>
            {loading ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </DialogFooter>

        <div className="px-6 pb-6">
            <div className="pt-4 border-t border-red-500/30">
              <h4 className="text-md font-semibold text-destructive">Zona de Perigo</h4>
              {!showDeleteConfirm && (
                <>
                  <p className="text-sm text-muted-foreground mt-1">A ação abaixo é permanente e não pode ser desfeita.</p>
                  <Button
                    variant="destructive"
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={loading}
                    className="w-full mt-2"
                  >
                    <Trash2 size={16} className="mr-2"/>
                    Excluir Minha Conta
                  </Button>
                </>
              )}
              
              {showDeleteConfirm && (
                <div className="mt-2 p-4 bg-destructive/10 rounded-lg border border-destructive/20 space-y-3">
                  <p className="text-sm font-semibold">
                    {isGoogleUser 
                        ? "Como você usa o Google, pediremos para você confirmar sua conta Google novamente."
                        : "Para confirmar a exclusão, digite sua senha atual."
                    }
                  </p>
                  
                  {!isGoogleUser && (
                    <div className="relative">
                        <Input 
                        id="password-for-delete"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        value={passwordForDelete}
                        onChange={(e) => setPasswordForDelete(e.target.value)}
                        placeholder="Digite sua senha para confirmar"
                        autoFocus
                        />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute bottom-2 right-3 text-muted-foreground">
                            {showPassword ? <EyeOff size={20}/> : <Eye size={20}/>}
                        </button>
                    </div>
                  )}

                  <div className="flex gap-2 justify-end">
                      <Button variant="secondary" size="sm" onClick={() => setShowDeleteConfirm(false)}>Cancelar</Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={confirmSelfDelete}
                        disabled={loading || (!isGoogleUser && passwordForDelete.length < 6)}
                      >
                         {loading ? <Loader className="animate-spin" /> : (isGoogleUser ? 'Confirmar via Google' : 'Confirmar Exclusão')}
                      </Button>
                  </div>
                </div>
              )}
            </div>
        </div>
        
        {error && <p className="text-destructive text-sm px-6 pb-4 text-center">{error}</p>}
      </DialogContent>
    </Dialog>
  );
}
