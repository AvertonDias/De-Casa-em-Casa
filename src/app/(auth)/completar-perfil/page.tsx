"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/contexts/UserContext';
import { auth, functions } from '@/lib/firebase';
import { useToast } from "@/hooks/use-toast";
import { maskPhone } from '@/lib/utils';
import Image from 'next/image';
import { LoadingScreen } from '@/components/LoadingScreen';
import withAuth from '@/components/withAuth';
import { httpsCallable } from 'firebase/functions';
import { Footer } from '@/components/Footer';

const getCongregationIdByNumber = httpsCallable(functions, 'getCongregationIdByNumberV2');
const completeUserProfile = httpsCallable(functions, 'completeUserProfileV2');

function CompleteProfilePage() {
    const { user, loading: userLoading } = useUser();
    const [congregationNumber, setCongregationNumber] = useState('');
    const [whatsapp, setWhatsapp] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (whatsapp.length < 15) { setError("Por favor, preencha o número de WhatsApp completo."); return; }
        if (!user) { setError("Usuário não autenticado."); return; }

        setLoading(true);
        setError(null);

        try {
            const congIdRes: any = await getCongregationIdByNumber({ congregationNumber: congregationNumber.trim() });
            const congIdData = congIdRes.data;

            if (!congIdData.success) {
                throw new Error(congIdData.message || "Número da congregação inválido ou não encontrado.");
            }
            const congregationId = congIdData.congregationId;

            await auth.currentUser?.getIdToken(true);

            await completeUserProfile({ congregationId, whatsapp });
            
            toast({
                title: 'Perfil completo!',
                description: 'Seu acesso agora precisa ser aprovado por um administrador.',
                variant: 'default',
            });
            
            // O UserContext irá lidar com o redirecionamento para /aguardando-aprovacao

        } catch (err: any) {
            console.error("Erro ao completar perfil:", err);
            let message = err.message || "Ocorreu um erro desconhecido.";
            if (message.includes("congregationNumber") || message.includes("Congregação não encontrada")) {
              setError("Número da congregação inválido ou não encontrado.");
            } else { 
              setError("Ocorreu um erro ao salvar seu perfil: " + message); 
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
                <div className="w-full max-w-sm p-8 space-y-6 bg-card text-card-foreground rounded-xl shadow-lg">
                    <div className="text-center">
                        <Image
                            src="/images/Logo_v3.png"
                            alt="Logo Casa em Casa"
                            width={80}
                            height={80}
                            className="rounded-lg mb-4 mx-auto"
                            priority
                        />
                        <h1 className="text-2xl font-bold">Complete seu Perfil</h1>
                        <p className="text-muted-foreground mt-2">
                            Bem-vindo(a), <span className="font-semibold text-foreground">{user.name}</span>!
                            Faltam só mais alguns dados para finalizar seu cadastro.
                        </p>
                    </div>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <input
                            type="tel"
                            value={whatsapp}
                            onChange={(e) => setWhatsapp(maskPhone(e.target.value))}
                            placeholder="Seu WhatsApp (Obrigatório)"
                            required
                            className="w-full px-4 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                            autoComplete="tel"
                        />
                        <input
                            type="tel"
                            inputMode="numeric"
                            value={congregationNumber}
                            onChange={(e) => setCongregationNumber(e.target.value)}
                            placeholder="Número da Congregação"
                            required
                            className="w-full px-4 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                        
                        {error && <p className="text-destructive text-sm text-center">{error}</p>}
                        
                        <button
                            type="submit"
                            disabled={loading || !whatsapp || !congregationNumber}
                            className="w-full px-4 py-2 font-semibold text-primary-foreground bg-primary rounded-md hover:bg-primary/90 disabled:opacity-50"
                        >
                            {loading ? 'Salvando...' : 'Finalizar Cadastro'}
                        </button>
                    </form>
                </div>
            </div>
            <Footer />
        </div>
    );
}

export default withAuth(CompleteProfilePage);
