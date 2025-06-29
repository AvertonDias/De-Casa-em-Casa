// Cole este código em src/app/recuperar-senha/page.tsx

"use client";

import { useState } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase';

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
      // A função do Firebase que faz a mágica de enviar o e-mail
      await sendPasswordResetEmail(auth, email);
      setMessage('Link de recuperação enviado! Verifique seu e-mail.');
    } catch (err: any) {
      // Se o e-mail não existir, o Firebase retorna um erro.
      // Mostramos uma mensagem genérica por segurança.
      setError('Erro ao enviar o link. Verifique se o e-mail está correto.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#1e1b29]">
      <div className="w-full max-w-md p-8 space-y-6 bg-[#2f2b3a] rounded-xl shadow-2xl">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white">Recuperar Senha</h1>
          <p className="mt-2 text-sm text-gray-400">
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
            className="w-full px-3 py-2 text-white bg-gray-800 border border-gray-700 rounded-md"
          />
          
          {message && <p className="text-sm text-center text-green-400">{message}</p>}
          {error && <p className="text-sm text-center text-red-400">{error}</p>}
          
          <button
            type="submit"
            disabled={isLoading}
            className="w-full px-4 py-2 font-semibold text-white bg-purple-600 rounded-md shadow-lg hover:bg-purple-700 disabled:bg-purple-800"
          >
            {isLoading ? 'Enviando...' : 'Enviar Link de Recuperação'}
          </button>
        </form>
        <p className="text-center text-sm text-gray-400">
          Lembrou a senha? <a href="/" className="font-medium text-purple-400 hover:text-purple-300">Faça login</a>
        </p>
      </div>
    </div>
  );
}