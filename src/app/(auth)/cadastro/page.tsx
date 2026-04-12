
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword, updateProfile, signInWithPopup, GoogleAuthProvider } from 'firebase/auth'; 
import { auth, db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import Link from 'next/link';
import Image from 'next/image';
import { Eye, EyeOff, AlertTriangle, Loader } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { maskPhone } from '@/lib/utils';
import { Footer } from '@/components/Footer';
import { useUser } from '@/contexts/UserContext';

export default function SignUpPage() {
  const { user: currentUser, loading: userLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [congregationNumber, setCongregationNumber] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [confirmWhatsapp, setConfirmWhatsapp] = useState('');
  
  const [error, setError] = useState<React.ReactNode>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Redireciona se já estiver logado
  useEffect(() => {
    if (!userLoading && currentUser?.congregationId) {
      router.replace('/dashboard');
    }
  }, [currentUser, userLoading, router]);

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    // Limpeza em tempo real: remove espaços e força minúsculas
    setEmail(e.target.value.toLowerCase().replace(/\s/g, ''));
  };

  const handleWhatsappChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setter(maskPhone(e.target.value));
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validações básicas
    if (password !== confirmPassword) { setError("As senhas não coincidem."); return; }
    if (whatsapp !== confirmWhatsapp) { setError("Os números de WhatsApp não coincidem."); return; }
    if (password.length < 6) { setError("A senha precisa ter pelo menos 6 caracteres."); return; }
    if (whatsapp.length < 15) { setError("Por favor, preencha o número de WhatsApp completo."); return; }
    
    setLoading(true);

    // Normalização rigorosa do e-mail
    const targetEmail = email.trim().toLowerCase();
    
    try {
        // 1. Verificar se a congregação existe
        const congQuery = query(collection(db, "congregations"), where("number", "==", congregationNumber.trim()));
        const congSnap = await getDocs(congQuery);

        if (congSnap.empty) {
            throw new Error("Número de congregação inválido ou não encontrado. Verifique com seu dirigente.");
        }
        const congregationId = congSnap.docs[0].id;

        // 2. Criar conta no Firebase Auth (o Firebase já impede e-mails duplicados aqui)
        const userCredential = await createUserWithEmailAndPassword(auth, targetEmail, password);
        const user = userCredential.user;
        
        // 3. Atualizar nome no perfil do Auth
        await updateProfile(user, { displayName: name.trim() });
        
        // 4. Criar documento no Firestore
        const userDocRef = doc(db, "users", user.uid);
        await setDoc(userDocRef, {
            name: name.trim(),
            email: targetEmail,
            whatsapp: whatsapp,
            congregationId: congregationId,
            role: "Publicador",
            status: "pendente",
            createdAt: serverTimestamp(),
            lastSeen: serverTimestamp()
        });
      
        toast({
            title: 'Solicitação enviada!',
            description: 'Sua conta foi criada. Agora um administrador precisa aprovar seu acesso.',
        });
      
    } catch (err: any) {
      console.error("Erro no cadastro:", err);
      if (err.code === 'auth/email-already-in-use') { 
        setError(<>Este e-mail já está cadastrado. <Link href="/recuperar-senha" className="font-bold underline ml-1">Esqueceu a senha?</Link></>); 
      } else if (err.code === 'auth/invalid-email') {
        setError("O e-mail digitado não é válido.");
      } else if (err.code === 'auth/weak-password') {
        setError("A senha escolhida é muito fraca.");
      } else { 
        setError(err.message || "Não foi possível completar o cadastro agora."); 
      }
    } finally {
        setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        await signInWithPopup(auth, provider);
        // O UserContext cuidará do redirecionamento após o login bem-sucedido
    } catch (error: any) {
      if (error.code === 'auth/account-exists-with-different-credential') {
        setError("Já existe uma conta com este e-mail vinculada a uma senha.");
      } else if (error.code !== 'auth/popup-closed-by-user') {
        setError("Erro ao autenticar com o Google.");
      }
    } finally {
        setGoogleLoading(false);
    }
  };
  
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <div className="flex-grow flex items-center justify-center p-4">
        <div className="w-full max-w-sm p-8 space-y-6 bg-card text-card-foreground rounded-xl shadow-lg border border-border/50">
          <div className="flex flex-col items-center justify-center">
              <Image src="/images/Logo_v3.png" alt="Logo" width={80} height={80} className="rounded-lg mb-4" priority />
              <h1 className="text-3xl font-bold text-center">Solicitar Acesso</h1>
          </div>

          {error && (
              <div className="p-4 bg-destructive/10 text-destructive-foreground border border-destructive/20 rounded-lg flex items-start gap-3">
                  <AlertTriangle size={20} className="text-destructive mt-0.5 shrink-0" />
                  <div className="text-sm font-medium">{error}</div>
              </div>
          )}

          <form onSubmit={handleSignUp} className="space-y-4">
              <div className="space-y-3">
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome Completo" required className="w-full px-4 py-2 bg-background border border-input rounded-md focus:ring-2 focus:ring-primary outline-none" />
                <input type="email" value={email} onChange={handleEmailChange} placeholder="E-mail (ex: seu@email.com)" required className="w-full px-4 py-2 bg-background border border-input rounded-md focus:ring-2 focus:ring-primary outline-none" />
                
                <div className="relative">
                  <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Senha (mín. 6 dígitos)" required className="w-full px-4 py-2 bg-background border border-input rounded-md pr-10 focus:ring-2 focus:ring-primary outline-none" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 px-3 flex items-center text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff size={20}/> : <Eye size={20}/>}
                  </button>
                </div>
                
                <div className="relative">
                  <input type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirmar Senha" required className="w-full px-4 py-2 bg-background border border-input rounded-md pr-10 focus:ring-2 focus:ring-primary outline-none" />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute inset-y-0 right-0 px-3 flex items-center text-muted-foreground hover:text-foreground">
                    {showConfirmPassword ? <EyeOff size={20}/> : <Eye size={20}/>}
                  </button>
                </div>

                <div className="pt-2">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1 ml-1 tracking-wider">Sua Congregação</p>
                  <input type="tel" inputMode="numeric" value={congregationNumber} onChange={(e) => setCongregationNumber(e.target.value.replace(/\D/g, ''))} placeholder="Número da Congregação" required className="w-full px-4 py-2 bg-background border border-input rounded-md focus:ring-2 focus:ring-primary outline-none" />
                </div>

                <div className="pt-2">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1 ml-1 tracking-wider">Contato WhatsApp</p>
                  <input type="tel" value={whatsapp} onChange={handleWhatsappChange(setWhatsapp)} placeholder="Seu WhatsApp" required className="w-full px-4 py-2 bg-background border border-input rounded-md focus:ring-2 focus:ring-primary outline-none" />
                  <input type="tel" value={confirmWhatsapp} onChange={handleWhatsappChange(setConfirmWhatsapp)} placeholder="Confirmar WhatsApp" required className="w-full px-4 py-2 bg-background border border-input rounded-md mt-2 focus:ring-2 focus:ring-primary outline-none" />
                </div>
              </div>

              <button type="submit" disabled={loading || googleLoading || !name || !email || whatsapp.length < 15} className="w-full px-4 py-3 font-bold text-primary-foreground bg-primary rounded-md hover:bg-primary/90 disabled:opacity-50 transition-all shadow-md mt-4">
                {loading ? <><Loader className="animate-spin inline mr-2" size={18}/> Processando...</> : 'Criar Conta e Solicitar'}
              </button>
          </form>

          <div className="relative">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">Ou use o Google</span></div>
          </div>

          <button onClick={handleGoogleSignUp} disabled={loading || googleLoading} className="w-full flex items-center justify-center gap-3 px-4 py-2 font-semibold text-foreground bg-background border border-input rounded-md hover:bg-accent transition-colors disabled:opacity-50">
              {googleLoading ? <Loader className="animate-spin" size={20}/> : (<><svg className="w-5 h-5" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"></path><path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z"></path><path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"></path><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.021 35.596 44 30.138 44 24c0-1.341-.138-2.65-.389-3.917z"></path></svg>Solicitar via Google</>)}
          </button>

          <div className="text-center text-sm">
              <Link href="/" className="text-muted-foreground hover:text-primary underline underline-offset-4">Já tem uma conta? Faça login</Link>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
