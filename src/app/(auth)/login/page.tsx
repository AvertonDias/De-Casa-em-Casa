"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import Link from 'next/link';
import { Eye, EyeOff, Info } from 'lucide-react';
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
      // The UserContext will handle the redirect now.
      // No router.push() needed here.
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
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="w-full max-w-sm p-8 space-y-6 bg-card text-card-foreground rounded-xl shadow-lg">
        <div className="flex flex-col items-center justify-center">
            <Image
                src="/icon-192x192.jpg"
                alt="Logo De Casa em Casa"
                width={80}
                height={80}
                className="rounded-lg mb-4"
                priority
            />
            <h1 className="text-3xl font-bold text-center">
                De Casa em Casa
            </h1>
        </div>
        <p className="text-center text-muted-foreground">Acesse o painel com suas credenciais.</p>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Seu e-mail"
              required
              className="w-full px-4 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Sua senha"
              required
              className="w-full px-4 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring pr-10"
            />
             <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 px-3 flex items-center text-muted-foreground">
                {showPassword ? <EyeOff size={20}/> : <Eye size={20}/>}
              </button>
          </div>
          {error && <p className="text-destructive text-sm text-center">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 font-semibold text-primary-foreground bg-primary rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background focus:ring-primary disabled:opacity-50"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
        <div className="text-center text-muted-foreground text-sm space-y-3">
            <Link href="/recuperar-senha" className="block hover:text-primary">Esqueceu a senha?</Link>

            <div className="p-4 bg-secondary border border-border rounded-lg">
                <p>
                É novo por aqui?{' '}
                <Link href="/cadastro" className="font-bold text-primary hover:underline">
                    Solicite seu acesso aqui
                </Link>
                </p>
            </div>

            <div className="p-4 bg-secondary border border-border rounded-lg">
                <p>
                É o primeiro na sua congregação?{' '}
                <Link href="/nova-congregacao" className="font-bold text-primary hover:underline">Comece aqui</Link>
                </p>
            </div>

            <div className="pt-4">
                <Link href="/sobre" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
                    <Info size={16} />
                    Conheça o Sistema
                </Link>
            </div>
        </div>
      </div>
    </div>
  );
}
