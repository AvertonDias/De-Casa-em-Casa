"use client";

import { useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/contexts/UserContext';
import { db } from '@/lib/firebase';
import { useToast } from "@/hooks/use-toast";
import { maskPhone } from '@/lib/utils';
import Image from 'next/image';
import { LoadingScreen } from '@/components/LoadingScreen';
import withAuth from '@/components/withAuth';
import { doc, setDoc, serverTimestamp, collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { Footer } from '@/components/Footer';
import { Loader, Building2, LogOut } from 'lucide-react';
import { TutorialButton } from '@/components/TutorialButton';
import { TUTORIAL_IDS } from '@/lib/tutorials';
import { Button } from '@/components/ui/button';

function CompleteProfileContent() {
    const { user, loading: userLoading, logout } = useUser();
    const [congregationName, setCongregationName] = useState('');
    const [congregationNumber, setCongregationNumber] = useState('');
    const [whatsapp, setWhatsapp] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    
    const { toast } = useToast();
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        const cleanWhatsapp = whatsapp.trim();
        const cleanCongNumber = congregationNumber.trim().replace(/\D/g, '');

        if (cleanWhatsapp.length < 15) { setError("Por favor, preencha o número de WhatsApp completo."); return; }
        if (!user) { setError("Usuário não autenticado."); return; }
        if (!congregationName.trim()) { setError("O nome da congregação é obrigatório."); return; }

        setLoading(true);
        setError(null);

        try {
            // 1. Verificar se o número já existe
            const congQuery = query(collection(db, "congregations"), where("number", "==", cleanCongNumber));
            const congSnap = await getDocs(congQuery);
            
            if (!congSnap.empty) {
                throw new Error("Este número de congregação já está em uso. Por favor, escolha outro ou verifique se sua congregação já possui um cadastro.");
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
                defaultAssignmentMonths: 2,
                whatsappEnabled: true
            });
            const targetCongregationId = newCongRef.id;

            // 3. Atualizar Perfil do Usuário como Administrador Ativo
            const userDocRef = doc(db, "users", user.uid);
            await setDoc(userDocRef, {
                name: user.name,
                email: user.email.toLowerCase().trim(),
                whatsapp: cleanWhatsapp,
                congregationId: targetCongregationId,
                role: "Administrador",
                status: "ativo",
                createdAt: serverTimestamp(),
                lastSeen: serverTimestamp()
            }, { merge: true });
            
            toast({
                title: 'Congregação Criada!',
                description: 'Seu acesso de administrador está pronto.',
            });

            // O redirecionamento automático será feito pelo UserContext ao detectar o status 'ativo'
            
        } catch (err: any) {
            console.error("Erro ao criar congregação via Google:", err);
            setError(err.message || "Ocorreu um erro ao processar seu cadastro.");
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
                        <h1 className="text-2xl font-bold">Criar Minha Congregação</h1>
                        <p className="text-muted-foreground mt-2 text-sm">
                            Bem-vindo(a), <span className="font-semibold text-foreground">{user.name}</span>! <br/>
                            Complete os dados para fundar sua congregação no sistema.
                        </p>
                        <TutorialButton 
                          videoId={TUTORIAL_IDS.REGISTER_CONGREGATION} 
                          label="Tutorial: Criar congregação" 
                          className="mt-2"
                        />
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-4">
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
                                <p className="text-[9px] text-muted-foreground ml-1">Este número deve ser único no sistema.</p>
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
                        
                        <div className="space-y-2">
                            <button
                                type="submit"
                                disabled={loading || !whatsapp || !congregationNumber || !congregationName || whatsapp.length < 15}
                                className="w-full px-4 py-3 font-bold text-primary-foreground bg-primary rounded-md hover:bg-primary/90 disabled:opacity-50 shadow-md transition-all flex items-center justify-center gap-2"
                            >
                                {loading ? <Loader className="animate-spin" size={18}/> : <><Building2 size={18}/> Criar Congregação</>}
                            </button>

                            <Button 
                                type="button" 
                                variant="ghost" 
                                onClick={() => logout('/')} 
                                className="w-full text-muted-foreground hover:text-foreground"
                            >
                                <LogOut size={16} className="mr-2" /> Sair e Voltar ao Início
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
            <Footer />
        </div>
    );
}

function CompleteProfilePage() {
    return (
        <Suspense fallback={<LoadingScreen />}>
            <CompleteProfileContent />
        </Suspense>
    );
}

export default withAuth(CompleteProfilePage);