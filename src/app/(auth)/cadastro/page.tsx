"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword, updateProfile, signInWithPopup, GoogleAuthProvider } from 'firebase/auth'; 
import { auth, functions } from '@/lib/firebase';
import Link from 'next/link';
import Image from 'next/image';
import { Eye, EyeOff } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { maskPhone } from '@/lib/utils';
import { httpsCallable } from 'firebase/functions';

const getCongregationIdByNumber = httpsCallable(functions, 'getCongregationIdByNumberV2');
const completeUserProfile = httpsCallable(functions, 'completeUserProfileV2');
const notifyOnNewUser = httpsCallable(functions, 'notifyOnNewUserV2');


export default function SignUpPage() {
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
  const router = useRouter();
  const { toast } = useToast();

  const handleInputChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setter(e.target.value);
  }
  
  const handleWhatsappChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setter(maskPhone(e.target.value));
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) { setError("As senhas não coincidem."); return; }
    if (whatsapp !== confirmWhatsapp) { setError("Os números de WhatsApp não coincidem."); return; }
    if (password.length < 6) { setError("A senha precisa ter pelo menos 6 caracteres."); return; }
    if (whatsapp.length < 15) { setError("Por favor, preencha o número de WhatsApp completo."); return; }
    
    setLoading(true);
    setError(null);
    
    try {
        const congIdRes: any = await getCongregationIdByNumber({ congregationNumber: congregationNumber.trim() });
        const congIdData = congIdRes.data;

        if (!congIdData.success) {
            throw new Error(congIdData.message || "Número da congregação inválido ou não encontrado.");
        }
        const congregationId = congIdData.congregationId;

        // 1. Criar usuário no Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: name.trim() });
        
        // Força a atualização do token para garantir que as claims (como displayName) estejam presentes
        await userCredential.user.getIdToken(true);
        
        // 2. Chamar a função de backend para criar o perfil no Firestore
        await completeUserProfile({
            congregationId,
            whatsapp,
            name: name.trim(), // Enviando o nome para o backend
        });

        // 3. Notificar administradores (opcional)
        await notifyOnNewUser({ newUserName: name.trim(), congregationId });
      
        toast({
            title: 'Solicitação enviada!',
            description: 'Seu acesso agora precisa ser aprovado por um administrador.',
            variant: 'default',
        });
      
    } catch (err: any) {
      console.error("Erro detalhado no cadastro:", err);

      let message = err.message || "Ocorreu um erro desconhecido.";
      if (err.code === 'auth/email-already-in-use') { 
        setError(<>Este e-mail já está em uso. <Link href="/recuperar-senha" className="font-bold underline ml-1">Esqueceu a senha?</Link></>); 
      } else if (message.includes("congregationNumber") || message.includes("Congregação não encontrada")) {
          setError("Número da congregação inválido ou não encontrado.");
      } else if (err.code?.includes('functions/internal') || err.code?.includes('internal')) {
          setError("Ocorreu um erro ao criar o seu perfil no banco de dados. Tente novamente ou contate o suporte.");
      } else { 
          setError("Ocorreu um erro ao criar a conta: " + message); 
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
        await signInWithPopup(auth, provider);
        // O UserContext cuidará do redirecionamento
    } catch (error: any) {
        console.error("Erro no cadastro com Google:", error);
        setError("Não foi possível cadastrar com o Google.");
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
                Solicitar Acesso
            </h1>
        </div>
         <form onSubmit={handleSignUp} className="space-y-4">
            <input type="text" value={name} onChange={handleInputChange(setName)} placeholder="Nome Completo" required className="w-full px-4 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring" autoComplete="name" />
            <input type="email" value={email} onChange={handleInputChange(setEmail)} placeholder="E-mail" required className="w-full px-4 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring" autoComplete="email" />
            
            <input 
              type="tel" 
              value={whatsapp} 
              onChange={handleWhatsappChange(setWhatsapp)} 
              placeholder="Seu WhatsApp (Obrigatório)" required 
              className="w-full px-4 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring" 
              autoComplete="tel"
            />
            
            <input 
              type="tel" 
              value={confirmWhatsapp} 
              onChange={handleWhatsappChange(setConfirmWhatsapp)} 
              placeholder="Confirme seu WhatsApp" required 
              className="w-full px-4 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring" 
              autoComplete="tel"
            />

            <div className="relative">
              <input type={showPassword ? "text" : "password"} value={password} onChange={handleInputChange(setPassword)} placeholder="Senha (mín. 6 caracteres)" required className="w-full px-4 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring pr-10" autoComplete="new-password" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 px-3 flex items-center text-muted-foreground">
                {showPassword ? <EyeOff size={20}/> : <Eye size={20}/>}
              </button>
            </div>
            
            <div className="relative">
              <input type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={handleInputChange(setConfirmPassword)} placeholder="Confirme sua Senha" required className="w-full px-4 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring pr-10" autoComplete="new-password" />
              <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute inset-y-0 right-0 px-3 flex items-center text-muted-foreground">
                {showConfirmPassword ? <EyeOff size={20}/> : <Eye size={20}/>}
              </button>
            </div>

            <input type="tel" inputMode="numeric" value={congregationNumber} onChange={handleInputChange(setCongregationNumber)} placeholder="Número da Congregação" required className="w-full px-4 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring" />
            
            {error && <p className="text-destructive text-sm text-center">{error}</p>}
            <button type="submit" disabled={loading || googleLoading || !name || !email || whatsapp.length < 15 || password.length < 6 || password !== confirmPassword || whatsapp !== confirmWhatsapp} className="w-full px-4 py-2 font-semibold text-primary-foreground bg-primary rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-wait">
              {loading ? 'Enviando...' : 'Solicitar Acesso'}
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
            onClick={handleGoogleSignUp}
            disabled={loading || googleLoading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 font-semibold text-foreground bg-background border border-input rounded-md hover:bg-accent disabled:opacity-50"
        >
            {googleLoading ? 'Aguarde...' : (
                <>
                <svg className="w-5 h-5" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"></path><path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z"></path><path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"></path><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.021 35.596 44 30.138 44 24c0-1.341-.138-2.65-.389-3.917z"></path></svg>
                Cadastre-se com Google
                </>
            )}
        </button>

         <div className="text-center text-sm">
            <Link href="/" className="text-muted-foreground hover:text-primary">Já tem uma conta? Faça login</Link>
         </div>
      </div>
    </div>
  );
}
