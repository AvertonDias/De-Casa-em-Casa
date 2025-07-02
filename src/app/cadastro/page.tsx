"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword } from 'firebase/auth'; 
import { collection, query, where, getDocs, setDoc, doc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";


export default function SignUpPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [congregationNumber, setCongregationNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  // NENHUM useEffect é mais necessário aqui.

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) { setError("As senhas não coincidem."); return; }
    if (password.length < 6) { setError("A senha precisa ter pelo menos 6 caracteres."); return; }
    
    setLoading(true);
    setError(null);
    
    try {
      // 1. Validar o número da congregação (agora funciona por causa da regra)
      const congregationsRef = collection(db, 'congregations');
      const q = query(congregationsRef, where("number", "==", congregationNumber.trim()));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        throw new Error("Número da congregação inválido ou não encontrado.");
      }
      const congregationId = querySnapshot.docs[0].id;
      
      // 2. Criar a conta diretamente. Sem login anônimo, sem vinculação.
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const newUser = userCredential.user;
      
      // 3. Criar o perfil no Firestore
      await setDoc(doc(db, "users", newUser.uid), {
        name, email, congregationId, role: "Publicador", status: "pendente"
      });
      
      // 4. Redirecionar o usuário para o painel com recarregamento completo.
      // O usuário já está logado após a criação da conta.
      toast({
        title: 'Solicitação enviada!',
        description: 'Você será redirecionado para o painel.',
        variant: 'default',
      });

      // Um pequeno delay para o toast ser visível antes do redirecionamento
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 1500);
      

    } catch (err: any)
{
      console.error("Erro detalhado no cadastro:", err);
      if (err.message?.includes("Número da congregação")) { setError(err.message); }
      else if (err.code === 'auth/email-already-in-use') { setError("Este e-mail já está em uso."); }
      else { setError("Ocorreu um erro ao criar a conta."); }
      setLoading(false);
    }
  };
  
  return (
    <div className="flex items-center justify-center min-h-screen bg-[#1e1b29]">
      <div className="w-full max-w-sm p-8 space-y-6 bg-[#2f2b3a] rounded-xl shadow-lg">
        <h1 className="text-3xl font-bold text-center text-white">Solicitar Acesso</h1>
         <form onSubmit={handleSignUp} className="space-y-4">
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Nome Completo" required className="w-full px-4 py-2 text-white bg-[#1e1b29] border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500" />
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="E-mail" required className="w-full px-4 py-2 text-white bg-[#1e1b29] border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500" />
            
            <div className="relative">
              <input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="Senha (mín. 6 caracteres)" required className="w-full px-4 py-2 text-white bg-[#1e1b29] border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 pr-10" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400">
                {showPassword ? <EyeOff size={20}/> : <Eye size={20}/>}
              </button>
            </div>
            
            <div className="relative">
              <input type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirme sua Senha" required className="w-full px-4 py-2 text-white bg-[#1e1b29] border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 pr-10" />
              <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400">
                {showConfirmPassword ? <EyeOff size={20}/> : <Eye size={20}/>}
              </button>
            </div>

            <input type="tel" inputMode="numeric" value={congregationNumber} onChange={e => setCongregationNumber(e.target.value.replace(/\D/g, ''))} placeholder="Número da Congregação" required className="w-full px-4 py-2 text-white bg-[#1e1b29] border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500" />
            
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <button type="submit" disabled={loading} className="w-full px-4 py-2 font-semibold text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:bg-purple-900 disabled:cursor-wait">
              {loading ? 'Enviando...' : 'Solicitar Acesso'}
            </button>
        </form>
         <div className="text-center text-sm">
            <Link href="/" className="text-gray-400 hover:text-purple-400">Já tem uma conta? Faça login</Link>
         </div>
      </div>
    </div>
  );
}
