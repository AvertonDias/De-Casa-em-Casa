"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, addDoc, setDoc, doc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';

export default function NewCongregationPage() {
  // Dados do Administrador
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Dados da Congregação
  const [congregationName, setCongregationName] = useState('');
  const [congregationNumber, setCongregationNumber] = useState('');

  // Estados de controle da UI
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (adminPassword !== confirmPassword) {
      setError("As senhas não coincidem.");
      setLoading(false);
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, adminEmail, adminPassword);
      const adminUser = userCredential.user;

      const congregationRef = await addDoc(collection(db, 'congregations'), {
        name: congregationName,
        number: congregationNumber,
      });
      const newCongregationId = congregationRef.id;

      await setDoc(doc(db, "users", adminUser.uid), {
        name: adminName,
        email: adminEmail,
        congregationId: newCongregationId,
        role: "Administrador",
        status: "ativo"
      });
      
      router.push('/dashboard');
    } catch (err: any) {
       if (err.code === 'auth/email-already-in-use') {
        setError("Este e-mail já está cadastrado.");
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
            <fieldset className="border border-gray-600 p-4 rounded-md">
                <legend className="px-2 text-lg font-semibold text-purple-400">Dados da Congregação</legend>
                <div className="space-y-4">
                    <input type="text" value={congregationName} onChange={e => setCongregationName(e.target.value)} placeholder="Nome da Congregação (Ex: Central)" required className="w-full px-4 py-2 text-white bg-[#1e1b29] border border-gray-600 rounded-md" />
                    <input type="tel" inputMode="numeric" value={congregationNumber} onChange={e => setCongregationNumber(e.target.value.replace(/\D/g, ''))} placeholder="Número da Congregação (Ex: 13607)" required className="w-full px-4 py-2 text-white bg-[#1e1b29] border border-gray-600 rounded-md" />
                </div>
            </fieldset>

            <fieldset className="border border-gray-600 p-4 rounded-md">
                <legend className="px-2 text-lg font-semibold text-purple-400">Seus Dados de Administrador</legend>
                <div className="space-y-4">
                    <input type="text" value={adminName} onChange={e => setAdminName(e.target.value)} placeholder="Seu Nome Completo" required className="w-full px-4 py-2 text-white bg-[#1e1b29] border border-gray-600 rounded-md" />
                    <input type="email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} placeholder="Seu E-mail" required className="w-full px-4 py-2 text-white bg-[#1e1b29] border border-gray-600 rounded-md" />

                    <div className="relative">
                        <input type={showPassword ? 'text' : 'password'} value={adminPassword} onChange={e => setAdminPassword(e.target.value)} placeholder="Sua Senha" required className="w-full px-4 py-2 text-white bg-[#1e1b29] border border-gray-600 rounded-md pr-10"/>
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 px-3 text-gray-400">
                           {showPassword ? <EyeOff size={20}/> : <Eye size={20}/>}
                        </button>
                    </div>

                    <div className="relative">
                        <input type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirme sua Senha" required className="w-full px-4 py-2 text-white bg-[#1e1b29] border border-gray-600 rounded-md pr-10"/>
                        <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute inset-y-0 right-0 px-3 text-gray-400">
                           {showConfirmPassword ? <EyeOff size={20}/> : <Eye size={20}/>}
                        </button>
                    </div>
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
