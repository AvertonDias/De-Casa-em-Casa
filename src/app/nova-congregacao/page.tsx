"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Loader } from "lucide-react"; // Adicione Loader se ainda não estiver

import { getFunctions, HttpsError, httpsCallable } from 'firebase/functions';
import { app } from '@/lib/firebase'; // Certifique-se de que 'app' está exportado de '@/lib/firebase'


export default function NovaCongregacaoPage() {
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [congregationName, setCongregationName] = useState('');
  const [congregationNumber, setCongregationNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const router = useRouter();
  const { toast } = useToast();

  const handleCreateCongregation = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    try {
        const createCongregationCloudFunction = httpsCallable(getFunctions(app, 'southamerica-east1'), 'createCongregationAndAdmin');

        const result = await createCongregationCloudFunction({
            adminName: adminName.trim(),
            adminEmail: adminEmail.trim(),
            adminPassword: adminPassword.trim(),
            congregationName: congregationName.trim(),
            congregationNumber: congregationNumber.trim()
        });
    
        const data = result.data as any; // Cast para any para acessar propriedades de sucesso ou erro
        
        if (data.success) {
            toast({ title: "Congregação Criada!", description: data.message || "Agora acesse o painel com seu novo usuário.", });
            router.push("/login");
        } else {
            console.error("Falha ao criar congregação:", data);
            setErrorMessage(data.error || "Falha ao criar congregação. Verifique os logs.");
        }
    } catch (error: any) {
        console.error("Erro na chamada da Cloud Function:", error);
        if (error instanceof HttpsError) {
            switch (error.code) {
                case 'already-exists': setErrorMessage("Este e-mail já está em uso."); break;
                case 'invalid-argument': setErrorMessage("Preencha todos os campos corretamente."); break;
                case 'permission-denied': setErrorMessage("Você não tem permissão para criar congregações."); break;
                default: setErrorMessage("Um erro interno ocorreu. Tente novamente mais tarde.");
            }
        } else {
            setErrorMessage("Erro inesperado ao criar congregação. Tente novamente mais tarde.");
        }
    } finally {
        setIsLoading(false);
    }
  };
  
    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-100 dark:bg-gray-900">
            <div className="w-full max-w-md p-8 space-y-6 bg-white dark:bg-card rounded-lg shadow-lg">
                <div className="flex flex-col items-center">
                    <Link href="/" className="flex items-center gap-2">
                        <Image src="/icon-192x192.png" alt="Logo" width={80} height={80} className="mb-4 rounded-lg" priority />
                        <span className="font-bold text-3xl">De Casa em Casa</span>
                    </Link>
                    <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">Configure sua congregação e o primeiro administrador</p>
                </div>
  
                <form onSubmit={handleCreateCongregation} className="space-y-4">
                    <div>
                        <Label htmlFor="congregationName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nome da Congregação</Label>
                        <Input type="text" id="congregationName" value={congregationName} onChange={(e) => setCongregationName(e.target.value)} required className="mt-1 dark:bg-input" />
                    </div>
                    <div>
                        <Label htmlFor="congregationNumber" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Número da Congregação</Label>
                        <Input type="number" id="congregationNumber" value={congregationNumber} onChange={(e) => setCongregationNumber(e.target.value)} required className="mt-1 dark:bg-input" />
                    </div>
  
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Dados do Administrador</h3>
                    <div>
                        <Label htmlFor="adminName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Seu nome completo</Label>
                        <Input type="text" id="adminName" value={adminName} onChange={(e) => setAdminName(e.target.value)} required className="mt-1 dark:bg-input" />
                    </div>
                    <div>
                        <Label htmlFor="adminEmail" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Seu e-mail</Label>
                        <Input type="email" id="adminEmail" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} required className="mt-1 dark:bg-input" />
                    </div>
                    <div>
                        <Label htmlFor="adminPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Senha (mínimo 6 caracteres)</Label>
                        <Input type="password" id="adminPassword" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} required minLength={6} className="mt-1 dark:bg-input" />
                    </div>
  
                    {errorMessage && (
                        <div className="text-red-500 text-sm mt-2">{errorMessage}</div>
                    )}
  
                    <Button
                        type="submit"
                        disabled={isLoading}
                        className="w-full"
                    >
                        {isLoading ? (
                            <>
                                <Loader className="mr-2 h-4 w-4 animate-spin" />
                                Criando...
                            </>
                        ) : (
                            "Criar Congregação"
                        )}
                    </Button>
                </form>
  
                <div className="text-center text-sm">
                    <Link href="/login" className="text-blue-600 dark:text-blue-400 hover:underline">
                        Já tem uma conta? Acesse o painel aqui
                    </Link>
                </div>
            </div>
        </div>
    );
}