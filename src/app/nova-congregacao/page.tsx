"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword, signInAnonymously } from 'firebase/auth';
import { collection, addDoc, setDoc, doc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import Link from 'next/link';

export default function NewCongregationPage() {
  // Dados do Administrador
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  
  // Dados da Congregação
  const [congregationName, setCongregationName] = useState('');
  const [congregationNumber, setCongregationNumber] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Para permitir a criação inicial, usamos o login anônimo
  useEffect(() => {
    if (!auth.currentUser) {
      signInAnonymously(auth).catch(error => {
        console.error("Erro ao iniciar sessão anônima:", error);
        setError("Não foi possível conectar ao serviço de autenticação.");
      });
    }
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Passo 1: Criar a conta de autenticação para o Administrador
      const userCredential = await createUserWithEmailAndPassword(auth, adminEmail, adminPassword);
      const adminUser = userCredential.user;

      // Passo 2: Criar o documento da Congregação no Firestore
      const congregationRef = await addDoc(collection(db, 'congregations'), {
        name: congregationName,
        number: congregationNumber,
        code: congregationNumber // Usando o número como código para consistência com a página de cadastro
      });
      const newCongregationId = congregationRef.id;

      // Passo 3: Criar o documento do usuário Administrador, vinculando-o à nova congregação
      await setDoc(doc(db, "users", adminUser.uid), {
        name: adminName,
        email: adminEmail,
        congregationId: newCongregationId,
        role: "Administrador", // Papel principal
        status: "ativo"        // Já entra como ativo
      });
      
      // Passo 4: Levar o novo admin direto para o painel
      router.push('/dashboard');

    } catch (err: any) {
       if (err.code === 'auth/email-already-in-use') {
        setError("Este e-mail já está cadastrado em outra conta.");
      } else {
        setError("Ocorreu um erro ao criar a congregação.");
        console.error("Erro de criação:", err);
      }
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="flex items-center justify-center min-h-screen bg-[#1e1b29]">
      <div className="w-full max-w-lg p-8 space-y-6 bg-[#2f2b3a] rounded-xl shadow-lg">
        <div className="text-center">
            <h1 className="text-3xl font-bold text-white">Criar uma Nova Congregação</h1>
            <p className="text-gray-400 mt-2">Você será o administrador principal.</p>
        </div>
        <form onSubmit={handleCreate} className="space-y-6">
            {/* Seção de Dados da Congregação */}
            <fieldset className="border border-gray-600 p-4 rounded-md">
                <legend className="px-2 text-lg font-semibold text-purple-400">Dados da Congregação</legend>
                <div className="space-y-4">
                    <input type="text" value={congregationName} onChange={e => setCongregationName(e.target.value)} placeholder="Nome da Congregação (Ex: Central)" required className="w-full px-4 py-2 text-white bg-[#1e1b29] border border-gray-600 rounded-md" />
                    <input type="text" value={congregationNumber} onChange={e => setCongregationNumber(e.target.value)} placeholder="Número da Congregação (Ex: 13607)" required className="w-full px-4 py-2 text-white bg-[#1e1b29] border border-gray-600 rounded-md" />
                </div>
            </fieldset>

            {/* Seção de Dados do Administrador */}
            <fieldset className="border border-gray-600 p-4 rounded-md">
                <legend className="px-2 text-lg font-semibold text-purple-400">Seus Dados de Administrador</legend>
                <div className="space-y-4">
                    <input type="text" value={adminName} onChange={e => setAdminName(e.target.value)} placeholder="Seu Nome Completo" required className="w-full px-4 py-2 text-white bg-[#1e1b29] border border-gray-600 rounded-md" />
                    <input type="email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} placeholder="Seu E-mail" required className="w-full px-4 py-2 text-white bg-[#1e1b29] border border-gray-600 rounded-md" />
                    <input type="password" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} placeholder="Sua Senha" required className="w-full px-4 py-2 text-white bg-[#1e1b29] border border-gray-600 rounded-md" />
                </div>
            </fieldset>

            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <button type="submit" disabled={loading} className="w-full px-4 py-3 font-semibold text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:bg-gray-500">
                {loading ? 'Criando...' : 'Criar Congregação e Entrar'}
            </button>
        </form>
        <div className="text-center text-sm">
             <Link href="/" className="text-gray-400 hover:text-purple-400">Já tem uma congregação? Faça login</Link>
         </div>
      </div>
    </div>
  );
}
