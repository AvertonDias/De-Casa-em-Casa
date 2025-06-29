"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';

export default function RequestAccessPage() {
    const router = useRouter();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [congregationCode, setCongregationCode] = useState('');
    
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleRequestAccess = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        if (password !== confirmPassword) {
            setError("As senhas não coincidem.");
            setIsLoading(false);
            return;
        }

        try {
            // 1. Encontrar a congregação pelo código
            const congregationsRef = collection(db, "congregations");
            const q = query(congregationsRef, where("code", "==", congregationCode.trim()));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                setError("Código da congregação inválido ou não encontrado.");
                setIsLoading(false);
                return;
            }
            const congregationDoc = querySnapshot.docs[0];
            const congregationId = congregationDoc.id;

            // 2. Criar o usuário na autenticação
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            
            // 3. Criar o documento do usuário com status 'pendente'
            await setDoc(doc(db, "users", userCredential.user.uid), {
                name: name,
                email: email,
                role: 'Publicador',
                status: 'pendente',
                congregationId: congregationId,
            });

            // 4. Redirecionar para a página de aguardando aprovação
            router.push('/aguardando-aprovacao');

        } catch (err: any) {
            if (err.code === 'auth/email-already-in-use') {
                setError('Este e-mail já está em uso.');
            } else {
                console.error("Erro ao solicitar acesso:", err);
                setError('Erro ao criar a conta. Verifique os dados e tente novamente.');
            }
        } finally {
            setIsLoading(false);
        }
    };
    
    const regularInputClasses = "w-full px-3 py-2 text-gray-800 dark:text-white bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md";

    return (
        <div className="flex items-center justify-center min-h-screen bg-white dark:bg-[#1e1b29]">
            <div className="w-full max-w-md p-8 space-y-6 bg-gray-50 dark:bg-[#2f2b3a] rounded-xl shadow-2xl">
                <div className="text-center">
                    <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Solicitar Acesso</h1>
                    <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-2">Peça o código da congregação a um administrador.</p>
                </div>
                
                <form onSubmit={handleRequestAccess} className="space-y-4">
                    <input type="text" placeholder="Seu Nome Completo" value={name} onChange={e => setName(e.target.value)} required className={regularInputClasses} />
                    <input type="email" placeholder="Seu Melhor E-mail" value={email} onChange={e => setEmail(e.target.value)} required className={regularInputClasses} />
                    <input type="tel" inputMode="numeric" pattern="[0-9]*" placeholder="Código da Congregação" value={congregationCode} onChange={e => setCongregationCode(e.target.value.replace(/\D/g, ''))} required className={regularInputClasses}/>

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

                    {error && <p className="text-sm text-center text-red-500">{error}</p>}
                    <button type="submit" disabled={isLoading} className="w-full px-4 py-2 font-semibold text-white bg-purple-600 rounded-md shadow-lg hover:bg-purple-700 disabled:bg-purple-800 disabled:cursor-not-allowed">
                        {isLoading ? 'Enviando Solicitação...' : 'Solicitar Acesso'}
                    </button>
                </form>

                <p className="text-center text-sm text-gray-600 dark:text-gray-400">
                    Já tem uma conta? <Link href="/login" className="font-medium text-purple-600 hover:underline">Faça login</Link>
                </p>
            </div>
        </div>
    );
}
