"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
import Image from 'next/image';

export default function UniversalLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push('/dashboard'); 
    } catch (err: any) {
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError("E-mail ou senha inválidos.");
      } else {
        setError("Ocorreu um erro. Verifique sua conexão.");
        console.error("Erro de login:", err);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#1e1b29]">
      <div className="w-full max-w-sm p-8 space-y-6 bg-[#2f2b3a] rounded-xl shadow-lg">
        <div className="flex flex-col items-center justify-center">
            <Image
                src="/icon-192x192.png"
                alt="Logo De Casa em Casa"
                width={80}
                height={80}
                className="rounded-lg mb-4"
            />
            <h1 className="text-3xl font-bold text-center text-white">
                De Casa em Casa
            </h1>
        </div>
        <p className="text-center text-gray-400">Acesse o painel com suas credenciais.</p>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Seu e-mail"
              required
              className="w-full px-4 py-2 text-white bg-[#1e1b29] border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Sua senha"
              required
              className="w-full px-4 py-2 text-white bg-[#1e1b29] border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 pr-10"
            />
             <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400">
                {showPassword ? <EyeOff size={20}/> : <Eye size={20}/>}
              </button>
          </div>
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 font-semibold text-white bg-purple-600 rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#2f2b3a] focus:ring-purple-500 disabled:bg-gray-500"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
        <div className="text-center text-gray-400 text-sm space-y-3">
          <Link href="/recuperar-senha" className="block hover:text-purple-400">Esqueceu a senha?</Link>

          <div className="p-4 bg-purple-900/30 border border-purple-500/50 rounded-lg">
            <p>
              É novo por aqui?{' '}
              <Link href="/cadastro" className="font-bold text-purple-300 hover:text-purple-200 underline">
                Solicite seu acesso aqui
              </Link>
            </p>
          </div>

          <div className="p-4 bg-purple-900/30 border border-purple-500/50 rounded-lg">
            <p>
              É o primeiro na sua congregação?{' '}
              <Link href="/nova-congregacao" className="font-bold text-purple-300 hover:text-purple-200 underline">Comece aqui</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
