
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useUser } from '@/contexts/UserContext';
import { reauthenticateWithCredential, EmailAuthProvider, updateProfile } from 'firebase/auth';
import { auth, functions } from '@/lib/firebase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Eye, EyeOff, Trash2, KeyRound, Loader } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { maskPhone } from '@/lib/utils';
import { sendEmail } from '@/lib/emailService';
import { httpsCallable } from 'firebase/functions';
import { useAndroidBack } from '@/hooks/useAndroidBack';
import { getIdToken } from 'firebase/auth';

const requestPasswordReset = httpsCallable(functions, 'requestPasswordResetV2');

// Função para buscar o conteúdo do template
async function getEmailTemplate() {
    try {
        const response = await fetch('/email-template.html');
        if (!response.ok) {
            throw new Error('Não foi possível carregar o template de e-mail.');
        }
        return await response.text();
    } catch (error) {
        console.error(error);
        // Retorna um HTML básico em caso de falha
        return '<p>{{ message }}</p><a href="{{action_link}}">Clique aqui</a>';
    }
}

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
    if (!user || !user.email) {
      toast({ title: "Erro", description: "E-mail do usuário não encontrado.", variant: "destructive" });
      return;
    }
    setPasswordResetLoading(true);
    setError(null);
    setPasswordResetSuccess(null);

    try {
        const response = await fetch(
            'https://southamerica-east1-appterritorios-e5bb5.cloudfunctions.net/requestPasswordResetV2',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: user.email }),
            }
        );

        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || `Ocorreu um erro: ${response.statusText}`);
        }
        
        if (result.token) {
            const resetLink = `${window.location.origin}/auth/action?token=${result.token}`;
            const emailTemplate = await getEmailTemplate();
            
            const messageBody = `Você solicitou a redefinição de sua senha. Use o botão abaixo para criar uma nova.`;
            const emailSubject = "Redefinição de Senha - De Casa em Casa";

            const finalHtml = emailTemplate
                .replace('{{ subject }}', emailSubject)
                .replace('{{ to_name }}', user.name)
                .replace('{{ message }}', messageBody)
                .replace(/{{action_link}}/g, resetLink)
                .replace('{{ action_button_text }}', 'Criar Nova Senha')
                .replace('{{ to_email }}', user.email);

            // Ajusta os parâmetros para o template genérico
            const templateParams = {
                to_email: user.email,
                subject: emailSubject,
                html_content: finalHtml,
            };
            
            await sendEmail(templateParams);
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

  const confirmSelfDelete = async () => {
    if (!user || !auth.currentUser?.email || !passwordForDelete) {
      setError("Senha é necessária para exclusão.");
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
        const credential = EmailAuthProvider.credential(auth.currentUser.email, passwordForDelete);
        await reauthenticateWithCredential(auth.currentUser, credential);
        
        const idToken = await getIdToken(auth.currentUser);
        const response = await fetch(
            'https://southamerica-east1-appterritorios-e5bb5.cloudfunctions.net/deleteUserAccountV2',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`,
                },
                body: JSON.stringify({ userIdToDelete: user.uid }),
            }
        );

        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.error || `Ocorreu um erro: ${response.statusText}`);
        }
        
        toast({
          title: "Conta Excluída",
          description: "Sua conta foi removida com sucesso. Você será desconectado.",
        });
        
        await logout();
        onOpenChange(false);

    } catch (error: any) {
         console.error("Erro na autoexclusão:", error);
         if (error.code?.includes('auth/invalid-credential') || error.code?.includes('auth/wrong-password')) {
             setError("Senha incorreta. A exclusão foi cancelada.");
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
                  <p className="text-sm font-semibold">Para confirmar a exclusão, digite sua senha atual.</p>
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
                  <div className="flex gap-2 justify-end">
                      <Button variant="secondary" size="sm" onClick={() => setShowDeleteConfirm(false)}>Cancelar</Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={confirmSelfDelete}
                        disabled={loading || passwordForDelete.length < 6}
                      >
                         {loading ? <Loader className="animate-spin" /> : 'Confirmar Exclusão'}
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
