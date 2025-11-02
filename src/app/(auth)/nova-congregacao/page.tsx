
"use client";
import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Loader, Eye, EyeOff } from "lucide-react"; 
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, app } from '@/lib/firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { maskPhone } from '@/lib/utils'; 

const functions = getFunctions(app, 'southamerica-east1');
const createCongregationAndAdminFn = httpsCallable(functions, 'createCongregationAndAdminFn');


export default function NovaCongregacaoPage() {
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [congregationName, setCongregationName] = useState('');
  const [congregationNumber, setCongregationNumber] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [confirmWhatsapp, setConfirmWhatsapp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { toast } = useToast();

  const handleCreateCongregation = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (adminPassword !== confirmPassword) {
      setErrorMessage("As senhas não coincidem.");
      return;
    }
    if (whatsapp !== confirmWhatsapp) {
      setErrorMessage("Os números de WhatsApp não coincidem.");
      return;
    }
    if (whatsapp.trim().length < 15) {
      setErrorMessage("Por favor, preencha o número de WhatsApp completo.");
      return;
    }
    
    setIsLoading(true);

    try {
        const dataToSend = {
            adminName: adminName.trim(),
            adminEmail: adminEmail.trim(),
            adminPassword: adminPassword,
            whatsapp: whatsapp,
            congregationName: congregationName.trim(),
            congregationNumber: congregationNumber.trim()
        };
        
        const result: any = await createCongregationAndAdminFn(dataToSend);
        
        const resultData = result.data as { success: boolean, userId?: string, message?: string, error?: string };

        if (resultData.success) {
            toast({ title: "Congregação Criada!", description: "Fazendo login automaticamente...", });
            await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
        } else {
            throw new Error(resultData.error || "Ocorreu um erro desconhecido.");
        }

    } catch (error: any) {
        console.error("Erro na criação ou login:", error);
        setErrorMessage(error.message || "Erro inesperado. Tente novamente mais tarde.");
    } finally {
        setIsLoading(false);
    }
  };
  
    return (
        <div className="flex min-h-screen items-center justify-center bg-background">
            <div className="w-full max-w-sm p-8 space-y-6 bg-card text-card-foreground rounded-xl shadow-lg">
                <div className="flex flex-col items-center">
                    <Image src="/icon-192x192.jpg" alt="Logo" width={80} height={80} className="mb-4 rounded-lg" priority />
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
                        <Input
                            type="tel"
                            inputMode="numeric"
                            id="congregationNumber"
                            value={congregationNumber}
                            onChange={(e) => setCongregationNumber(e.target.value.replace(/\D/g, ''))}
                            required
                            className="mt-1"
                            placeholder="Apenas números"
                        />
                    </div>
  
                    <h3 className="text-lg font-semibold border-t border-border pt-4">Seus Dados</h3>
                    <div>
                        <Label htmlFor="adminName">Seu nome completo</Label>
                        <Input type="text" id="adminName" value={adminName} onChange={(e) => setAdminName(e.target.value)} required className="mt-1" autoComplete="name" />
                    </div>
                    <div>
                        <Label htmlFor="adminEmail">Seu e-mail</Label>
                        <Input type="email" id="adminEmail" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} required className="mt-1" autoComplete="email" />
                    </div>
                    <div>
                        <Label htmlFor="whatsapp">Seu WhatsApp</Label>
                        <Input 
                            type="tel" 
                            id="whatsapp" 
                            value={whatsapp} 
                            onChange={(e) => setWhatsapp(maskPhone(e.target.value))} 
                            required 
                            className="mt-1"
                            placeholder="(XX) XXXXX-XXXX"
                            autoComplete="tel"
                        />
                    </div>
                     <div>
                        <Label htmlFor="confirmWhatsapp">Confirme seu WhatsApp</Label>
                        <Input 
                            type="tel" 
                            id="confirmWhatsapp" 
                            value={confirmWhatsapp} 
                            onChange={(e) => setConfirmWhatsapp(maskPhone(e.target.value))} 
                            required 
                            className="mt-1"
                            placeholder="(XX) XXXXX-XXXX"
                            autoComplete="tel"
                        />
                    </div>
                    <div className="relative">
                        <Label htmlFor="adminPassword">Senha (mínimo 6 caracteres)</Label>
                        <Input type={showPassword ? 'text' : 'password'} id="adminPassword" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} required minLength={6} className="mt-1 pr-10" autoComplete="new-password" />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute bottom-2 right-3 text-muted-foreground">
                            {showPassword ? <EyeOff size={20}/> : <Eye size={20}/>}
                        </button>
                    </div>
                     <div className="relative">
                        <Label htmlFor="confirmPassword">Confirmar Senha</Label>
                        <Input type={showConfirmPassword ? 'text' : 'password'} id="confirmPassword" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} className="mt-1 pr-10" autoComplete="new-password" />
                        <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute bottom-2 right-3 text-muted-foreground">
                            {showConfirmPassword ? <EyeOff size={20}/> : <Eye size={20}/>}
                        </button>
                    </div>
  
                    {errorMessage && (
                        <div className="text-destructive text-sm text-center">{errorMessage}</div>
                    )}
  
                    <Button type="submit" disabled={isLoading || !adminEmail || !adminName || !congregationName || !congregationNumber || whatsapp.length < 15 || adminPassword.length < 6 || adminPassword !== confirmPassword || whatsapp !== confirmWhatsapp} className="w-full">
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
