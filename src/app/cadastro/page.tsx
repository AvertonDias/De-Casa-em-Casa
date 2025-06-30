"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, query, where, getDocs, setDoc, doc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import Link from 'next/link';

export default function SignUpPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const congregationsRef = collection(db, 'congregations');
      const q = query(congregationsRef, where("code", "==", inviteCode.trim()));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        throw new Error("Código da congregação inválido.");
      }
      
      const congregationDoc = querySnapshot.docs[0];
      const congregationId = congregationDoc.id;

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const newUser = userCredential.user;

      await setDoc(doc(db, "users", newUser.uid), {
        name: name,
        email: email,
        congregationId: congregationId,
        role: "Publicador",
        status: "pendente"
      });

      router.push('/aguardando-aprovacao');

    } catch (err: any) {
      if (err.message === "Código da congregação inválido.") {
        setError(err.message);
      } else if (err.code === 'auth/email-already-in-use') {
        setError("Este e-mail já está cadastrado.");
      } else {
        setError("Ocorreu um erro ao criar a conta.");
        console.error("Erro de cadastro:", err);
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
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Senha" required className="w-full px-4 py-2 text-white bg-[#1e1b29] border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500" />
            <input type="text" value={inviteCode} onChange={e => setInviteCode(e.target.value)} placeholder="Código da Congregação" required className="w-full px-4 py-2 text-white bg-[#1e1b29] border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500" />

            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <button type="submit" disabled={loading} className="w-full px-4 py-2 font-semibold text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:bg-gray-500">
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
