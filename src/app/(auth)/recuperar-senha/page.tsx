
"use client";

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { KeyRound, MailCheck, Loader } from 'lucide-react';
import emailjs from 'emailjs-com';
import { useToast } from '@/hooks/use-toast';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const functionUrl = 'https://southamerica-east1-appterritorios-e5bb5.cloudfunctions.net/requestPasswordReset';
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Falha ao gerar o token de redefinição.');
      }
      
      const { token } = result;
      
      if (token) {
          const resetLink = `${window.location.origin}/auth/action?token=${token}`;
          
          await emailjs.send(
            'service_w3xe95d', // Seu Service ID
            'template_wzczhks', // Seu Template ID
            {
              to_email: email,
              reset_link: resetLink
            },
            'JdR2XKNICKcHc1jny' // Sua Public Key
          );
      }
      
      setIsSubmitted(true);

    } catch (err: any) {
      console.error("Erro no processo de reset:", err);
      toast({
        title: "Erro na Solicitação",
        description: err.message || 'Ocorreu um erro ao processar sua solicitação. Tente novamente mais tarde.',
        variant: "destructive",
      });
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
              Se uma conta com o e-mail <span className="font-semibold text-foreground">{email}</span> existir, um link de recuperação será enviado.
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
          
          <Button
            type="submit"
            disabled={isLoading || !email}
            className="w-full"
          >
            {isLoading ? <><Loader className="mr-2 animate-spin"/> Enviando...</> : 'Enviar Link de Recuperação'}
          </Button>
        </form>
        <p className="text-center text-sm text-muted-foreground">
          Lembrou a senha? <Link href="/" className="font-medium text-primary hover:underline">Faça login</Link>
        </p>
      </div>
    </div>
  );
}
