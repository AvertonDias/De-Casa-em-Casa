
// src/app/auth/action/page.tsx
"use client";

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '@/lib/firebase';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader, KeyRound, CheckCircle, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const functions = getFunctions(app, 'southamerica-east1');
const resetPasswordWithTokenFn = httpsCallable(functions, 'resetPasswordWithToken');


function PasswordResetAction() {
  const searchParams = useSearchParams();
  const { toast } = useToast();
  
  // Stages: 'verifying', 'form', 'success', 'error'
  const [stage, setStage] = useState<'verifying' | 'form' | 'success' | 'error'>('verifying');
  const [error, setError] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const token = searchParams?.get('token') ?? null;

  useEffect(() => {
    if (!token) {
      setError('Token de redefinição inválido ou ausente. Por favor, solicite um novo link.');
      setStage('error');
    } else {
      setStage('form');
    }
  }, [token]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }
    if (newPassword.length < 6) {
        setError('A senha deve ter no mínimo 6 caracteres.');
        return;
    }
    if (!token) {
        setError('Token não encontrado.');
        return;
    }

    setError('');
    setStage('verifying');

    try {
      const result: any = await resetPasswordWithTokenFn({ token, newPassword });

      if (!result.data.success) {
        throw new Error(result.data.message || `Ocorreu um erro desconhecido.`);
      }

      setStage('success');
      
    } catch (err: any) {
      console.error("Erro ao redefinir senha com token:", err);
      
      let errorMessage = 'Ocorreu um erro inesperado. Tente novamente.';
      if (err.message) {
        if (err.message.includes('invalid-argument')) {
          errorMessage = 'Token ou senha inválidos.';
        } else if (err.message.includes('not-found')) {
          errorMessage = 'O link de redefinição é inválido ou já foi utilizado.';
        } else if (err.message.includes('deadline-exceeded')) {
          errorMessage = 'O link de redefinição expirou. Por favor, solicite um novo.';
        }
      }

      toast({
        title: "Erro ao redefinir senha",
        description: errorMessage,
        variant: "destructive",
      });
      setError(errorMessage);
      setStage('error');
    }
  };

  const renderContent = () => {
    switch (stage) {
      case 'verifying':
        return (
          <div className="text-center">
            <Loader className="mx-auto h-12 w-12 text-primary animate-spin" />
            <p className="mt-4 text-muted-foreground">Processando...</p>
          </div>
        );

      case 'form':
        return (
          <>
            <div className="text-center space-y-2">
              <KeyRound className="mx-auto h-12 w-12 text-primary" />
              <h1 className="text-3xl font-bold">Definir Nova Senha</h1>
              <p className="text-muted-foreground">
                Crie uma nova senha para sua conta.
              </p>
            </div>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="relative">
                <Label htmlFor="new-password">Nova Senha</Label>
                <Input id="new-password" type={showNewPassword ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
                 <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute bottom-2 right-3 text-muted-foreground">
                    {showNewPassword ? <EyeOff size={20}/> : <Eye size={20}/>}
                </button>
              </div>
              <div className="relative">
                <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
                <Input id="confirm-password" type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
                <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute bottom-2 right-3 text-muted-foreground">
                    {showConfirmPassword ? <EyeOff size={20}/> : <Eye size={20}/>}
                </button>
              </div>
              {error && <p className="text-sm text-center text-destructive">{error}</p>}
              <Button type="submit" className="w-full">Salvar Nova Senha</Button>
            </form>
          </>
        );

      case 'success':
        return (
          <div className="text-center space-y-4">
            <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
            <h1 className="text-2xl font-bold">Senha Redefinida!</h1>
            <p className="text-muted-foreground">Sua senha foi alterada com sucesso. Você já pode fazer login com sua nova senha.</p>
            <Button asChild className="w-full">
              <Link href="/">Ir para o Login</Link>
            </Button>
          </div>
        );

      case 'error':
        return (
          <div className="text-center space-y-4">
            <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
            <h1 className="text-2xl font-bold">Link Inválido</h1>
            <p className="text-muted-foreground">{error}</p>
            <Button asChild className="w-full" variant="secondary">
              <Link href="/recuperar-senha">Solicitar Novo Link</Link>
            </Button>
          </div>
        );
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="w-full max-w-sm p-8 space-y-6 bg-card text-card-foreground rounded-xl shadow-lg">
        {renderContent()}
      </div>
    </div>
  );
}


export default function PasswordResetActionPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="w-full max-w-sm p-8 space-y-6 bg-card text-card-foreground rounded-xl shadow-lg text-center">
            <Loader className="mx-auto h-12 w-12 text-primary animate-spin" />
            <p className="mt-4 text-muted-foreground">Carregando...</p>
        </div>
      </div>
    }>
      <PasswordResetAction />
    </Suspense>
  );
}
