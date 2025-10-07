
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth'; 
import { collection, query, where, getDocs, setDoc, doc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { maskPhone } from '@/lib/utils'; // Importa a função de máscara

export default function SignUpPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [congregationNumber, setCongregationNumber] = useState('');
  const [whatsapp, setWhatsapp] = useState(''); // Novo estado para WhatsApp
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) { setError("As senhas não coincidem."); return; }
    if (password.length < 6) { setError("A senha precisa ter pelo menos 6 caracteres."); return; }
    
    setLoading(true);
    setError(null);
    
    try {
      const congregationsRef = collection(db, 'congregations');
      const q = query(congregationsRef, where("number", "==", congregationNumber.trim()));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        throw new Error("Número da congregação inválido ou não encontrado.");
      }
      const congregationId = querySnapshot.docs[0].id;
      
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      await updateProfile(userCredential.user, { displayName: name.trim() });
      
      await setDoc(doc(db, "users", userCredential.user.uid), {
        name: name.trim(), 
        email, 
        whatsapp, // Adicionado o WhatsApp aqui
        congregationId, 
        role: "Publicador", 
        status: "pendente"
      });

      toast({
        title: 'Solicitação enviada!',
        description: 'Seu acesso agora precisa ser aprovado por um administrador.',
        variant: 'default',
      });
      
      // O UserContext cuidará do redirecionamento para /aguardando-aprovacao

    } catch (err: any) {
      console.error("Erro detalhado no cadastro:", err);
      if (err.message?.includes("Número da congregação")) { setError(err.message); }
      else if (err.code === 'auth/email-already-in-use') { setError("Este e-mail já está em uso."); }
      else { setError("Ocorreu um erro ao criar a conta."); }
    } finally {
        setLoading(false);
    }
  };
  
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="w-full max-w-sm p-8 space-y-6 bg-card text-card-foreground rounded-xl shadow-lg">
        <h1 className="text-3xl font-bold text-center">Solicitar Acesso</h1>
         <form onSubmit={handleSignUp} className="space-y-4">
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Nome Completo" required className="w-full px-4 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring" />
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="E-mail" required className="w-full px-4 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring" />
            
            <input 
              type="tel" 
              value={whatsapp} 
              onChange={e => setWhatsapp(maskPhone(e.target.value))} 
              placeholder="Seu WhatsApp (Obrigatório)" required 
              className="w-full px-4 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring" 
            />

            <div className="relative">
              <input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="Senha (mín. 6 caracteres)" required className="w-full px-4 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring pr-10" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 px-3 flex items-center text-muted-foreground">
                {showPassword ? <EyeOff size={20}/> : <Eye size={20}/>}
              </button>
            </div>
            
            <div className="relative">
              <input type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirme sua Senha" required className="w-full px-4 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring pr-10" />
              <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute inset-y-0 right-0 px-3 flex items-center text-muted-foreground">
                {showConfirmPassword ? <EyeOff size={20}/> : <Eye size={20}/>}
              </button>
            </div>

            <input type="tel" inputMode="numeric" value={congregationNumber} onChange={e => setCongregationNumber(e.target.value.replace(/\D/g, ''))} placeholder="Número da Congregação" required className="w-full px-4 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring" />
            
            {error && <p className="text-destructive text-sm text-center">{error}</p>}
            <button type="submit" disabled={loading || !name || !email || !whatsapp || password.length < 6 || password !== confirmPassword} className="w-full px-4 py-2 font-semibold text-primary-foreground bg-primary rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-wait">
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
