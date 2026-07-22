
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, sendPasswordResetEmail, signOut } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import Link from 'next/link';
import { Eye, EyeOff, AlertTriangle, Loader, RefreshCcw } from 'lucide-react';
import Image from 'next/image';
import { useUser } from '@/contexts/UserContext';
import { Footer } from '@/components/Footer';
import { TutorialButton } from '@/components/TutorialButton';
import { TUTORIAL_IDS } from '@/lib/tutorials';
import { Button } from '@/components/ui/button';

export default function UniversalLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unauthorizedDomain, setUnauthorizedDomain] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { user, loading: userLoading, forceStopLoading } = useUser();
  const router = useRouter();

  // Monitor de timeout para o carregamento do usuário
  const [showRetry, setShowRetry] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (userLoading || googleLoading) {
        timer = setTimeout(() => {
            setShowRetry(true);
        }, 10000); // 10 segundos
    } else {
        setShowRetry(false);
    }
    return () => clearTimeout(timer);
  }, [userLoading, googleLoading]);

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setUnauthorizedDomain(null);
    setEmail(e.target.value.toLowerCase().trim().replace(/\s/g, ''));
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setUnauthorizedDomain(null);
    
    const targetEmail = email.trim().toLowerCase();
    if (!targetEmail || !password) return;
    
    setLoading(true);

    try {
      // 1. Verificar se a conta está bloqueada por excesso de tentativas (Firestore + localStorage)
      const attemptRef = doc(db, 'loginAttempts', targetEmail);
      let firestoreAttempts = 0;
      try {
        const attemptSnap = await getDoc(attemptRef);
        if (attemptSnap.exists()) {
          firestoreAttempts = attemptSnap.data().attempts || 0;
        }
      } catch (dbErr) {
        console.warn("Não foi possível verificar tentativas via Firestore (usando fallback local):", dbErr);
      }

      const localAttempts = typeof window !== 'undefined' ? Number(localStorage.getItem(`login_attempts_${targetEmail}`) || 0) : 0;
      const effectiveAttempts = Math.max(firestoreAttempts, localAttempts);

      if (effectiveAttempts >= 5) {
        setError(
          "Conta bloqueada devido a 5 tentativas de login incorretas consecutivas. Um e-mail de liberação e redefinição de senha foi enviado. Por favor, acesse seu e-mail para desbloquear."
        );
        
        try {
          await sendPasswordResetEmail(auth, targetEmail);
        } catch (emailErr) {
          console.warn("Falha ao retransmitir e-mail de recuperação:", emailErr);
        }
        
        setLoading(false);
        return;
      }

      // 2. Realizar login com Firebase Auth
      await signInWithEmailAndPassword(auth, targetEmail, password);
      
      // 3. Se obteve sucesso, apagar o documento de tentativas (Firestore e localStorage)
      if (typeof window !== 'undefined') {
        localStorage.removeItem(`login_attempts_${targetEmail}`);
      }
      try {
        await deleteDoc(attemptRef);
      } catch (delErr) {
        console.warn("Não foi possível excluir o histórico de tentativas de login no Firestore:", delErr);
      }

    } catch (err: any) {
      console.warn("Tentativa de login malsucedida:", err.code || err);
      setLoading(false);

      if (err.code === 'auth/user-not-found') {
        setError("E-mail não cadastrado. Por favor, solicite seu acesso.");
        return;
      }
      
      const isPasswordError = err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password';
      
      if (isPasswordError) {
        let currentAttempts = typeof window !== 'undefined' ? Number(localStorage.getItem(`login_attempts_${targetEmail}`) || 0) : 0;
        
        try {
          const attemptRef = doc(db, 'loginAttempts', targetEmail);
          const attemptSnap = await getDoc(attemptRef);
          if (attemptSnap.exists()) {
            currentAttempts = Math.max(currentAttempts, attemptSnap.data().attempts || 0);
          }
        } catch (dbErr) {
          console.warn("Consulta Firestore indisponível para contagem de tentativas:", dbErr);
        }

        const newAttempts = currentAttempts + 1;

        if (typeof window !== 'undefined') {
          localStorage.setItem(`login_attempts_${targetEmail}`, String(newAttempts));
        }

        try {
          const attemptRef = doc(db, 'loginAttempts', targetEmail);
          await setDoc(attemptRef, {
            email: targetEmail,
            attempts: newAttempts,
            lastAttempt: new Date()
          }, { merge: true });
        } catch (dbErr) {
          console.warn("Não foi possível salvar contagem de tentativas no Firestore:", dbErr);
        }
        
        if (newAttempts >= 5) {
          setError(
            "Sua conta foi bloqueada devido a 5 tentativas com senha incorreta. Um e-mail de redefinição de senha foi enviado para você liberar seu acesso."
          );
          
          try {
            await sendPasswordResetEmail(auth, targetEmail);
          } catch (emailErr) {
            console.warn("Falha ao enviar e-mail de recuperação automático no bloqueio:", emailErr);
          }
        } else {
          const remaining = 5 - newAttempts;
          setError(
            `E-mail não cadastrado ou senha incorreta. Você possui mais ${remaining} ${remaining === 1 ? 'tentativa' : 'tentativas'} antes de o acesso ser bloqueado por segurança.`
          );
        }
      } else if (err.code === 'auth/too-many-requests') {
        setError("Muitas tentativas falhas. Aguarde alguns minutos ou redefina sua senha.");
      } else if (err.code === 'auth/invalid-email') {
        setError("O e-mail digitado é inválido.");
      } else if (err.code === 'auth/user-disabled') {
        setError("Esta conta foi desativada. Entre em contato com o suporte.");
      } else {
        setError("E-mail não cadastrado ou dados incorretos. Verifique e tente novamente.");
      }
    }
  };
  
  const handleGoogleLogin = async () => {
    setError(null);
    setUnauthorizedDomain(null);
    setGoogleLoading(true);
    try {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        
        const userCredential = await signInWithPopup(auth, provider);
        const firebaseUser = userCredential.user;

        // Verificar se a conta do Google possui perfil cadastrado no Firestore
        let userExists = false;
        try {
          const userSnap = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userSnap.exists()) {
            userExists = true;
          }
        } catch (dbErr) {
          console.warn("Erro ao buscar usuário no Firestore durante Google Login:", dbErr);
        }

        if (!userExists) {
          // Desconectar imediatamente do Auth para não manter sessão aberta
          await signOut(auth).catch(() => {});
          setError("E-mail não cadastrado. Por favor, solicite seu acesso primeiro.");
          setGoogleLoading(false);
          return;
        }

    } catch (error: any) {
      console.warn("Retorno de Google Login:", error.code || error);
      setGoogleLoading(false);
      if (error.code === 'auth/account-exists-with-different-credential') {
        setError("Este e-mail já possui uma conta com senha. Tente digitar sua senha acima.");
      } else if (error.code === 'auth/popup-blocked') {
        setError("O pop-up de login foi bloqueado pelo seu navegador. Por favor, libere pop-ups para este site.");
      } else if (error.code === 'auth/unauthorized-domain') {
        const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
        setUnauthorizedDomain(hostname);
        setError("unauthorized-domain-error");
      } else if (error.code === 'permission-denied' || error.message?.includes('permission-denied')) {
        await signOut(auth).catch(() => {});
        setError("E-mail não cadastrado. Por favor, solicite seu acesso primeiro.");
      } else if (error.code !== 'auth/popup-closed-by-user') {
        setError("E-mail não cadastrado ou falha de autenticação. Por favor, solicite seu acesso.");
      }
    }
  };

  const handleRetry = () => {
    forceStopLoading();
    setGoogleLoading(false);
    setLoading(false);
    setShowRetry(false);
    window.location.reload();
  };

  if (userLoading || user || googleLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-6">
        <Loader className="animate-spin text-primary" size={40} />
        <p className="mt-4 text-muted-foreground animate-pulse font-bold text-center">Iniciando sessão...</p>
        
        {showRetry && (
            <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-xs w-full text-center">
                <p className="text-sm text-muted-foreground mb-4">O sistema está demorando mais que o normal para responder.</p>
                <Button onClick={handleRetry} variant="outline" className="w-full gap-2">
                    <RefreshCcw size={16} /> Tentar Novamente
                </Button>
            </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <div className="flex-grow flex items-center justify-center p-4">
        <div className="w-full max-w-sm p-8 space-y-6 bg-card text-card-foreground rounded-xl shadow-lg border border-border/50">
          <div className="flex flex-col items-center justify-center">
              <Image src="/images/Logo_v3.png" alt="Logo" width={80} height={80} className="rounded-lg mb-4" priority />
              <h1 className="text-3xl font-bold text-center tracking-tight">De Casa em Casa</h1>
              <TutorialButton 
                videoId={TUTORIAL_IDS.REGISTER} 
                label="Tutorial de Cadastro" 
                className="mt-2"
              />
          </div>
          
          {error === "unauthorized-domain-error" && unauthorizedDomain && (
              <div className="p-4 bg-blue-500/10 text-foreground border border-blue-500/25 rounded-lg space-y-3">
                  <div className="flex items-start gap-2.5">
                      <AlertTriangle size={20} className="text-blue-500 mt-0.5 shrink-0" />
                      <div>
                          <p className="text-sm font-bold text-foreground">Domínio não Autorizado</p>
                          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                              O Login com Google requer que este domínio esteja listado como autorizado no console do seu Firebase para que a autenticação ocorra com segurança.
                          </p>
                      </div>
                  </div>
                  
                  <div className="bg-muted p-2.5 rounded text-xs font-mono break-all flex items-center justify-between gap-2 border border-border">
                      <span className="select-all text-muted-foreground font-semibold">{unauthorizedDomain}</span>
                      <button 
                          type="button" 
                          onClick={() => {
                              navigator.clipboard.writeText(unauthorizedDomain);
                              setCopied(true);
                              setTimeout(() => setCopied(false), 2000);
                          }}
                          className="text-[10px] bg-primary text-primary-foreground px-2 py-1 rounded hover:bg-primary/90 font-sans font-bold whitespace-nowrap"
                      >
                          {copied ? 'Copiado!' : 'Copiar'}
                      </button>
                  </div>

                  <div className="text-xs text-muted-foreground space-y-1.5 pt-1">
                      <p className="font-semibold text-foreground">Como resolver:</p>
                      <ol className="list-decimal list-inside pl-1 space-y-1">
                          <li>Clique no link abaixo para abrir o painel do seu Firebase:</li>
                          <a 
                              href="https://console.firebase.google.com/project/appterritorios-e5bb5/authentication/providers" 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="text-primary hover:underline block font-semibold truncate pt-0.5"
                          >
                              Console do Firebase ↗
                          </a>
                          <li>No final da página de Provedores, acesse a seção <strong>Domínios autorizados</strong> (Authorized domains).</li>
                          <li>Clique em <strong>Adicionar domínio</strong> e cole o domínio copiado acima.</li>
                      </ol>
                  </div>
              </div>
          )}

          {error && error !== "unauthorized-domain-error" && (
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
                className="w-full px-4 py-2.5 bg-background border border-input rounded-md focus:ring-2 focus:ring-primary outline-none text-base"
                autoComplete="email"
                disabled={loading || googleLoading}
              />
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Sua senha"
                  required
                  className="w-full px-4 py-2.5 bg-background border border-input rounded-md focus:ring-2 focus:ring-primary outline-none pr-10 text-base"
                  autoComplete="current-password"
                  disabled={loading || googleLoading}
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
              {loading ? <><Loader className="animate-spin inline mr-2" size={18}/> Acessando...</> : 'Entrar com E-mail'}
            </button>
          </form>

          <div className="relative">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">Ou use o</span></div>
          </div>

          <button onClick={handleGoogleLogin} disabled={loading || googleLoading} className="w-full flex items-center justify-center gap-3 px-4 py-2.5 font-semibold text-foreground bg-background border border-input rounded-md hover:bg-accent transition-colors disabled:opacity-50">
              <svg className="w-5 h-5" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"></path><path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z"></path><path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"></path><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.021 35.596 44 30.138 44 24c0-1.341-.138-2.65-.389-3.917z"></path></svg>
              Google
          </button>
          
          <div className="text-center text-sm space-y-4 pt-2">
              <Link href="/recuperar-senha" className="block text-primary font-semibold hover:underline">Esqueceu a senha?</Link>

              <div className="p-4 bg-secondary/50 border border-border rounded-lg space-y-3">
                  <div className="space-y-2">
                      <Link href="/cadastro" className="block w-full text-center px-4 py-2 font-bold text-primary border border-primary rounded-md hover:bg-primary/10 transition-all text-sm">
                          Solicite seu acesso aqui
                      </Link>
                  </div>
                  <div className="pt-2 border-t border-border/50 space-y-2">
                      <Link href="/nova-congregacao" className="block w-full text-center px-4 py-2 text-sm font-bold text-foreground bg-muted border border-border rounded-md hover:bg-muted/80 transition-all">
                          Criar Congregação
                      </Link>
                  </div>
              </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
