"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Loader, Eye, EyeOff } from "lucide-react"; 
import { functions } from '@/lib/firebase';
import { httpsCallable } from 'firebase/functions';


export default function NovaCongregacaoPage() {
    const [adminName, setAdminName] = useState('');
    const [adminEmail, setAdminEmail] = useState('');
    const [adminPassword, setAdminPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [congregationName, setCongregationName] = useState('');
    const [congregationNumber, setCongregationNumber] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const router = useRouter();
    const { toast } = useToast();

    const handleCreateCongregation = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (adminPassword !== confirmPassword) {
            setErrorMessage("As senhas não coincidem.");
            return;
        }
        
        setIsLoading(true);
        setErrorMessage('');

        try {
            const createCongregationCloudFunction = httpsCallable(functions, 'createCongregationAndAdmin');

            const result = await createCongregationCloudFunction({
                adminName: adminName.trim(),
                adminEmail: adminEmail.trim(),
                adminPassword: adminPassword,
                congregationName: congregationName.trim(),
                congregationNumber: congregationNumber.trim()
            });
    
            const data = result.data as any;
            
            if (data.success) {
                toast({ title: "Congregação Criada!", description: data.message || "Agora acesse o painel com seu novo usuário.", });
                router.push("/");
            } else {
                setErrorMessage(data.error || "Falha ao criar congregação.");
            }
        } catch (error: any) {
            console.error("Erro na chamada da Cloud Function:", error);
            if (error.code) { 
                switch (error.code) {
                    case 'functions/already-exists': setErrorMessage("Este e-mail já está em uso."); break;
                    case 'functions/invalid-argument': setErrorMessage("Preencha todos os campos corretamente."); break;
                    case 'functions/permission-denied': setErrorMessage("Você não tem permissão para criar congregações."); break;
                    case 'functions/internal': setErrorMessage("Um erro interno do servidor ocorreu. Tente novamente mais tarde."); break;
                    default: setErrorMessage(error.message);
                }
            } else {
                setErrorMessage("Erro inesperado ao criar congregação. Tente novamente mais tarde.");
            }
        } finally {
            setIsLoading(false);
        }
    };
  
    return (
        <div className="flex min-h-screen items-center justify-center bg-background">
            <div className="w-full max-w-sm p-8 space-y-6 bg-card text-card-foreground rounded-xl shadow-lg">
                <div className="flex flex-col items-center">
                    <Image src="/icon-192x192.png" alt="Logo" width={80} height={80} className="mb-4 rounded-lg" priority />
                    <h1 className="text-3xl font-bold text-center">De Casa em Casa</h1>
                    <p className="text-muted-foreground text-sm mt-2">Configure sua congregação e o primeiro administrador</p>
                </div>
  
                <form onSubmit={handleCreateCongregation} className="space-y-4">
                    <div>
                        <Label htmlFor="congregationName">Nome da Congregação</Label>
                        <Input type="text" id="congregationName" value={congregationName} onChange={(e) => setCongregationName(e.target.value)} required className="mt-1" />
                    </div>
                    <div>
                        <Label htmlFor="congregationNumber">Número da Congregação</Label>
                        <Input type="text" id="congregationNumber" value={congregationNumber} onChange={(e) => setCongregationNumber(e.target.value.replace(/\D/g, ''))} required className="mt-1" placeholder="Apenas números" />
                    </div>
  
                    <h3 className="text-lg font-semibold border-t border-border pt-4">Seus Dados</h3>
                    <div>
                        <Label htmlFor="adminName">Seu nome completo</Label>
                        <Input type="text" id="adminName" value={adminName} onChange={(e) => setAdminName(e.target.value)} required className="mt-1" />
                    </div>
                    <div>
                        <Label htmlFor="adminEmail">Seu e-mail</Label>
                        <Input type="email" id="adminEmail" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} required className="mt-1" />
                    </div>
                    <div className="relative">
                        <Label htmlFor="adminPassword">Senha (mínimo 6 caracteres)</Label>
                        <Input type={showPassword ? "text" : "password"} id="adminPassword" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} required minLength={6} className="mt-1 pr-10" />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute bottom-2 right-2 text-muted-foreground">
                            {showPassword ? <EyeOff size={20}/> : <Eye size={20}/>}
                        </button>
                    </div>
                     <div className="relative">
                        <Label htmlFor="confirmPassword">Confirmar Senha</Label>
                        <Input type={showConfirmPassword ? "text" : "password"} id="confirmPassword" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} className="mt-1 pr-10" />
                         <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute bottom-2 right-2 text-muted-foreground">
                            {showConfirmPassword ? <EyeOff size={20}/> : <Eye size={20}/>}
                        </button>
                    </div>
  
                    {errorMessage && (
                        <div className="text-destructive text-sm text-center">{errorMessage}</div>
                    )}
  
                    <Button type="submit" disabled={isLoading} className="w-full">
                        {isLoading ? <><Loader className="mr-2 h-4 w-4 animate-spin" /> Criando...</> : "Criar Congregação"}
                    </Button>
                </form>
  
                <div className="text-center text-sm">
                    <Link href="/" className="text-muted-foreground hover:text-primary">
                        Já tem uma conta? Faça login
                    </Link>
                </div>
            </div>
        </div>
    );
}
