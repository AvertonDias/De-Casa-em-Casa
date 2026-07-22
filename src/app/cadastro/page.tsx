"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth, db, functions } from '@/lib/firebase';
import { doc, setDoc, getDoc, deleteDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useUser } from '@/contexts/UserContext';
import Image from 'next/image';
import Link from 'next/link';
import { Eye, EyeOff, Loader, CheckCircle2, ArrowLeft, Building2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { LgpdModal } from '@/components/LgpdModals';
import { Button } from '@/components/ui/button';
import { Footer } from '@/components/Footer';
import { maskPhone } from '@/lib/utils';

export default function SignUpPage() {
  const { user, loading: userLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [congregationNumber, setCongregationNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptedLgpd, setAcceptedLgpd] = useState(false);
  const [highlightLgpdError, setHighlightLgpdError] = useState(false);
  const [isLgpdDetailOpen, setIsLgpdDetailOpen] = useState(false);
  const [lgpdModalType, setLgpdModalType] = useState<'terms' | 'privacy'>('terms');
  
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleAuthenticated, setGoogleAuthenticated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Se o usuário já estiver logado, redireciona de volta
  useEffect(() => {
    if (!userLoading && user) {
      if (user.congregationId) {
        if (user.status === 'pendente') {
          router.replace('/aguardando-aprovacao');
        } else {
          router.replace('/dashboard');
        }
      } else {
        router.replace('/completar-perfil?mode=join');
      }
    }
  }, [user, userLoading, router]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const targetName = name.trim();
    const targetEmail = email.trim().toLowerCase().replace(/\s/g, '');
    const cleanWhatsapp = whatsapp.trim();
    const cleanCongNumber = congregationNumber.trim().replace(/\D/g, '');
    const targetPassword = password;

    if (!targetName) {
      setError("Por favor, preencha o seu nome completo.");
      return;
    }
    if (!targetEmail) {
      setError("Por favor, informe seu endereço de e-mail.");
      return;
    }
    if (cleanWhatsapp.length < 15) {
      setError("Por favor, informe um número de WhatsApp válido.");
      return;
    }
    if (!cleanCongNumber) {
      setError("Por favor, informe o número oficial da congregação.");
      return;
    }

    const isGoogle = googleAuthenticated || !!auth.currentUser;

    if (!isGoogle) {
      if (targetPassword.length < 6) {
        setError("A senha deve conter no mínimo 6 caracteres.");
        return;
      }
      if (targetPassword !== confirmPassword) {
        setError("As senhas informadas não coincidem.");
        return;
      }
    }

    if (!acceptedLgpd && !isGoogle) {
      const msg = "Atenção: Por favor, leia e aceite os Termos de Uso e Política de Privacidade para continuar.";
      setError(msg);
      setHighlightLgpdError(true);
      toast({
        title: "Aviso de Confirmação",
        description: "Por favor, leia e marque a caixa de aceite dos Termos de Uso e Política de Privacidade para continuar.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // 1. Buscar a congregação pelo número informado
      let congregationId = '';
      try {
        const getCongId = httpsCallable(functions, 'getCongregationIdByNumberV2');
        const res = await getCongId({ congregationNumber: cleanCongNumber });
        congregationId = (res.data as any)?.congregationId;
      } catch (errFunc) {
        console.warn("getCongregationIdByNumberV2 falhou, tentando consulta direta ao Firestore:", errFunc);
      }

      if (!congregationId) {
        const congQuery = query(collection(db, "congregations"), where("number", "==", cleanCongNumber));
        const congSnap = await getDocs(congQuery);
        if (!congSnap.empty) {
          congregationId = congSnap.docs[0].id;
        }
      }

      if (!congregationId) {
        setError("Congregação não encontrada com o número informado. Verifique com seu dirigente.");
        setLoading(false);
        return;
      }

      let firebaseUser = auth.currentUser;

      if (!isGoogle) {
        // 2. Criar credencial de acesso no Firebase Auth com Email/Senha
        const userCredential = await createUserWithEmailAndPassword(auth, targetEmail, targetPassword);
        firebaseUser = userCredential.user;
      }

      if (!firebaseUser) {
        throw new Error("Sessão expirada. Por favor, autentique-se novamente.");
      }

      // 3. Salvar documento na coleção 'users' vinculado à congregação
      await setDoc(doc(db, "users", firebaseUser.uid), {
        uid: firebaseUser.uid,
        name: targetName || firebaseUser.displayName || 'Publicador',
        email: targetEmail || firebaseUser.email,
        whatsapp: cleanWhatsapp,
        congregationId: congregationId,
        role: "Publicador",
        status: "pendente",
        acceptedLGPD: acceptedLgpd || isGoogle,
        acceptedLGPDAt: (acceptedLgpd || isGoogle) ? serverTimestamp() : null,
        createdAt: serverTimestamp(),
        lastSeen: serverTimestamp()
      }, { merge: true });

      // Limpar registros anteriores de tentativas de login incorretas
      try {
        await deleteDoc(doc(db, 'loginAttempts', targetEmail));
      } catch (e) {
        console.warn("Não foi possível apagar bloqueios anteriores de loginAttempts:", e);
      }
      if (typeof window !== 'undefined') {
        localStorage.removeItem(`login_attempts_${targetEmail}`);
      }

      toast({
        title: "Solicitação de acesso enviada!",
        description: "Sua conta foi criada e aguarda aprovação pelo administrador.",
      });

      // 4. Redirecionar diretamente para a página de aguardando aprovação
      router.replace('/aguardando-aprovacao');

    } catch (err: any) {
      console.error("Erro ao registrar:", err.code, err.message);
      if (err.code === 'auth/email-already-in-use') {
        setError("Este e-mail já está sendo utilizado por outra conta.");
      } else if (err.code === 'auth/invalid-email') {
        setError("O e-mail informado é inválido.");
      } else if (err.code === 'auth/weak-password') {
        setError("A senha é muito fraca. Utilize pelo menos 6 caracteres.");
      } else {
        setError(err.message || "Ocorreu um erro ao criar sua conta. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setError(null);
    setGoogleLoading(true);
    setLoading(true);

    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('google_auth_intent', 'join');
      }

      let firebaseUser = auth.currentUser;

      if (!firebaseUser) {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        const userCredential = await signInWithPopup(auth, provider);
        firebaseUser = userCredential.user;
      }

      setGoogleAuthenticated(true);
      const isGoogle = true;
      if (firebaseUser.displayName && !name) setName(firebaseUser.displayName);
      if (firebaseUser.email && !email) setEmail(firebaseUser.email);

      const cleanWhatsapp = whatsapp.trim();
      const cleanCongNumber = congregationNumber.trim().replace(/\D/g, '');

      if (!cleanCongNumber || cleanWhatsapp.length < 15) {
        toast({
          title: "Autenticado com o Google!",
          description: "Por favor, preencha o número da congregação e seu WhatsApp abaixo para concluir sua solicitação.",
        });
        setGoogleLoading(false);
        setLoading(false);
        return;
      }

      if (!acceptedLgpd) {
        const msg = "Atenção: Por favor, leia e aceite os Termos de Uso e Política de Privacidade para continuar.";
        setError(msg);
        setHighlightLgpdError(true);
        toast({
          title: "Aviso de Confirmação",
          description: msg,
          variant: "destructive",
        });
        setGoogleLoading(false);
        setLoading(false);
        return;
      }

      // Validar congregação
      let congregationId = '';
      try {
        const getCongId = httpsCallable(functions, 'getCongregationIdByNumberV2');
        const res = await getCongId({ congregationNumber: cleanCongNumber });
        congregationId = (res.data as any)?.congregationId;
      } catch (errFunc) {
        console.warn("getCongregationIdByNumberV2 falhou:", errFunc);
      }

      if (!congregationId) {
        const congQuery = query(collection(db, "congregations"), where("number", "==", cleanCongNumber));
        const congSnap = await getDocs(congQuery);
        if (!congSnap.empty) {
          congregationId = congSnap.docs[0].id;
        }
      }

      if (!congregationId) {
        setError("Congregação não encontrada com o número informado. Verifique com seu dirigente.");
        setGoogleLoading(false);
        setLoading(false);
        return;
      }

      // Salvar ou atualizar perfil no Firestore
      const userDocRef = doc(db, "users", firebaseUser.uid);
      await setDoc(userDocRef, {
        uid: firebaseUser.uid,
        name: name.trim() || firebaseUser.displayName || 'Publicador',
        email: firebaseUser.email,
        whatsapp: cleanWhatsapp,
        congregationId: congregationId,
        role: "Publicador",
        status: "pendente",
        acceptedLGPD: acceptedLgpd || isGoogle,
        acceptedLGPDAt: (acceptedLgpd || isGoogle) ? serverTimestamp() : null,
        createdAt: serverTimestamp(),
        lastSeen: serverTimestamp()
      }, { merge: true });

      toast({
        title: "Solicitação de acesso enviada!",
        description: "Sua conta foi vinculada e aguarda aprovação pelo administrador.",
      });

      router.replace('/aguardando-aprovacao');

    } catch (err: any) {
      console.error("Erro ao cadastrar com o Google:", err.code, err.message);
      if (err.code === 'auth/account-exists-with-different-credential') {
        setError("Este e-mail já possui uma conta com senha de e-mail. Tente fazer login usando sua senha.");
      } else if (err.code === 'auth/popup-blocked') {
        setError("O pop-up de login foi bloqueado pelo seu navegador. Por favor, libere pop-ups para este site.");
      } else if (err.code !== 'auth/popup-closed-by-user') {
        setError("Falha ao registrar com o Google. Tente preencher o formulário manual.");
      }
    } finally {
      setGoogleLoading(false);
      setLoading(false);
    }
  };

  const handleOpenLgpdDetail = (type: 'terms' | 'privacy') => {
    setLgpdModalType(type);
    setIsLgpdDetailOpen(true);
  };

  if (userLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background">
        <Loader className="animate-spin text-primary" size={40} />
        <p className="mt-4 text-muted-foreground animate-pulse font-bold">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <div className="flex-grow flex items-center justify-center p-4">
        <div className="w-full max-w-sm p-6 space-y-6 bg-card text-card-foreground rounded-xl shadow-lg border border-border/50">
          <div className="space-y-2">
            <Link href="/" className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground mb-2">
              <ArrowLeft size={14} className="mr-1" /> Voltar ao Login
            </Link>
            <div className="flex flex-col items-center justify-center">
              <Image src="/images/Logo_v3.png" alt="Logo" width={60} height={60} className="rounded-lg mb-2" priority />
              <h1 className="text-2xl font-bold text-center tracking-tight">Solicitar Acesso</h1>
              <p className="text-xs text-muted-foreground text-center">Informe seus dados e o número da sua congregação</p>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-destructive/10 text-destructive border border-destructive/20 rounded-lg text-xs leading-relaxed text-center font-medium">
              {error}
            </div>
          )}

          {googleAuthenticated && (
            <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-lg text-xs leading-relaxed text-center font-medium">
              <span className="font-bold">Conta do Google Conectada!</span> Preencha o Número da Congregação e seu WhatsApp abaixo para concluir sua solicitação de acesso.
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-muted-foreground uppercase font-bold ml-1">Seu Nome Completo</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome Completo"
                  required
                  className="w-full px-4 py-2.5 bg-background border border-input rounded-md focus:ring-2 focus:ring-primary outline-none text-sm"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="text-[10px] text-muted-foreground uppercase font-bold ml-1">Seu E-mail</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value.toLowerCase().trim().replace(/\s/g, ''))}
                  placeholder="Seu melhor e-mail"
                  required
                  className="w-full px-4 py-2.5 bg-background border border-input rounded-md focus:ring-2 focus:ring-primary outline-none text-sm"
                  disabled={loading || googleAuthenticated}
                />
              </div>

              <div>
                <label className="text-[10px] text-muted-foreground uppercase font-bold ml-1">Seu WhatsApp</label>
                <input
                  type="tel"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(maskPhone(e.target.value))}
                  placeholder="(XX) XXXXX-XXXX"
                  required
                  className="w-full px-4 py-2.5 bg-background border border-input rounded-md focus:ring-2 focus:ring-primary outline-none text-sm"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="text-[10px] text-muted-foreground uppercase font-bold ml-1">Número da Congregação</label>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={congregationNumber}
                  onChange={(e) => setCongregationNumber(e.target.value.replace(/\D/g, ''))}
                  placeholder="Número oficial da congregação"
                  required
                  className="w-full px-4 py-2.5 bg-background border border-input rounded-md focus:ring-2 focus:ring-primary outline-none text-sm"
                  disabled={loading}
                />
              </div>

              {!googleAuthenticated && (
                <>
                  <div className="relative">
                    <label className="text-[10px] text-muted-foreground uppercase font-bold ml-1">Sua Senha</label>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Crie uma senha (mínimo 6 dígitos)"
                      required={!googleAuthenticated}
                      className="w-full px-4 py-2.5 bg-background border border-input rounded-md focus:ring-2 focus:ring-primary outline-none pr-10 text-sm"
                      disabled={loading}
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute bottom-2.5 right-3 text-muted-foreground hover:text-foreground">
                      {showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}
                    </button>
                  </div>

                  <div className="relative">
                    <label className="text-[10px] text-muted-foreground uppercase font-bold ml-1">Confirme a Senha</label>
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirme sua senha"
                      required={!googleAuthenticated}
                      className="w-full px-4 py-2.5 bg-background border border-input rounded-md focus:ring-2 focus:ring-primary outline-none pr-10 text-sm"
                      disabled={loading}
                    />
                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute bottom-2.5 right-3 text-muted-foreground hover:text-foreground">
                      {showConfirmPassword ? <EyeOff size={18}/> : <Eye size={18}/>}
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Checkbox LGPD */}
            <div className={`flex items-start gap-2.5 select-none border rounded-lg p-2.5 transition-all ${
              highlightLgpdError 
                ? "border-destructive bg-destructive/10 ring-2 ring-destructive/30" 
                : "border-border/40 bg-muted/30"
            }`}>
              <input 
                id="cadastro-lgpd-checkbox" 
                type="checkbox" 
                checked={acceptedLgpd}
                onChange={(e) => {
                  setAcceptedLgpd(e.target.checked);
                  if (e.target.checked) setHighlightLgpdError(false);
                }}
                className="h-5 w-5 rounded border-border text-primary focus:ring-primary/50 shrink-0 cursor-pointer accent-primary mt-0.5"
                disabled={loading}
              />
              <label htmlFor="cadastro-lgpd-checkbox" className="text-xs cursor-pointer text-muted-foreground leading-snug">
                Declaro que li e concordo com os{' '}
                <button 
                  type="button" 
                  onClick={() => handleOpenLgpdDetail('terms')}
                  className="text-primary hover:underline font-bold"
                >
                  Termos de Uso
                </button>{' '}
                e com a{' '}
                <button 
                  type="button" 
                  onClick={() => handleOpenLgpdDetail('privacy')}
                  className="text-primary hover:underline font-bold"
                >
                  Política de Privacidade
                </button>{' '}
                em total conformidade com as regras da LGPD.
              </label>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full font-bold h-11"
            >
              {loading ? <><Loader className="animate-spin inline mr-2" size={18}/> Processando...</> : <><CheckCircle2 className="mr-2" size={18} /> Solicitar Acesso</>}
            </Button>
          </form>

          <div className="relative">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">Ou</span></div>
          </div>

          <button 
            type="button"
            onClick={handleGoogleSignUp} 
            disabled={loading || googleLoading} 
            className="w-full flex items-center justify-center gap-3 px-4 py-2.5 font-semibold text-foreground bg-background border border-input rounded-md hover:bg-accent transition-colors disabled:opacity-50 cursor-pointer text-sm"
          >
              <svg className="w-4 h-4" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"></path><path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z"></path><path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"></path><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.021 35.596 44 30.138 44 24c0-1.341-.138-2.65-.389-3.917z"></path></svg>
              Solicitar Acesso via Google
          </button>

          <div className="pt-2 text-center text-xs text-muted-foreground space-y-2">
            <div>
              Quer cadastrar uma congregação nova? <Link href="/nova-congregacao" className="text-primary hover:underline font-bold">Clique aqui</Link>
            </div>
            <div>
              Já tem uma conta cadastrada? <Link href="/" className="text-primary hover:underline font-bold">Faça login aqui</Link>
            </div>
          </div>
        </div>
      </div>
      <Footer />

      <LgpdModal 
        isOpen={isLgpdDetailOpen} 
        onOpenChange={setIsLgpdDetailOpen} 
        type={lgpdModalType} 
      />
    </div>
  );
}

