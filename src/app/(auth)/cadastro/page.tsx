
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth'; 
import { functions } from '@/lib/firebase';
import { auth } from '@/lib/firebase';
import Link from 'next/link';
import Image from 'next/image';
import { Eye, EyeOff } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { maskPhone } from '@/lib/utils';
import { httpsCallable } from 'firebase/functions';

const getCongregationIdByNumber = httpsCallable(functions, 'getCongregationIdByNumberV2');
const notifyOnNewUser = httpsCallable(functions, 'notifyOnNewUserV2');
const completeUserProfile = httpsCallable(functions, 'completeUserProfileV2');

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
        const result = await getCongregationIdByNumber({ congregationNumber: congregationNumber.trim() });
        const data = result.data as { success: boolean, congregationId?: string, error?: { message: string } };

        if (!data.success || !data.congregationId) {
            throw new Error(data.error?.message || "Número da congregação inválido ou não encontrado.");
        }
        
        const congregationId = data.congregationId;

        // 1. Create the Auth user
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: name.trim() });
        
        // 2. Call backend to create Firestore document
        await completeUserProfile({
            congregationId,
            whatsapp,
        });
        
        // 3. Notify admins (optional)
        await notifyOnNewUser({ newUserName: name.trim(), congregationId });
      
        toast({
            title: 'Solicitação enviada!',
            description: 'Seu acesso agora precisa ser aprovado por um administrador.',
            variant: 'default',
        });
      
        // The UserContext will detect the logged in user and redirect automatically.
      
    } catch (err: any) {
      console.error("Erro detalhado no cadastro:", err);

      let message = err.message || "Ocorreu um erro desconhecido.";
      if (err.code === 'auth/email-already-in-use') { 
        setError(
            <>
              Este e-mail já está em uso. 
              <Link href="/recuperar-senha" className="font-bold underline ml-1">
                 Esqueceu a senha?
              </Link>
            </>
        ); 
      } else if (message.includes("Congregação não encontrada")) {
          setError("Número da congregação inválido ou não encontrado.");
      } else if (err.code === 'functions/internal' || err.code === 'internal') {
          setError("Ocorreu um erro ao criar o seu perfil no banco de dados. Tente novamente ou contate o suporte.");
      } else { 
          setError("Ocorreu um erro ao criar a conta: " + message); 
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
            <button type="submit" disabled={loading || !name || !email || whatsapp.length < 15 || password.length < 6 || password !== confirmPassword || whatsapp !== confirmWhatsapp} className="w-full px-4 py-2 font-semibold text-primary-foreground bg-primary rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-wait">
              {loading ? 'Enviando...' : 'Solicitar Acesso'}
            </button>
        </form>
         <div className="text-center text-sm">
            <Link href="/" className="text-muted-foreground hover:text-primary">Já tem uma conta? Faça login</Link>
         </div>
      </div>
    </div>
  );
}
