"use client";

import { useState, useEffect } from 'react';
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
import { Loader, Building2, UserPlus } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function CompleteProfilePage() {
    const { user, loading: userLoading } = useUser();
    const [mode, setMode] = useState<'join' | 'create'>('join');
    const [congregationName, setCongregationName] = useState('');
    const [congregationNumber, setCongregationNumber] = useState('');
    const [whatsapp, setWhatsapp] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    
    const { toast } = useToast();
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        const initialMode = searchParams?.get('mode');
        if (initialMode === 'create') {
            setMode('create');
        }
    }, [searchParams]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        const cleanWhatsapp = whatsapp.trim();
        const cleanCongNumber = congregationNumber.trim().replace(/\D/g, '');

        if (cleanWhatsapp.length < 15) { setError("Por favor, preencha o número de WhatsApp completo."); return; }
        if (!user) { setError("Usuário não autenticado."); return; }
        if (mode === 'create' && !congregationName.trim()) { setError("O nome da congregação é obrigatório."); return; }

        setLoading(true);
        setError(null);

        try {
            let targetCongregationId = '';

            if (mode === 'create') {
                // 1. Verificar se o número já existe
                const congQuery = query(collection(db, "congregations"), where("number", "==", cleanCongNumber));
                const congSnap = await getDocs(congQuery);
                
                if (!congSnap.empty) {
                    throw new Error("Este número de congregação já está em uso.");
                }

                // 2. Criar a congregação
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
                });
                targetCongregationId = newCongRef.id;
            } else {
                // Modo Join: Buscar ID pelo número
                const getCongId = httpsCallable(functions, 'getCongregationIdByNumberV2');
                const result = await getCongId({ congregationNumber: cleanCongNumber });
                const { congregationId } = result.data as { congregationId: string };

                if (!congregationId) {
                    throw new Error("Número da congregação não encontrado.");
                }
                targetCongregationId = congregationId;
            }

            // Atualizar Perfil do Usuário
            const userDocRef = doc(db, "users", user.uid);
            await setDoc(userDocRef, {
                name: user.name,
                email: user.email.toLowerCase().trim(),
                whatsapp: cleanWhatsapp,
                congregationId: targetCongregationId,
                role: mode === 'create' ? "Administrador" : "Publicador",
                status: mode === 'create' ? "ativo" : "pendente",
                createdAt: serverTimestamp(),
                lastSeen: serverTimestamp()
            }, { merge: true });
            
            toast({
                title: mode === 'create' ? 'Congregação Criada!' : 'Perfil completo!',
                description: mode === 'create' 
                    ? 'Seu acesso de administrador está pronto.' 
                    : 'Seu acesso agora precisa ser aprovado por um administrador.',
            });

            // Redirecionamento automático é feito pelo UserContext
            
        } catch (err: any) {
            console.error("Erro ao completar perfil:", err);
            let message = err.message || "Ocorreu um erro desconhecido.";
            
            if (message.includes("not-found") || message.includes("não encontrado")) {
              setError("Número da congregação não encontrado. Peça o número correto ao seu administrador.");
            } else { 
              setError(message); 
            }
        } finally {
            setLoading(false);
        }
    };

    if (userLoading || !user) {
        return <LoadingScreen />;
    }

    return (
        <div className="flex flex-col min-h-screen bg-background">
            <div className="flex-grow flex items-center justify-center p-4">
                <div className="w-full max-w-sm p-8 space-y-6 bg-card text-card-foreground rounded-xl shadow-lg border border-border/50">
                    <div className="text-center">
                        <Image
                            src="/images/Logo_v3.png"
                            alt="Logo De Casa em Casa"
                            width={80}
                            height={80}
                            className="rounded-lg mb-4 mx-auto"
                            priority
                        />
                        <h1 className="text-2xl font-bold">Complete seu Perfil</h1>
                        <p className="text-muted-foreground mt-2">
                            Bem-vindo(a), <span className="font-semibold text-foreground">{user.name}</span>!
                        </p>
                    </div>

                    <Tabs value={mode} onValueChange={(v) => setMode(v as any)} className="w-full">
                        <TabsList className="grid w-full grid-cols-2 mb-4">
                            <TabsTrigger value="join" className="flex items-center gap-2">
                                <UserPlus size={16} /> Entrar
                            </TabsTrigger>
                            <TabsTrigger value="create" className="flex items-center gap-2">
                                <Building2 size={16} /> Criar
                            </TabsTrigger>
                        </TabsList>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-4">
                                {mode === 'create' && (
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-muted-foreground uppercase font-bold ml-1">Nome da Congregação</label>
                                        <input
                                            type="text"
                                            value={congregationName}
                                            onChange={(e) => setCongregationName(e.target.value)}
                                            placeholder="Ex: Central"
                                            required
                                            className="w-full px-4 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                                        />
                                    </div>
                                )}

                                <div className="space-y-1">
                                    <label className="text-[10px] text-muted-foreground uppercase font-bold ml-1">Número da Congregação</label>
                                    <input
                                        type="tel"
                                        inputMode="numeric"
                                        value={congregationNumber}
                                        onChange={(e) => setCongregationNumber(e.target.value.replace(/\D/g, ''))}
                                        placeholder="Digite o número oficial"
                                        required
                                        className="w-full px-4 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] text-muted-foreground uppercase font-bold ml-1">Seu WhatsApp</label>
                                    <input
                                        type="tel"
                                        value={whatsapp}
                                        onChange={(e) => setWhatsapp(maskPhone(e.target.value))}
                                        placeholder="(XX) XXXXX-XXXX"
                                        required
                                        className="w-full px-4 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                                        autoComplete="tel"
                                    />
                                </div>
                            </div>
                            
                            {error && (
                                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-xs font-medium text-center">
                                    {error}
                                </div>
                            )}
                            
                            <button
                                type="submit"
                                disabled={loading || !whatsapp || !congregationNumber || whatsapp.length < 15 || (mode === 'create' && !congregationName)}
                                className="w-full px-4 py-3 font-bold text-primary-foreground bg-primary rounded-md hover:bg-primary/90 disabled:opacity-50 shadow-md transition-all"
                            >
                                {loading ? <Loader className="animate-spin inline mr-2" size={18}/> : mode === 'create' ? 'Criar Congregação' : 'Finalizar Cadastro'}
                            </button>
                        </form>
                    </Tabs>
                </div>
            </div>
            <Footer />
        </div>
    );
}

export default withAuth(CompleteProfilePage);