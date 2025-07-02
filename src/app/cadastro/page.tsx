"use client";

import { useState, useEffect } from 'react';
import { signInAnonymously, linkWithCredential, EmailAuthProvider } from 'firebase/auth';
import { collection, query, where, getDocs, setDoc, doc } from 'firebase/firestore'; 
import { auth, db } from '@/lib/firebase';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

export default function SignUpPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [congregationNumber, setCongregationNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const initializeSession = async () => {
      if (auth.currentUser) {
        setIsReady(true);
        return;
      }
      try {
        await signInAnonymously(auth);
        setIsReady(true);
        console.log("Sessão anônima criada com sucesso.");
      } catch (err: any) {
        console.error("Erro CRÍTICO no login anônimo:", err);
        setError("Não foi possível conectar. Verifique sua conexão e tente recarregar.");
      }
    };
    
    initializeSession();

  }, []);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isReady) {
      setError("Aguarde a conexão ser estabelecida.");
      return;
    }
    
    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }
    
    if (password.length < 6) {
        setError("A senha deve ter pelo menos 6 caracteres.");
        return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const trimmedNumber = congregationNumber.trim();
      const congregationsRef = collection(db, 'congregations');
      const q = query(congregationsRef, where("number", "==", trimmedNumber));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        throw new Error("Número da congregação inválido ou não encontrado.");
      }
      
      const congregationId = querySnapshot.docs[0].id;
      
      const currentUser = auth.currentUser;
      if (!currentUser || !currentUser.isAnonymous) {
        // Tenta criar uma nova sessão anônima se a anterior foi perdida
        await signInAnonymously(auth);
        const newCurrentUser = auth.currentUser;
        if (!newCurrentUser) {
            throw new Error("Sessão de usuário inválida. Por favor, recarregue a página.");
        }
        const credential = EmailAuthProvider.credential(email, password);
        const userCredential = await linkWithCredential(newCurrentUser, credential);
        await setDoc(doc(db, "users", userCredential.user.uid), { name, email, congregationId, role: "Publicador", status: "pendente" });
      } else {
        const credential = EmailAuthProvider.credential(email, password);
        const userCredential = await linkWithCredential(currentUser, credential);
        await setDoc(doc(db, "users", userCredential.user.uid), { name, email, congregationId, role: "Publicador", status: "pendente" });
      }
      
      await auth.signOut();
      
      toast({
          title: "Solicitação Enviada!",
          description: "Faça o login com suas novas credenciais para verificar o status.",
          duration: 5000,
      });

      router.push('/');

    } catch (err: any) {
      if (err.message?.includes("Número da congregação") || err.message?.includes("Sessão de usuário")) {
        setError(err.message);
      } else if (err.code === 'auth/email-already-in-use') {
        setError("Este e-mail já está em uso por outra conta.");
      } else if (err.code === 'auth/credential-already-in-use') {
         setError("Erro: Esta conta já está vinculada. Tente fazer login.");
      } else if (err.code === 'auth/weak-password') {
         setError("A senha é muito fraca. Tente uma senha mais forte.");
      } else {
        console.error("Erro detalhado no cadastro:", err);
        setError("Ocorreu um erro ao criar a conta.");
      }
    } finally {
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
            <button type="submit" disabled={loading || !isReady} className="w-full px-4 py-2 font-semibold text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:bg-purple-900 disabled:cursor-wait">
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
