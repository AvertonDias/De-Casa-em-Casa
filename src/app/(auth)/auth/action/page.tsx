// src/app/auth/action/page.tsx
"use client";

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { verifyPasswordResetCode, confirmPasswordReset } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader, KeyRound, CheckCircle, AlertTriangle } from 'lucide-react';

function PasswordResetAction() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [stage, setStage] = useState<'verifying' | 'form' | 'success' | 'error'>('verifying');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [oobCode, setOobCode] = useState<string | null>(null);

  useEffect(() => {
    if (!searchParams) {
      setError('Parâmetros de redefinição não encontrados.');
      setStage('error');
      return;
    }

    const mode = searchParams.get('mode');
    const code = searchParams.get('oobCode');

    if (!code || mode !== 'resetPassword') {
      setError('Link inválido ou ausente. Por favor, solicite um novo link de recuperação.');
      setStage('error');
      return;
    }

    setOobCode(code); // Armazena o código para uso posterior

    verifyPasswordResetCode(auth, code)
      .then((verifiedEmail) => {
        setEmail(verifiedEmail);
        setStage('form');
      })
      .catch((err) => {
        console.error("Erro ao verificar código:", err);
        setError('O link de redefinição é inválido ou já expirou. Por favor, tente novamente.');
        setStage('error');
      });
  }, [searchParams]);

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
    if (!oobCode) {
      setError('Código de verificação não encontrado. O link pode estar corrompido.');
      return;
    }

    setError('');
    setStage('verifying');

    try {
      await confirmPasswordReset(auth, oobCode, newPassword);
      setStage('success');
    } catch (err) {
      console.error("Erro ao redefinir senha:", err);
      setError('Ocorreu um erro ao redefinir sua senha. O link pode ter expirado. Por favor, tente novamente.');
      setStage('error');
    }
  };

  const renderContent = () => {
    switch (stage) {
      case 'verifying':
        return (
          <div className="text-center">
            <Loader className="mx-auto h-12 w-12 text-primary animate-spin" />
            <p className="mt-4 text-muted-foreground">Verificando link...</p>
          </div>
        );

      case 'form':
        return (
          <>
            <div className="text-center space-y-2">
              <KeyRound className="mx-auto h-12 w-12 text-primary" />
              <h1 className="text-3xl font-bold">Definir Nova Senha</h1>
              <p className="text-muted-foreground">
                Crie uma nova senha para sua conta: <span className="font-semibold text-foreground">{email}</span>
              </p>
            </div>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <Label htmlFor="new-password">Nova Senha</Label>
                <Input id="new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
                <Input id="confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
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
