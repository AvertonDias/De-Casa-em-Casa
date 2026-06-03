
"use client";
import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Loader, Eye, EyeOff } from "lucide-react"; 
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth, functions } from '@/lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { maskPhone } from '@/lib/utils'; 
import { Footer } from '@/components/Footer';
import { TutorialButton } from '@/components/TutorialButton';
import { TUTORIAL_IDS } from '@/lib/tutorials';

export default function NovaCongregacaoPage() {
  const router = useRouter();
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

    if (adminPassword !== confirmPassword) { setErrorMessage("As senhas não coincidem."); return; }
    if (whatsapp !== confirmWhatsapp) { setErrorMessage("Os números de WhatsApp não coincidem."); return; }
    if (whatsapp.trim().length < 15) { setErrorMessage("Por favor, preencha o número de WhatsApp completo."); return; }
    
    setIsLoading(true);

    try {
        const createCong = httpsCallable(functions, 'createCongregationAndAdminV2');
        
        await createCong({
            adminName: adminName.trim(),
            adminEmail: adminEmail.trim().toLowerCase(),
            adminPassword: adminPassword,
            congregationName: congregationName.trim(),
            congregationNumber: congregationNumber.trim(),
            whatsapp: whatsapp
        });

        await signInWithEmailAndPassword(auth, adminEmail.trim().toLowerCase(), adminPassword);
        
        toast({ title: "Congregação Criada!", description: "Bem-vindo ao De Casa em Casa." });
        
    } catch (error: any) {
        console.error("Erro na criação:", error);
        let message = "Ocorreu um erro ao criar a congregação.";
        
        if (error.message?.includes('already-exists') || error.message?.includes('já existe')) {
            message = "Este número de congregação já está em uso.";
        } else if (error.code === 'auth/email-already-in-use' || error.message?.includes('email-already-exists')) {
            message = "Este e-mail já está cadastrado no sistema.";
        } else {
            message = error.message || message;
        }
        
        setErrorMessage(message);
    } finally {
        setIsLoading(false);
    }
  };

  const handleGoogleCreate = async () => {
    setErrorMessage('');
    setGoogleLoading(true);
    try {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        await signInWithPopup(auth, provider);
        // Após o login bem sucedido, força a ida para completar perfil em modo CREATE
        router.push('/completar-perfil?mode=create');
    } catch (error: any) {
      if (error.code !== 'auth/popup-closed-by-user') {
        console.error("Erro com Google:", error);
        setErrorMessage("Não foi possível autenticar com o Google.");
      }
    } finally {
        setGoogleLoading(false);
    }
  };
  
    return (
        <div className="flex flex-col min-h-screen bg-background">
            <div className="flex-grow flex items-center justify-center p-4">
                <div className="w-full max-w-sm p-8 space-y-6 bg-card text-card-foreground rounded-xl shadow-lg">
                    <div className="flex flex-col items-center">
                        <Image src="/images/Logo_v3.png" alt="Logo" width={80} height={80} className="mb-4 rounded-lg" priority />
                        <h1 className="text-3xl font-bold text-center">De Casa em Casa</h1>
                        <p className="text-muted-foreground text-sm mt-2 text-center">Crie uma nova congregação no sistema</p>
                        <TutorialButton 
                          videoId={TUTORIAL_IDS.REGISTER_CONGREGATION} 
                          label="Tutorial: Como criar congregação" 
                          className="mt-2"
                        />
                    </div>

                    <button onClick={handleGoogleCreate} disabled={isLoading || googleLoading} className="w-full flex items-center justify-center gap-2 px-4 py-2 font-semibold text-foreground bg-background border border-input rounded-md hover:bg-accent disabled:opacity-50 transition-colors">
                        {googleLoading ? <Loader className="animate-spin" /> : (<><svg className="w-5 h-5" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"></path><path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z"></path><path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"></path><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.021 35.596 44 30.138 44 24c0-1.341-.138-2.65-.389-3.917z"></path></svg>Criar com Google</>)}
                    </button>
    
                    <div className="relative"><div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div><div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">OU USE E-MAIL</span></div></div>

                    <form onSubmit={handleCreateCongregation} className="space-y-4">
                        <div className="space-y-4">
                            <div><Label htmlFor="congregationName">Nome da Congregação</Label><Input id="congregationName" value={congregationName} onChange={(e) => setCongregationName(e.target.value)} required placeholder="Ex: Central" /></div>
                            <div><Label htmlFor="congregationNumber">Número da Congregação</Label><Input id="congregationNumber" value={congregationNumber} onChange={(e) => setCongregationNumber(e.target.value.replace(/\D/g, ''))} required placeholder="Número oficial" /></div>
                        </div>

                        <div className="pt-4 border-t border-border space-y-4">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-primary">Dados do Administrador</h3>
                            <div><Label htmlFor="adminName">Seu nome completo</Label><Input id="adminName" value={adminName} onChange={(e) => setAdminName(e.target.value)} required placeholder="Como aparecerá no sistema" /></div>
                            <div><Label htmlFor="adminEmail">Seu e-mail</Label><Input id="adminEmail" type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} required placeholder="E-mail principal" /></div>
                            <div><Label htmlFor="whatsapp">Seu WhatsApp</Label><Input id="whatsapp" value={whatsapp} onChange={(e) => setWhatsapp(maskPhone(e.target.value))} required placeholder="(XX) XXXXX-XXXX" /></div>
                            <div><Label htmlFor="confirmWhatsapp">Confirme seu WhatsApp</Label><Input id="confirmWhatsapp" value={confirmWhatsapp} onChange={(e) => setConfirmWhatsapp(maskPhone(e.target.value))} required placeholder="(XX) XXXXX-XXXX" /></div>
                            
                            <div className="relative">
                                <Label htmlFor="adminPassword">Senha</Label>
                                <Input id="adminPassword" type={showPassword ? 'text' : 'password'} value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} required minLength={6} />
                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute bottom-2.5 right-3 text-muted-foreground">{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button>
                            </div>
                            
                            <div className="relative">
                                <Label htmlFor="confirmPassword">Confirmar Senha</Label>
                                <Input id="confirmPassword" type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} />
                                <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute bottom-2.5 right-3 text-muted-foreground">{showConfirmPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button>
                            </div>
                        </div>

                        {errorMessage && <div className="text-destructive text-sm text-center font-semibold bg-destructive/10 p-3 rounded-lg border border-destructive/20">{errorMessage}</div>}
                        
                        <Button type="submit" disabled={isLoading || googleLoading} className="w-full font-bold h-11">
                            {isLoading ? <><Loader className="mr-2 h-4 w-4 animate-spin" /> Criando...</> : "Criar Congregação"}
                        </Button>
                    </form>
                    
                    <div className="text-center text-sm">
                        <Link href="/" className="text-muted-foreground hover:text-primary underline underline-offset-4">Já tem uma conta? Faça login</Link>
                    </div>
                </div>
            </div>
            <Footer />
        </div>
    );
}
