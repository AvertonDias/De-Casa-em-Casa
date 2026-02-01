"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { auth, GoogleAuthProvider } from '@/lib/firebase';
import Link from 'next/link';
import { Eye, EyeOff, Info, AlertTriangle } from 'lucide-react';
import Image from 'next/image';
import { useUser } from '@/contexts/UserContext';
import { useModal } from '@/contexts/ModalContext';


export default function UniversalLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { user, loading: userLoading } = useUser();
  const router = useRouter();
  const { hasOpenModal } = useModal();

  // Se o usuário já está logado e carregado, o UserContext cuidará do redirecionamento.
  if (user && !userLoading) {
      return null;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      // O UserContext irá lidar com o redirecionamento após o login bem-sucedido.
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
  
  const handleGoogleLogin = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({
          prompt: 'select_account'
        });
        await signInWithPopup(auth, provider);
        // O UserContext cuidará do redirecionamento
    } catch (error: any) {
      if (error.code !== 'auth/popup-closed-by-user') {
        console.error("Erro no login com Google:", error);
        setError("Não foi possível fazer login com o Google.");
      }
    } finally {
        setGoogleLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="w-full max-w-sm p-8 space-y-6 bg-card text-card-foreground rounded-xl shadow-lg">
        <div className="flex flex-col items-center justify-center">
            <Image
                src="/images/Logo_v3.png"
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
        
        {error && (
            <div className="p-4 bg-destructive/10 text-destructive-foreground border border-destructive/20 rounded-lg flex items-start gap-3">
                <AlertTriangle size={20} className="text-destructive mt-0.5" />
                <p className="text-sm font-medium">{error}</p>
            </div>
        )}

        <p className="text-center text-muted-foreground">Acesse o painel com suas credenciais.</p>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Seu e-mail"
              required
              autoComplete="email"
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
              autoComplete="current-password"
              className="w-full px-4 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring pr-10"
            />
             <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 px-3 flex items-center text-muted-foreground">
                {showPassword ? <EyeOff size={20}/> : <Eye size={20}/>}
              </button>
          </div>
          <button
            type="submit"
            disabled={loading || googleLoading}
            className="w-full px-4 py-2 font-semibold text-primary-foreground bg-primary rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background focus:ring-primary disabled:opacity-50"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
        
        <div className="relative">
            <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">OU</span>
            </div>
        </div>

        <button
            onClick={handleGoogleLogin}
            disabled={loading || googleLoading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 font-semibold text-foreground bg-background border border-input rounded-md hover:bg-accent disabled:opacity-50"
        >
            {googleLoading ? 'Aguarde...' : (
                <>
                <svg className="w-5 h-5" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"></path><path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z"></path><path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"></path><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.021 35.596 44 30.138 44 24c0-1.341-.138-2.65-.389-3.917z"></path></svg>
                Entrar com Google
                </>
            )}
        </button>
        
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
