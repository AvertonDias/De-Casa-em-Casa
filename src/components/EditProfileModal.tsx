"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useUser } from '@/contexts/UserContext';
import { reauthenticateWithCredential, EmailAuthProvider, updateProfile, sendPasswordResetEmail, deleteUser, GoogleAuthProvider, reauthenticateWithPopup } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Eye, EyeOff, Trash2, KeyRound, Loader, AlertCircle, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { maskPhone, cn } from '@/lib/utils';
import { useAndroidBack } from '@/hooks/useAndroidBack';
import { doc, deleteDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

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

  // Identificação do tipo de conta
  const isGoogleUser = auth.currentUser?.providerData.some(p => p.providerId === 'google.com');
  const hasPassword = auth.currentUser?.providerData.some(p => p.providerId === 'password');

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
            `Link enviado para ${auth.currentUser.email}. Se não o encontrar em 2 minutos, verifique sua caixa de SPAM.`
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
        
        const userDocRef = doc(db, 'users', user.uid);
        
        // Excluir o documento no Firestore primeiro
        await deleteDoc(userDocRef).catch(async (dbError) => {
            if (dbError.code === 'permission-denied') {
                const permissionError = new FirestorePermissionError({
                    path: userDocRef.path,
                    operation: 'delete',
                } satisfies SecurityRuleContext);
                errorEmitter.emit('permission-error', permissionError);
            }
            throw dbError;
        });

        // Só depois excluir o acesso (Auth)
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
         } else if (error.code === 'permission-denied') {
             // O erro de permissão agora é emitido via global listener
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
        className="max-w-md p-0 overflow-hidden"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="p-6 pb-4">
          <DialogTitle>Editar Perfil</DialogTitle>
          <DialogDescription>
            Altere seu nome e WhatsApp.
          </DialogDescription>
          {user?.email && (
            <div className="mt-2 flex flex-col gap-1">
                <p className="text-sm text-muted-foreground">
                  E-mail: <span className="font-semibold text-foreground">{user.email}</span>
                </p>
                <div className="flex flex-wrap gap-2">
                    {isGoogleUser && (
                        <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                           <svg className="w-3 h-3" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"></path><path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z"></path><path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"></path><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.021 35.596 44 30.138 44 24c0-1.341-.138-2.65-.389-3.917z"></path></svg>
                           CONTA GOOGLE
                        </span>
                    )}
                    {hasPassword && (
                        <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 uppercase">
                           <ShieldCheck size={12} />
                           Senha Cadastrada
                        </span>
                    )}
                </div>
            </div>
          )}
        </DialogHeader>
        
        <div className="px-6 space-y-4 max-h-[60vh] overflow-y-auto">
          <form id="edit-profile-form" onSubmit={handleSaveChanges} className="space-y-4">
            <div>
                <label htmlFor="name" className="text-sm font-medium text-muted-foreground">Nome Completo</label>
                <Input ref={nameInputRef} id="name" type="text" value={name} onChange={e => setName(e.target.value)} required className="mt-1 bg-input/50"/>
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
                  className="mt-1 bg-input/50"
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
                  className={`mt-1 bg-input/50 ${whatsappMismatch ? 'border-destructive' : ''}`}
                />
                {whatsappMismatch && (
                    <p className="text-xs text-destructive mt-1">Os números de WhatsApp não coincidem.</p>
                )}
              </div>
              
              <div className="pt-2 border-t border-border">
                <div className={cn(
                  "mb-3 p-3 rounded-lg border",
                  hasPassword ? "bg-muted/50 border-border" : "bg-blue-500/10 border-blue-500/20"
                )}>
                    <p className={cn(
                      "text-xs flex items-start gap-2 leading-relaxed",
                      hasPassword ? "text-muted-foreground" : "text-blue-400"
                    )}>
                        <AlertCircle size={14} className="shrink-0 mt-0.5" />
                        <span>
                          {hasPassword 
                            ? "Para sua segurança, enviaremos um link de redefinição de senha para o seu e-mail." 
                            : "Você entrou com o Google. Se desejar acessar usando e-mail e senha no futuro, crie uma senha agora clicando abaixo."}
                        </span>
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
                  {hasPassword ? "Redefinir Minha Senha" : "Criar Senha de Acesso"}
                </Button>
                {passwordResetSuccess && (
                  <div className="text-sm text-green-600 dark:text-green-400 font-semibold text-center mt-3 p-3 bg-green-500/10 rounded-lg border border-green-500/20 leading-relaxed">
                    {passwordResetSuccess.split('SPAM').map((part, index) =>
                      <React.Fragment key={index}>
                        {index > 0 && <strong className="underline decoration-2">SPAM</strong>}
                        {part}
                      </React.Fragment>
                    )}
                  </div>
                )}
              </div>
          </form>
        </div>


        <DialogFooter className="p-6 pt-4 border-t bg-background">
          <DialogClose asChild>
              <Button type="button" variant="secondary" className="bg-muted hover:bg-muted/80">Cancelar</Button>
          </DialogClose>
          <Button type="submit" form="edit-profile-form" disabled={isSaveDisabled} className="font-bold">
            {loading ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </DialogFooter>

        <div className="px-6 pb-6 bg-background">
            <div className="pt-4 border-t border-red-500/30">
              <h4 className="text-md font-bold text-destructive">Zona de Perigo</h4>
              {!showDeleteConfirm && (
                <>
                  <p className="text-xs text-muted-foreground mt-1">A exclusão da conta é permanente e apagará todos os seus dados.</p>
                  <Button
                    variant="destructive"
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={loading}
                    className="w-full mt-2 font-bold"
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
                        className="bg-background"
                        />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute bottom-2.5 right-3 text-muted-foreground">
                            {showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}
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
                        className="font-bold"
                      >
                         {loading ? <Loader className="animate-spin" size={16}/> : (isGoogleUser ? 'Confirmar via Google' : 'Confirmar Exclusão')}
                      </Button>
                  </div>
                </div>
              )}
            </div>
        </div>
        
        {error && <p className="text-destructive font-bold text-xs px-6 pb-4 text-center">{error}</p>}
      </DialogContent>
    </Dialog>
  );
}