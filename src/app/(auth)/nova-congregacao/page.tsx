"use client";
import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Loader, Eye, EyeOff } from "lucide-react"; 
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { maskPhone } from '@/lib/utils'; 

const functionUrl = (name: string) => `https://southamerica-east1-appterritorios-e5bb5.cloudfunctions.net/${name}`;

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
  const [googleLoading, setGoogleLoading] = useState(false);
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

    const dataToSend = {
        adminName: adminName.trim(),
        adminEmail: adminEmail.trim(),
        adminPassword: adminPassword,
        whatsapp: whatsapp,
        congregationName: congregationName.trim(),
        congregationNumber: congregationNumber.trim()
    };

    try {
        const res = await fetch(functionUrl('createCongregationAndAdminV2'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: dataToSend })
        });
        const result = await res.json();
        
        if (!res.ok) {
            throw new Error(result.error?.message || `Ocorreu um erro desconhecido.`);
        }
        
        toast({ title: "Congregação Criada!", description: "Fazendo login automaticamente...", });
        await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
        // O UserProvider se encarregará do redirecionamento
        
    } catch (error: any) {
        console.error("Erro na criação ou login:", error);
        setErrorMessage(error.message || "Erro inesperado. Tente novamente mais tarde.");
    } finally {
        setIsLoading(false);
    }
  };

  const handleGoogleCreate = async () => {
    setErrorMessage('');
    setGoogleLoading(true);
    try {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({
          prompt: 'select_account'
        });
        await signInWithPopup(auth, provider);
        // O UserContext cuidará do redirecionamento para completar o perfil.
    } catch (error: any) {
      if (error.code !== 'auth/popup-closed-by-user') {
        console.error("Erro no cadastro com Google:", error);
        setErrorMessage("Não foi possível autenticar com o Google.");
      }
    } finally {
        setGoogleLoading(false);
    }
  };
  
    return (
        <div className="flex min-h-screen items-center justify-center bg-background">
            <div className="w-full max-w-sm p-8 space-y-6 bg-card text-card-foreground rounded-xl shadow-lg">
                <div className="flex flex-col items-center">
                    <Image src="/images/Logo_v3.png" alt="Logo" width={80} height={80} className="mb-4 rounded-lg" priority />
                    <h1 className="text-3xl font-bold text-center">De Casa em Casa</h1>
                    <p className="text-muted-foreground text-sm mt-2">Configure sua congregação e o primeiro administrador</p>
                </div>

                <button
                    onClick={handleGoogleCreate}
                    disabled={isLoading || googleLoading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 font-semibold text-foreground bg-background border border-input rounded-md hover:bg-accent disabled:opacity-50"
                >
                    {googleLoading ? 'Aguarde...' : (
                        <>
                        <svg className="w-5 h-5" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"></path><path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z"></path><path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"></path><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.021 35.596 44 30.138 44 24c0-1.341-.138-2.65-.389-3.917z"></path></svg>
                        Criar com Google
                        </>
                    )}
                </button>
  
                <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-card px-2 text-muted-foreground">OU</span>
                    </div>
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
  
                    <Button type="submit" disabled={isLoading || googleLoading || !adminEmail || !adminName || !congregationName || !congregationNumber || whatsapp.length < 15 || adminPassword.length < 6 || adminPassword !== confirmPassword || whatsapp !== confirmWhatsapp} className="w-full">
                        {isLoading ? <><Loader className="mr-2 h-4 w-4 animate-spin" /> Criando...</> : "Criar Congregação com E-mail"}
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
