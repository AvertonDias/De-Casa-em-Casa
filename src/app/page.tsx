
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { auth, GoogleAuthProvider } from '@/lib/firebase';
import Link from 'next/link';
import { Eye, EyeOff, Info, AlertTriangle, Loader } from 'lucide-react';
import Image from 'next/image';
import { useUser } from '@/contexts/UserContext';
import { Footer } from '@/components/Footer';

export default function UniversalLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { user, loading: userLoading } = useUser();
  const router = useRouter();

  // Redireciona se já estiver logado
  useEffect(() => {
    if (!userLoading && user?.congregationId) {
      const dest = user.role === 'Administrador' ? '/dashboard' : '/dashboard/territorios';
      router.replace(dest);
    }
  }, [user, userLoading, router]);

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    // Força limpeza do e-mail no momento da digitação
    setEmail(e.target.value.toLowerCase().trim());
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const targetEmail = email.trim().toLowerCase();

    try {
      await signInWithEmailAndPassword(auth, targetEmail, password);
    } catch (err: any) {
      console.error("Erro de login:", err);
      
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError("E-mail ou senha incorretos. DICA: Se você se cadastrou pelo Google, entre usando o botão abaixo ou crie uma senha em 'Esqueceu a senha'.");
      } else if (err.code === 'auth/too-many-requests') {
        setError("Muitas tentativas falhas. Aguarde alguns minutos ou redefina sua senha.");
      } else {
        setError("Não foi possível entrar. Verifique sua conexão e tente novamente.");
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
        provider.setCustomParameters({ prompt: 'select_account' });
        await signInWithPopup(auth, provider);
    } catch (error: any) {
      if (error.code === 'auth/account-exists-with-different-credential') {
        setError("Este e-mail já possui uma conta com senha. Entre com seu e-mail e senha.");
      } else if (error.code !== 'auth/popup-closed-by-user') {
        setError("Falha ao entrar com o Google.");
      }
    } finally {
        setGoogleLoading(false);
    }
  };

  if (userLoading) return null;

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <div className="flex-grow flex items-center justify-center p-4">
        <div className="w-full max-w-sm p-8 space-y-6 bg-card text-card-foreground rounded-xl shadow-lg border border-border/50">
          <div className="flex flex-col items-center justify-center">
              <Image src="/images/Logo_v3.png" alt="Logo" width={80} height={80} className="rounded-lg mb-4" priority />
              <h1 className="text-3xl font-bold text-center tracking-tight">Casa em Casa</h1>
          </div>
          
          {error && (
              <div className="p-4 bg-destructive/10 text-destructive-foreground border border-destructive/20 rounded-lg flex items-start gap-3">
                  <AlertTriangle size={20} className="text-destructive mt-0.5 shrink-0" />
                  <p className="text-sm font-medium leading-relaxed">{error}</p>
              </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-3">
              <input
                type="email"
                value={email}
                onChange={handleEmailChange}
                placeholder="Seu e-mail"
                required
                className="w-full px-4 py-2.5 bg-background border border-input rounded-md focus:ring-2 focus:ring-primary outline-none"
              />
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Sua senha"
                  required
                  className="w-full px-4 py-2.5 bg-background border border-input rounded-md focus:ring-2 focus:ring-primary outline-none pr-10"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 px-3 flex items-center text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff size={20}/> : <Eye size={20}/>}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading || googleLoading}
              className="w-full px-4 py-2.5 font-bold text-primary-foreground bg-primary rounded-md hover:bg-primary/90 disabled:opacity-50 transition-all shadow-md"
            >
              {loading ? <><Loader className="animate-spin inline mr-2" size={18}/> Entrando...</> : 'Entrar com E-mail'}
            </button>
          </form>

          <div className="relative">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">Ou continue com</span></div>
          </div>

          <button onClick={handleGoogleLogin} disabled={loading || googleLoading} className="w-full flex items-center justify-center gap-3 px-4 py-2.5 font-semibold text-foreground bg-background border border-input rounded-md hover:bg-accent transition-colors disabled:opacity-50">
              {googleLoading ? <Loader className="animate-spin" size={20}/> : (
                  <><svg className="w-5 h-5" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"></path><path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z"></path><path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"></path><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.021 35.596 44 30.138 44 24c0-1.341-.138-2.65-.389-3.917z"></path></svg> Google</>
              )}
          </button>
          
          <div className="text-center text-sm space-y-4 pt-2">
              <Link href="/recuperar-senha" className="block text-primary font-semibold hover:underline">Esqueceu a senha?</Link>

              <div className="p-4 bg-secondary/50 border border-border rounded-lg space-y-3">
                  <div className="space-y-2">
                      <p className="text-muted-foreground">Não tem acesso?</p>
                      <Link href="/cadastro" className="block w-full text-center px-4 py-2 font-bold text-primary border border-primary rounded-md hover:bg-primary/10 transition-all">
                          Criar cadastro
                      </Link>
                  </div>
                  <div className="pt-2 border-t border-border/50 space-y-2">
                      <Link href="/nova-congregacao" className="block w-full text-center px-4 py-2 text-sm font-bold text-foreground bg-muted border border-border rounded-md hover:bg-muted/80 transition-all">
                          Criar Congregação
                      </Link>
                  </div>
              </div>

              <div className="pt-2">
                  <Link href="https://aplicativos-ton.vercel.app/de-casa-em-casa" target="_blank" className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors">
                      <Info size={14} /> Sobre o Sistema
                  </Link>
              </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
