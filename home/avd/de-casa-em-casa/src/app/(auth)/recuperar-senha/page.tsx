
"use client";

import { useState } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { KeyRound, MailCheck } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await sendPasswordResetEmail(auth, email, {
        url: `https://appterritorios-e5bb5.web.app/auth/action`,
      });
      setIsSubmitted(true); // Muda o estado para a tela de sucesso
    } catch (err: any) {
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-email') {
        setError('Nenhuma conta encontrada com este endereço de e-mail.');
      } else {
        setError('Ocorreu um erro ao enviar o link. Tente novamente mais tarde.');
      }
      console.error("Firebase password reset error:", err);
    } finally {
      setIsLoading(false);
    }
  };
  
  if (isSubmitted) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="w-full max-w-sm p-8 space-y-6 bg-card text-card-foreground rounded-xl shadow-lg">
          <div className="text-center space-y-4">
            <MailCheck className="mx-auto h-16 w-16 text-green-500" />
            <h1 className="text-2xl font-bold">Verifique sua Caixa de Entrada</h1>
            <p className="text-muted-foreground">
              Enviamos um link de recuperação de senha para <span className="font-semibold text-foreground">{email}</span>.
            </p>
            <p className="p-3 text-sm font-semibold bg-yellow-500/20 text-yellow-300 border border-yellow-500/50 rounded-lg">
              IMPORTANTE: Se você não encontrar o e-mail, por favor, verifique sua pasta de SPAM.
            </p>
            <Button asChild className="w-full">
              <Link href="/">Voltar para o Login</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }


  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="w-full max-w-sm p-8 space-y-6 bg-card text-card-foreground rounded-xl shadow-lg">
        <div className="text-center space-y-2">
          <KeyRound className="mx-auto h-12 w-12 text-primary" />
          <h1 className="text-3xl font-bold">Recuperar Senha</h1>
          <p className="text-muted-foreground">
            Digite seu e-mail para receber um link de redefinição.
          </p>
        </div>
        <form onSubmit={handlePasswordReset} className="space-y-4">
          <div>
            <Label htmlFor="email" className="sr-only">E-mail</Label>
            <Input
              id="email"
              type="email"
              placeholder="Seu e-mail cadastrado"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          
          {error && <p className="text-sm text-center text-destructive">{error}</p>}
          
          <Button
            type="submit"
            disabled={isLoading || !email}
            className="w-full"
          >
            {isLoading ? 'Enviando...' : 'Enviar Link de Recuperação'}
          </Button>
        </form>
        <p className="text-center text-sm text-muted-foreground">
          Lembrou a senha? <Link href="/" className="font-medium text-primary hover:underline">Faça login</Link>
        </p>
      </div>
    </div>
  );
}
