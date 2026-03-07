
"use client";

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { KeyRound, MailCheck, Loader } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Footer } from '@/components/Footer';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
        await sendPasswordResetEmail(auth, email.trim());
        setIsSubmitted(true);
    } catch (err: any) {
      console.error("Erro no processo de reset:", err);
      let message = "Ocorreu um erro ao processar sua solicitação.";
      if (err.code === 'auth/user-not-found') {
          // Por segurança, fingimos que deu certo para não vazar e-mails
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
              <p className="p-3 text-sm bg-yellow-500/10 text-yellow-600 border border-yellow-500/20 rounded-lg">IMPORTANTE: Verifique sua pasta de SPAM.</p>
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
          <KeyRound className="mx-auto h-12 w-12 text-primary" />
          <h1 className="text-3xl font-bold">Recuperar Senha</h1>
          <p className="text-muted-foreground">Digite seu e-mail para receber um link de redefinição oficial do sistema.</p>
          <form onSubmit={handlePasswordReset} className="space-y-4 text-left">
            <div><Label htmlFor="email" className="sr-only">E-mail</Label><Input id="email" type="email" placeholder="Seu e-mail cadastrado" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
            <Button type="submit" disabled={isLoading || !email} className="w-full">
              {isLoading ? <><Loader className="mr-2 animate-spin"/> Enviando...</> : 'Enviar E-mail de Recuperação'}
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground">Lembrou a senha? <Link href="/" className="font-medium text-primary hover:underline">Faça login</Link></p>
        </div>
      </div>
      <Footer />
    </div>
  );
}
