"use client";

import React, { useState, useEffect } from 'react';
import { useUser } from '@/contexts/UserContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { LgpdModal } from './LgpdModals';
import { ShieldCheck, AlertTriangle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function ForceLgpdConsentModal() {
  const { user, updateUser } = useUser();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [modalType, setModalType] = useState<'terms' | 'privacy'>('terms');
  const [isLgpdDetailOpen, setIsLgpdDetailOpen] = useState(false);
  
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);

  // Exibir se o usuário estiver logado, ativo e não tiver aceito os termos da LGPD
  useEffect(() => {
    if (user && user.status === 'ativo' && user.acceptedLGPD !== true) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [user]);

  const handleOpenChange = React.useCallback(() => {}, []);

  if (!isOpen) return null;

  const handleOpenLgpdDetail = (type: 'terms' | 'privacy') => {
    setModalType(type);
    setIsLgpdDetailOpen(true);
  };

  const handleAcceptConsent = async () => {
    if (!checked) return;
    setLoading(true);

    try {
      await updateUser({
        acceptedLGPD: true,
        acceptedLGPDAt: new Date() as any // Firebase aceita Date nativo
      });

      toast({
        title: "Termos Aceitos!",
        description: "Obrigado por ler e aceitar nossos termos da LGPD.",
      });
      setIsOpen(false);
    } catch (error) {
      console.error("Erro ao salvar consentimento LGPD:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar o seu consentimento. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent 
          className="max-w-md w-[95vw] p-6 rounded-xl border border-border/80 shadow-2xl bg-card"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader className="space-y-3 flex flex-col items-center text-center">
            <div className="p-3 bg-primary/10 rounded-full text-primary animate-pulse">
              <ShieldCheck className="h-10 w-10" />
            </div>
            <DialogTitle className="text-xl font-bold tracking-tight">Atualização de Privacidade e Termos (LGPD)</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
              Em conformidade com a <b>Lei Geral de Proteção de Dados (LGPD)</b>, atualizamos nossas políticas de segurança e privacidade. Para continuar utilizando as ferramentas do app, você precisa aceitar os novos termos.
            </DialogDescription>
          </DialogHeader>

          <div className="my-4 space-y-4 bg-muted/40 p-4 rounded-lg border border-border/60 text-sm">
            <p className="text-xs text-muted-foreground leading-relaxed text-center">
              Coletamos e tratamos seu nome, WhatsApp e e-mail de forma estritamente segura apenas para controle interno de territórios de sua própria congregação, sem qualquer compartilhamento de dados com terceiros.
            </p>
            
            <div className="flex flex-col gap-2 justify-center text-center font-bold text-sm">
              <button 
                type="button" 
                onClick={() => handleOpenLgpdDetail('terms')} 
                className="text-primary hover:underline"
              >
                Visualizar Termos de Uso
              </button>
              <button 
                type="button" 
                onClick={() => handleOpenLgpdDetail('privacy')} 
                className="text-primary hover:underline"
              >
                Visualizar Política de Privacidade
              </button>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-yellow-500/10 border border-yellow-500/20 text-yellow-600 dark:text-yellow-400 rounded-lg text-xs leading-relaxed">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>
              Ao marcar a caixa de consentimento, você concorda livremente com o tratamento de seus dados cadastrais para fins organizacionais. Você pode revogar este consentimento ou excluir sua conta de forma permanente a qualquer momento no seu perfil.
            </p>
          </div>

          <div className="flex items-center gap-3 mt-4 select-none">
            <input 
              id="force-lgpd-checkbox" 
              type="checkbox" 
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="h-5 w-5 rounded border-border text-primary focus:ring-primary/50 shrink-0 cursor-pointer accent-primary"
            />
            <label htmlFor="force-lgpd-checkbox" className="text-sm font-semibold cursor-pointer text-foreground leading-tight">
              Li e concordo com os Termos de Uso e com a Política de Privacidade descritos.
            </label>
          </div>

          <DialogFooter className="mt-6">
            <Button 
              type="button" 
              onClick={handleAcceptConsent}
              disabled={!checked || loading}
              className="w-full font-bold h-11"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin mr-2" size={18} />
                  Salvando Consentimento...
                </>
              ) : (
                "Confirmar Consentimento e Acessar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <LgpdModal 
        isOpen={isLgpdDetailOpen} 
        onOpenChange={setIsLgpdDetailOpen} 
        type={modalType} 
      />
    </>
  );
}
