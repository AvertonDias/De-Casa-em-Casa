"use client";

import { useState, Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@/contexts/UserContext';
import { db, functions } from '@/lib/firebase';
import { useToast } from "@/hooks/use-toast";
import { maskPhone } from '@/lib/utils';
import Image from 'next/image';
import { LoadingScreen } from '@/components/LoadingScreen';
import withAuth from '@/components/withAuth';
import { doc, setDoc, serverTimestamp, collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { Footer } from '@/components/Footer';
import { Loader, Building2, LogOut, Users, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { TutorialButton } from '@/components/TutorialButton';
import { TUTORIAL_IDS } from '@/lib/tutorials';
import { Button } from '@/components/ui/button';
import { LgpdModal } from '@/components/LgpdModals';

type OnboardingMode = 'JOIN' | 'CREATE';

function CompleteProfileContent() {
    const { user, loading: userLoading, logout } = useUser();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();

    const [mode, setMode] = useState<OnboardingMode>('JOIN');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // LGPD
    const [acceptedLgpd, setAcceptedLgpd] = useState(false);
    const [highlightLgpdError, setHighlightLgpdError] = useState(false);
    const [isLgpdDetailOpen, setIsLgpdDetailOpen] = useState(false);
    const [lgpdModalType, setLgpdModalType] = useState<'terms' | 'privacy'>('terms');

    // Campos comum
    const [whatsapp, setWhatsapp] = useState('');

    // Campos Join
    const [congregationNumberJoin, setCongregationNumberJoin] = useState('');

    // Campos Create
    const [congregationName, setCongregationName] = useState('');
    const [congregationNumberCreate, setCongregationNumberCreate] = useState('');

    useEffect(() => {
        const initialMode = searchParams.get('mode');
        if (initialMode === 'create') setMode('CREATE');
        else setMode('JOIN');
    }, [searchParams]);

    const handleJoin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        
        const cleanWhatsapp = whatsapp.trim();
        const cleanCongNumber = congregationNumberJoin.trim().replace(/\D/g, '');

        if (cleanWhatsapp.length < 15) { setError("WhatsApp incompleto."); return; }
        if (!cleanCongNumber) { setError("O número da congregação é obrigatório."); return; }

        setLoading(true);
        setError(null);

        try {
            const getCongId = httpsCallable(functions, 'getCongregationIdByNumberV2');
            const result = await getCongId({ congregationNumber: cleanCongNumber });
            const { congregationId } = result.data as { congregationId: string };

            if (!congregationId) {
                throw new Error("Congregação não encontrada. Verifique o número digitado.");
            }

            const userDocRef = doc(db, "users", user.uid);
            await setDoc(userDocRef, {
                name: user.name,
                email: user.email.toLowerCase().trim(),
                whatsapp: cleanWhatsapp,
                congregationId: congregationId,
                role: "Publicador",
                status: "pendente",
                createdAt: serverTimestamp(),
                lastSeen: serverTimestamp(),
                acceptedLGPD: acceptedLgpd,
                acceptedLGPDAt: acceptedLgpd ? serverTimestamp() : null
            }, { merge: true });

            toast({
                title: 'Solicitação enviada!',
                description: 'Sua conta foi criada e aguarda aprovação.',
            });
            
            router.replace('/aguardando-aprovacao');

        } catch (err: any) {
            console.error("Erro ao entrar em congregação:", err);
            setError(err.message || "Falha ao processar solicitação.");
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        const cleanWhatsapp = whatsapp.trim();
        const cleanCongNumber = congregationNumberCreate.trim().replace(/\D/g, '');

        if (cleanWhatsapp.length < 15) { setError("WhatsApp incompleto."); return; }
        if (!congregationName.trim()) { setError("O nome da congregação é obrigatório."); return; }
        if (!cleanCongNumber) { setError("O número é obrigatório."); return; }

        setLoading(true);
        setError(null);

        try {
            const congQuery = query(collection(db, "congregations"), where("number", "==", cleanCongNumber));
            const congSnap = await getDocs(congQuery);
            if (!congSnap.empty) {
                const msg = "Este número de congregação já está em uso por outra congregação cadastrada. Se a sua congregação já existe no sistema, selecione a opção 'Entrar em uma Congregação'.";
                setError(msg);
                toast({
                    title: "Número em uso",
                    description: msg,
                    variant: "destructive"
                });
                setLoading(false);
                return;
            }

            const newCongRef = await addDoc(collection(db, "congregations"), {
                name: congregationName.trim(),
                number: cleanCongNumber,
                territoryCount: 0,
                ruralTerritoryCount: 0,
                totalQuadras: 0,
                totalHouses: 0,
                totalHousesDone: 0,
                createdAt: serverTimestamp(),
                lastUpdate: serverTimestamp(),
                defaultAssignmentMonths: 2,
                whatsappEnabled: true
            });

            const userDocRef = doc(db, "users", user.uid);
            await setDoc(userDocRef, {
                name: user.name,
                email: user.email.toLowerCase().trim(),
                whatsapp: cleanWhatsapp,
                congregationId: newCongRef.id,
                role: "Administrador",
                status: "ativo",
                createdAt: serverTimestamp(),
                lastSeen: serverTimestamp(),
                acceptedLGPD: acceptedLgpd,
                acceptedLGPDAt: acceptedLgpd ? serverTimestamp() : null
            }, { merge: true });

            toast({ title: 'Congregação Criada!', description: 'Você agora é o administrador.' });

        } catch (err: any) {
            console.error("Erro ao criar congregação:", err);
            setError(err.message || "Erro ao processar criação.");
        } finally {
            setLoading(false);
        }
    };

    if (userLoading || !user) return <LoadingScreen />;

    return (
        <div className="flex flex-col min-h-screen bg-background">
            <div className="flex-grow flex items-center justify-center p-4">
                <div className="w-full max-w-md p-8 space-y-6 bg-card text-card-foreground rounded-xl shadow-lg border border-border/50">
                    <div className="text-center space-y-1">
                        <Image src="/images/Logo_v3.png" alt="Logo" width={60} height={60} className="rounded-lg mb-4 mx-auto" priority />
                        <h1 className="text-2xl font-bold tracking-tight">
                            {mode === 'CREATE' ? 'Cadastrar Nova Congregação' : 'Solicitar Acesso à Congregação'}
                        </h1>
                        <p className="text-xs text-muted-foreground">
                            {mode === 'CREATE' 
                                ? `Olá, ${user.name.split(' ')[0]}! Preencha os dados abaixo para registrar sua nova congregação como Administrador.`
                                : `Olá, ${user.name.split(' ')[0]}! Preencha o número da sua congregação e seu WhatsApp para solicitar o acesso.`
                            }
                        </p>
                    </div>

                    {mode === 'JOIN' && (
                        <form onSubmit={handleJoin} className="space-y-4">
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] text-muted-foreground uppercase font-bold ml-1">Número da Congregação</label>
                                    <input 
                                        type="tel" 
                                        inputMode="numeric" 
                                        value={congregationNumberJoin} 
                                        onChange={e => setCongregationNumberJoin(e.target.value.replace(/\D/g, ''))}
                                        placeholder="Digite o número oficial" 
                                        required 
                                        className="w-full px-4 py-2 bg-background border border-input rounded-md focus:ring-2 focus:ring-primary outline-none text-sm"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] text-muted-foreground uppercase font-bold ml-1">Seu WhatsApp</label>
                                    <input 
                                        type="tel" 
                                        value={whatsapp} 
                                        onChange={e => setWhatsapp(maskPhone(e.target.value))}
                                        placeholder="(XX) XXXXX-XXXX" 
                                        required 
                                        className="w-full px-4 py-2 bg-background border border-input rounded-md focus:ring-2 focus:ring-primary outline-none text-sm"
                                    />
                                </div>

                                <div className={`flex items-start gap-2.5 p-2.5 select-none border rounded-lg transition-all ${
                                    highlightLgpdError 
                                        ? "border-destructive bg-destructive/10 ring-2 ring-destructive/30" 
                                        : "border-border/40 bg-muted/30"
                                }`}>
                                    <input 
                                        id="lgpd-checkbox-join" 
                                        type="checkbox" 
                                        checked={acceptedLgpd}
                                        onChange={(e) => {
                                            setAcceptedLgpd(e.target.checked);
                                            if (e.target.checked) setHighlightLgpdError(false);
                                        }}
                                        className="h-5 w-5 rounded border-border text-primary focus:ring-primary/50 shrink-0 cursor-pointer accent-primary mt-0.5"
                                    />
                                    <label htmlFor="lgpd-checkbox-join" className="text-xs cursor-pointer text-muted-foreground leading-snug">
                                        Declaro que li e aceito as regras da LGPD, incluindo os{' '}
                                        <button 
                                            type="button" 
                                            onClick={() => { setLgpdModalType('terms'); setIsLgpdDetailOpen(true); }}
                                            className="text-primary hover:underline font-bold"
                                        >
                                            Termos de Uso
                                        </button>{' '}
                                        e a{' '}
                                        <button 
                                            type="button" 
                                            onClick={() => { setLgpdModalType('privacy'); setIsLgpdDetailOpen(true); }}
                                            className="text-primary hover:underline font-bold"
                                        >
                                            Política de Privacidade
                                        </button>.
                                    </label>
                                </div>
                            </div>
                            <Button type="submit" disabled={loading || !whatsapp || !congregationNumberJoin} className="w-full font-bold h-11">
                                {loading ? <Loader className="animate-spin" /> : <><CheckCircle2 className="mr-2" size={18} /> Solicitar Acesso</>}
                            </Button>
                        </form>
                    )}

                    {mode === 'CREATE' && (
                        <form onSubmit={handleCreate} className="space-y-4">
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] text-muted-foreground uppercase font-bold ml-1">Nome da Congregação</label>
                                    <input 
                                        type="text" 
                                        value={congregationName} 
                                        onChange={e => setCongregationName(e.target.value)}
                                        placeholder="Ex: Central" 
                                        required 
                                        className="w-full px-4 py-2 bg-background border border-input rounded-md focus:ring-2 focus:ring-primary outline-none text-sm"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] text-muted-foreground uppercase font-bold ml-1">Número da Congregação</label>
                                    <input 
                                        type="tel" 
                                        inputMode="numeric" 
                                        value={congregationNumberCreate} 
                                        onChange={e => setCongregationNumberCreate(e.target.value.replace(/\D/g, ''))}
                                        placeholder="Número oficial" 
                                        required 
                                        className="w-full px-4 py-2 bg-background border border-input rounded-md focus:ring-2 focus:ring-primary outline-none text-sm"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] text-muted-foreground uppercase font-bold ml-1">Seu WhatsApp</label>
                                    <input 
                                        type="tel" 
                                        value={whatsapp} 
                                        onChange={e => setWhatsapp(maskPhone(e.target.value))}
                                        placeholder="(XX) XXXXX-XXXX" 
                                        required 
                                        className="w-full px-4 py-2 bg-background border border-input rounded-md focus:ring-2 focus:ring-primary outline-none text-sm"
                                    />
                                </div>

                                <div className={`flex items-start gap-2.5 p-2.5 select-none border rounded-lg transition-all ${
                                    highlightLgpdError 
                                        ? "border-destructive bg-destructive/10 ring-2 ring-destructive/30" 
                                        : "border-border/40 bg-muted/30"
                                }`}>
                                    <input 
                                        id="lgpd-checkbox-create" 
                                        type="checkbox" 
                                        checked={acceptedLgpd}
                                        onChange={(e) => {
                                            setAcceptedLgpd(e.target.checked);
                                            if (e.target.checked) setHighlightLgpdError(false);
                                        }}
                                        className="h-5 w-5 rounded border-border text-primary focus:ring-primary/50 shrink-0 cursor-pointer accent-primary mt-0.5"
                                    />
                                    <label htmlFor="lgpd-checkbox-create" className="text-xs cursor-pointer text-muted-foreground leading-snug">
                                        Declaro que li e aceito as regras da LGPD, incluindo os{' '}
                                        <button 
                                            type="button" 
                                            onClick={() => { setLgpdModalType('terms'); setIsLgpdDetailOpen(true); }}
                                            className="text-primary hover:underline font-bold"
                                        >
                                            Termos de Uso
                                        </button>{' '}
                                        e a{' '}
                                        <button 
                                            type="button" 
                                            onClick={() => { setLgpdModalType('privacy'); setIsLgpdDetailOpen(true); }}
                                            className="text-primary hover:underline font-bold"
                                        >
                                            Política de Privacidade
                                        </button>.
                                    </label>
                                </div>
                            </div>
                            <Button type="submit" disabled={loading || !whatsapp || !congregationNumberCreate || !congregationName} className="w-full font-bold h-11">
                                {loading ? <Loader className="animate-spin" /> : <><Building2 className="mr-2" size={18} /> Criar Congregação</>}
                            </Button>
                        </form>
                    )}

                    {error && (
                        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-xs font-medium text-center">
                            {error}
                        </div>
                    )}

                    <div className="pt-4 border-t border-border/50 space-y-2">
                        <Button variant="ghost" onClick={() => logout('/')} className="w-full text-muted-foreground hover:text-foreground">
                            <LogOut size={16} className="mr-2" /> Sair e Voltar ao Início
                        </Button>
                        <TutorialButton videoId={TUTORIAL_IDS.REGISTER} label="Precisa de ajuda?" className="w-full justify-center" />
                    </div>
                </div>
            </div>
            <Footer />

            <LgpdModal 
                isOpen={isLgpdDetailOpen} 
                onOpenChange={setIsLgpdDetailOpen} 
                type={lgpdModalType} 
            />
        </div>
    );
}

export default function CompleteProfilePage() {
    return (
        <Suspense fallback={<LoadingScreen />}>
            <CompleteProfileContent />
        </Suspense>
    );
}
