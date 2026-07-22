"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, setDoc, getDoc, collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { useUser } from '@/contexts/UserContext';
import Image from 'next/image';
import Link from 'next/link';
import { Eye, EyeOff, Loader, Building2, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { LgpdModal } from '@/components/LgpdModals';
import { Button } from '@/components/ui/button';
import { Footer } from '@/components/Footer';
import { maskPhone } from '@/lib/utils';

export default function NewCongregationSignUpPage() {
  const { user, loading: userLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [congregationName, setCongregationName] = useState('');
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
  const [error, setError] = useState<string | null>(null);
  const [googleAuthenticated, setGoogleAuthenticated] = useState(false);

  // Se o usuário já estiver logado, apenas redireciona para o dashboard se tiver congregação
  useEffect(() => {
    if (!userLoading && user) {
      if (user.congregationId) {
        router.replace('/dashboard');
      } else {
        // Preencher nome e e-mail vindo do usuário autenticado no Google
        if (user.name && !name) setName(user.name);
        if (user.email && !email) setEmail(user.email);
        setGoogleAuthenticated(true);
      }
    }
  }, [user, userLoading, router, name, email]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const targetName = name.trim();
    const targetEmail = email.trim().toLowerCase().replace(/\s/g, '');
    const cleanWhatsapp = whatsapp.trim();
    const cleanCongName = congregationName.trim();
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
    if (!cleanCongName) {
      setError("Por favor, informe o nome da congregação.");
      return;
    }
    if (!cleanCongNumber) {
      setError("Por favor, informe o número oficial da congregação.");
      return;
    }

    const currentFirebaseUser = auth.currentUser;

    if (!currentFirebaseUser) {
      if (targetPassword.length < 6) {
        setError("A senha deve conter no mínimo 6 caracteres.");
        return;
      }
      if (targetPassword !== confirmPassword) {
        setError("As senhas informadas não coincidem.");
        return;
      }
    }

    if (!acceptedLgpd && !currentFirebaseUser && !googleAuthenticated) {
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
      // 1. Verificar se o número de congregação já está cadastrado
      const congQuery = query(collection(db, "congregations"), where("number", "==", cleanCongNumber));
      const congSnap = await getDocs(congQuery);
      if (!congSnap.empty) {
        const msg = "Este número de congregação já está em uso por outra congregação cadastrada. Se a sua congregação já usa o sistema, vá para a página de Cadastro para solicitar acesso.";
        setError(msg);
        toast({
          title: "Número de congregação em uso",
          description: msg,
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      let activeUser = currentFirebaseUser;

      // 2. Criar credencial se não estiver autenticado via Google
      if (!activeUser) {
        const userCredential = await createUserWithEmailAndPassword(auth, targetEmail, targetPassword);
        activeUser = userCredential.user;
      }

      // 3. Cadastrar a nova congregação no Firestore
      const newCongRef = await addDoc(collection(db, "congregations"), {
        name: cleanCongName,
        number: cleanCongNumber,
        territoryCount: 0,
        ruralTerritoryCount: 0,
        totalQuadras: 0,
        totalHouses: 0,
        totalHousesDone: 0,
        createdAt: serverTimestamp(),
        lastUpdate: serverTimestamp(),
        defaultAssignmentMonths: 2,
        whatsappEnabled: true
      });

      // 4. Salvar usuário no Firestore como Administrador
      await setDoc(doc(db, "users", activeUser.uid), {
        uid: activeUser.uid,
        name: targetName || activeUser.displayName || 'Administrador',
        email: activeUser.email || targetEmail,
        whatsapp: cleanWhatsapp,
        congregationId: newCongRef.id,
        role: "Administrador",
        status: "ativo",
        acceptedLGPD: true,
        acceptedLGPDAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        lastSeen: serverTimestamp()
      }, { merge: true });

      toast({
        title: "Congregação e conta criadas!",
        description: "Você foi definido como administrador da nova congregação.",
      });

      // 5. Redirecionar diretamente para o Dashboard
      router.replace('/dashboard');

    } catch (err: any) {
      console.error("Erro ao registrar administrador e congregação:", err.code, err.message);
      if (err.code === 'auth/email-already-in-use') {
        setError("Este e-mail já está sendo utilizado por outra conta.");
      } else if (err.code === 'auth/invalid-email') {
        setError("O e-mail informado é inválido.");
      } else if (err.code === 'auth/weak-password') {
        setError("A senha é muito fraca. Utilize pelo menos 6 caracteres.");
      } else {
        setError(err.message || "Ocorreu um erro ao criar a congregação. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    if (!acceptedLgpd) {
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

    setError(null);
    setGoogleLoading(true);
    setLoading(true);

    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('google_auth_intent', 'create');
      }

      let firebaseUser = auth.currentUser;

      if (!firebaseUser) {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        const userCredential = await signInWithPopup(auth, provider);
        firebaseUser = userCredential.user;
      }

      setGoogleAuthenticated(true);
      if (firebaseUser.displayName && !name) setName(firebaseUser.displayName);
      if (firebaseUser.email && !email) setEmail(firebaseUser.email);

      const cleanWhatsapp = whatsapp.trim();
      const cleanCongName = congregationName.trim();
      const cleanCongNumber = congregationNumber.trim().replace(/\D/g, '');

      if (!cleanCongName || !cleanCongNumber || cleanWhatsapp.length < 15) {
        toast({
          title: "Autenticado com o Google!",
          description: "Por favor, preencha o Nome da Congregação, Número e WhatsApp abaixo para concluir.",
        });
        setGoogleLoading(false);
        setLoading(false);
        return;
      }

      // Verificar se o número de congregação já existe
      const congQuery = query(collection(db, "congregations"), where("number", "==", cleanCongNumber));
      const congSnap = await getDocs(congQuery);
      if (!congSnap.empty) {
        const msg = "Este número de congregação já está em uso por outra congregação cadastrada. Se a sua congregação já usa o sistema, vá para a página de Cadastro para solicitar acesso.";
        setError(msg);
        toast({
          title: "Número de congregação em uso",
          description: msg,
          variant: "destructive"
        });
        setGoogleLoading(false);
        setLoading(false);
        return;
      }

      // Verificar se o usuário já possui perfil cadastrado no Firestore
      const userDocRef = doc(db, "users", firebaseUser.uid);
      const userSnap = await getDoc(userDocRef);

      if (userSnap.exists() && userSnap.data()?.congregationId) {
        toast({
          title: "Sessão iniciada!",
          description: "Sua conta do Google já está vinculada a uma congregação.",
        });
        router.replace('/dashboard');
        return;
      }

      // Cadastrar a congregação
      const newCongRef = await addDoc(collection(db, "congregations"), {
        name: cleanCongName,
        number: cleanCongNumber,
        territoryCount: 0,
        ruralTerritoryCount: 0,
        totalQuadras: 0,
        totalHouses: 0,
        totalHousesDone: 0,
        createdAt: serverTimestamp(),
        lastUpdate: serverTimestamp(),
        defaultAssignmentMonths: 2,
        whatsappEnabled: true
      });

      // Criar/atualizar documento na coleção 'users' com perfil de administrador
      await setDoc(userDocRef, {
        uid: firebaseUser.uid,
        name: name.trim() || firebaseUser.displayName || 'Administrador',
        email: firebaseUser.email,
        whatsapp: cleanWhatsapp,
        congregationId: newCongRef.id,
        role: "Administrador",
        status: "ativo",
        acceptedLGPD: true,
        acceptedLGPDAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        lastSeen: serverTimestamp()
      }, { merge: true });

      toast({
        title: "Congregação e conta criadas!",
        description: "Sua conta do Google foi vinculada como administradora.",
      });

      router.replace('/dashboard');

    } catch (err: any) {
      console.error("Erro ao cadastrar com o Google:", err.code, err.message);
      if (err.code === 'auth/account-exists-with-different-credential') {
        setError("Este e-mail já possui uma conta com senha de e-mail. Tente fazer login usando sua senha.");
      } else if (err.code === 'auth/popup-blocked') {
        setError("O pop-up de login foi bloqueado pelo seu navegador. Por favor, libere pop-ups para este site.");
      } else if (err.code !== 'auth/popup-closed-by-user') {
        setError("Falha ao registrar com o Google. Tente novamente ou preencha o formulário.");
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
              <h1 className="text-2xl font-bold text-center tracking-tight">Criar Congregação</h1>
              <p className="text-xs text-muted-foreground text-center">Informe os dados para cadastrar a congregação e sua conta de administrador</p>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-destructive/10 text-destructive border border-destructive/20 rounded-lg text-xs leading-relaxed text-center font-medium">
              {error}
            </div>
          )}

          {(googleAuthenticated || auth.currentUser) && (
            <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-lg text-xs leading-relaxed flex items-center gap-2">
              <CheckCircle2 size={18} className="shrink-0" />
              <div>
                <p className="font-bold">Conta do Google conectada!</p>
                <p className="text-[11px] opacity-90">Preencha o Nome, Número da congregação e seu WhatsApp para concluir a criação.</p>
              </div>
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-muted-foreground uppercase font-bold ml-1">Seu Nome Completo (Administrador)</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu Nome Completo"
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
                  placeholder="Seu e-mail de administrador"
                  required
                  className="w-full px-4 py-2.5 bg-background border border-input rounded-md focus:ring-2 focus:ring-primary outline-none text-sm"
                  disabled={loading || googleAuthenticated || !!auth.currentUser}
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
                <label className="text-[10px] text-muted-foreground uppercase font-bold ml-1">Nome da Congregação</label>
                <input
                  type="text"
                  value={congregationName}
                  onChange={(e) => setCongregationName(e.target.value)}
                  placeholder="Ex: Central"
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

              {!googleAuthenticated && !auth.currentUser && (
                <>
                  <div className="relative">
                    <label className="text-[10px] text-muted-foreground uppercase font-bold ml-1">Sua Senha</label>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Crie uma senha (mínimo 6 dígitos)"
                      required
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
                      required
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
                id="create-lgpd-checkbox" 
                type="checkbox" 
                checked={acceptedLgpd}
                onChange={(e) => {
                  setAcceptedLgpd(e.target.checked);
                  if (e.target.checked) setHighlightLgpdError(false);
                }}
                className="h-5 w-5 rounded border-border text-primary focus:ring-primary/50 shrink-0 cursor-pointer accent-primary mt-0.5"
                disabled={loading}
              />
              <label htmlFor="create-lgpd-checkbox" className="text-xs cursor-pointer text-muted-foreground leading-snug">
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
              {loading ? <><Loader className="animate-spin inline mr-2" size={18}/> Cadastrando...</> : <><Building2 className="mr-2" size={18} /> Criar Congregação e Entrar</>}
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
              Criar Congregação via Google
          </button>

          <div className="pt-2 text-center text-xs text-muted-foreground space-y-2">
            <div>
              Quer apenas solicitar acesso? <Link href="/cadastro" className="text-primary hover:underline font-bold">Clique aqui</Link>
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

