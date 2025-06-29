"use client";

import { Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, collection, addDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';

function SignupForm() {
    const searchParams = useSearchParams();
    const router = useRouter();

    const [name, setName] = useState(searchParams.get('name') || '');
    const [congregationNumber, setCongregationNumber] = useState(searchParams.get('number') || '');
    
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [congregationName, setCongregationName] = useState('');
    
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setError("As senhas não coincidem.");
            return;
        }
        setError(null);

        try {
            // Gera um código de convite aleatório de 6 dígitos
            const congregationCode = Math.random().toString().substring(2, 8);

            const newCongregationRef = await addDoc(collection(db, "congregations"), {
                name: congregationName,
                number: congregationNumber,
                code: congregationCode,
            });

            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            
            await setDoc(doc(db, "users", userCredential.user.uid), {
                name: name,
                email: email,
                role: 'Administrador',
                congregationId: newCongregationRef.id,
                status: 'ativo' // Administrador é ativo por padrão
            });

            router.push('/dashboard');
        } catch (err: any) {
            if (err.code === 'auth/email-already-in-use') {
                setError('Este e-mail já está em uso.');
            } else {
                console.error("Erro detalhado no cadastro:", err);
                setError('Erro ao criar a conta. Verifique os dados.');
            }
        }
    };
    
    const readOnlyInputClasses = "w-full px-3 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 border border-gray-300 dark:border-gray-700 rounded-md cursor-not-allowed";
    const regularInputClasses = "w-full px-3 py-2 text-gray-800 dark:text-white bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md";

    return (
        <div className="flex items-center justify-center min-h-screen bg-white dark:bg-[#1e1b29]">
            <div className="w-full max-w-md p-8 space-y-6 bg-gray-50 dark:bg-[#2f2b3a] rounded-xl shadow-2xl">
                <div className="text-center">
                    <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Criar Nova Congregação</h1>
                    <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-2">Você está prestes a criar uma nova congregação e se tornará o administrador dela.</p>
                </div>
                
                <form onSubmit={handleSignup} className="space-y-4">
                    <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
                        <h2 className="font-semibold text-gray-700 dark:text-gray-300">Dados da Congregação</h2>
                        <div className="mt-2 space-y-4">
                            <input type="tel" placeholder="Número da Congregação" value={congregationNumber} onChange={e => setCongregationNumber(e.target.value.replace(/\D/g, ''))} readOnly className={readOnlyInputClasses} />
                            <input type="text" placeholder="Nome da Congregação" value={congregationName} onChange={e => setCongregationName(e.target.value)} required className={regularInputClasses} />
                        </div>
                    </div>
                    
                    <div className="pt-4">
                        <h2 className="font-semibold text-gray-700 dark:text-gray-300">Seus Dados de Administrador</h2>
                        <div className="mt-2 space-y-4">
                            <input type="text" placeholder="Seu Nome Completo" value={name} onChange={() => {}} readOnly className={readOnlyInputClasses} />
                            <input type="email" placeholder="Seu Melhor E-mail" value={email} onChange={e => setEmail(e.target.value)} required className={regularInputClasses} />
                            
                            <div className="relative">
                                <input type={showPassword ? "text" : "password"} placeholder="Crie uma Senha (mínimo 6 caracteres)" value={password} onChange={e => setPassword(e.target.value)} required className={`${regularInputClasses} pr-10`} />
                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 dark:text-gray-400">
                                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                </button>
                            </div>

                            <div className="relative">
                                <input type={showConfirmPassword ? "text" : "password"} placeholder="Confirme sua Senha" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required className={`${regularInputClasses} pr-10`} />
                                <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 dark:text-gray-400">
                                    {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                </button>
                            </div>
                        </div>
                    </div>

                    {error && <p className="text-sm text-center text-red-500">{error}</p>}
                    <button type="submit" className="w-full px-4 py-2 font-semibold text-white bg-purple-600 rounded-md shadow-lg hover:bg-purple-700">Criar Conta</button>
                </form>

                <p className="text-center text-sm text-gray-600 dark:text-gray-400">
                    Sua congregação já existe? <Link href="/" className="font-medium text-purple-600 hover:underline">Volte para a página inicial</Link>
                </p>
            </div>
        </div>
    );
}

export default function SignupPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen bg-white dark:bg-[#1e1b29] text-gray-800 dark:text-white">Carregando...</div>}>
            <SignupForm />
        </Suspense>
    );
}
