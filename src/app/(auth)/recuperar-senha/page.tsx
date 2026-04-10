
"use client";

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { KeyRound, MailCheck, Loader } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { app } from '@/lib/firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { sendPasswordResetEmail } from '@/lib/emailService';
import { Footer } from '@/components/Footer';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const targetEmail = email.trim().toLowerCase();

    try {
        // Usar o fluxo customizado com Token e EmailJS para maior confiabilidade na entrega
        const functions = getFunctions(app, 'southamerica-east1');
        const requestPasswordReset = httpsCallable(functions, 'requestPasswordResetV2');
        
        const result = await requestPasswordReset({ email: targetEmail });
        const { token } = result.data as { token: string | null };

        // Se o e-mail existe no sistema, o token é gerado e enviamos o e-mail
        if (token) {
            const resetLink = `${window.location.origin}/auth/action?token=${token}`;
            await sendPasswordResetEmail({ 
                email: targetEmail, 
                link: resetLink 
            });
        }
        
        // Por segurança, sempre mostramos a tela de sucesso para evitar varredura de e-mails
        setIsSubmitted(true);
    } catch (err: any) {
      console.error("Erro no processo de reset:", err);
      let message = "Ocorreu um erro ao processar sua solicitação.";
      
      if (err.code === 'functions/not-found' || err.code === 'auth/user-not-found') {
          setIsSubmitted(true);
          return;
      }
      
      toast({ title: "Erro", description: message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };
  
  if (isSubmitted) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <div className="flex-grow flex items-center justify-center p-4">
          <div className="w-full max-w-sm p-8 space-y-6 bg-card text-card-foreground rounded-xl shadow-lg text-center">
              <MailCheck className="mx-auto h-16 w-16 text-green-500" />
              <h1 className="text-2xl font-bold">Verifique seu E-mail</h1>
              <p className="text-muted-foreground">Se existir uma conta com o e-mail <b>{email}</b>, enviamos um link para você criar uma nova senha.</p>
              <div className="p-3 text-sm bg-yellow-500/10 text-yellow-600 border border-yellow-500/20 rounded-lg space-y-2">
                  <p className="font-bold underline uppercase">Importante:</p>
                  <p>Verifique sua pasta de <b>Lixo Eletrônico</b> ou <b>SPAM</b>.</p>
                  <p>Alguns provedores podem demorar alguns minutos para entregar a mensagem.</p>
              </div>
              <Button asChild className="w-full"><Link href="/">Voltar para o Login</Link></Button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <div className="flex-grow flex items-center justify-center p-4">
        <div className="w-full max-w-sm p-8 space-y-6 bg-card text-card-foreground rounded-xl shadow-lg text-center">
          <div className="flex flex-col items-center">
            <KeyRound className="h-12 w-12 text-primary mb-2" />
            <h1 className="text-3xl font-bold">Recuperar Senha</h1>
          </div>
          <p className="text-muted-foreground text-sm">Digite seu e-mail cadastrado para receber um link de redefinição seguro.</p>
          <form onSubmit={handlePasswordReset} className="space-y-4 text-left">
            <div>
              <Label htmlFor="email" className="sr-only">E-mail</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="Seu e-mail cadastrado" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                required 
                autoComplete="email"
              />
            </div>
            <Button type="submit" disabled={isLoading || !email} className="w-full">
              {isLoading ? <><Loader className="mr-2 animate-spin" size={16}/> Enviando...</> : 'Enviar E-mail de Recuperação'}
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground pt-2">
            Lembrou a senha? <Link href="/" className="font-medium text-primary hover:underline">Faça login</Link>
          </p>
        </div>
      </div>
      <Footer />
    </div>
  );
}
