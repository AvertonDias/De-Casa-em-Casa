"use client";

import { useState } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setError('');
    setIsLoading(true);

    try {
      await sendPasswordResetEmail(auth, email);
      setMessage('Link de recuperação enviado! Verifique seu e-mail.');
    } catch (err: any) {
      setError('Erro ao enviar o link. Verifique se o e-mail está correto.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="w-full max-w-md p-8 space-y-6 bg-card text-card-foreground rounded-xl shadow-2xl">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Recuperar Senha</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Digite seu e-mail para receber um link de redefinição.
          </p>
        </div>
        <form onSubmit={handlePasswordReset} className="space-y-4">
          <input
            type="email"
            placeholder="Seu e-mail cadastrado"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-3 py-2 bg-background border border-input rounded-md"
          />
          
          {message && <p className="text-sm text-center text-green-500">{message}</p>}
          {error && <p className="text-sm text-center text-destructive">{error}</p>}
          
          <button
            type="submit"
            disabled={isLoading}
            className="w-full px-4 py-2 font-semibold text-primary-foreground bg-primary rounded-md shadow-lg hover:bg-primary/90 disabled:opacity-50"
          >
            {isLoading ? 'Enviando...' : 'Enviar Link de Recuperação'}
          </button>
        </form>
        <p className="text-center text-sm text-muted-foreground">
          Lembrou a senha? <Link href="/" className="font-medium text-primary hover:underline">Faça login</Link>
        </p>
      </div>
    </div>
  );
}
