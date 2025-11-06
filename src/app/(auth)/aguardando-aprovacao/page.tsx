
"use client";

import { useState, useEffect } from 'react';
import { useUser } from "@/contexts/UserContext";
import { Loader, MailCheck, Users, MessageSquare } from "lucide-react";
import withAuth from "@/components/withAuth";
import { Button } from '@/components/ui/button';
import { collection, query, where, getDocs, or, and } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface Manager {
    uid: string;
    name: string;
    whatsapp?: string;
}

function AguardandoAprovacaoPage() {
    const { user, loading: userLoading, logout } = useUser();
    const [managers, setManagers] = useState<Manager[]>([]);
    const [loadingManagers, setLoadingManagers] = useState(true);

    useEffect(() => {
        if (user?.congregationId) {
            const fetchManagers = async () => {
                setLoadingManagers(true);
                try {
                    const usersRef = collection(db, 'users');
                    // Consulta corrigida para buscar todos os usuários da congregação
                    const q = query(usersRef, where("congregationId", "==", user.congregationId));
                    
                    const querySnapshot = await getDocs(q);

                    // Filtra localmente pelos perfis desejados
                    const fetchedManagers = querySnapshot.docs
                        .map(doc => ({ uid: doc.id, ...doc.data() }))
                        .filter(u => u.role === 'Administrador' || u.role === 'Dirigente')
                        .map(u => ({
                            uid: u.uid,
                            name: u.name,
                            whatsapp: u.whatsapp
                        }));

                    setManagers(fetchedManagers);
                } catch (error) {
                    console.error("Erro ao buscar administradores e dirigentes:", error);
                } finally {
                    setLoadingManagers(false);
                }
            };
            fetchManagers();
        } else if (!userLoading) {
            setLoadingManagers(false);
        }
    }, [user, userLoading]);

    if (userLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground">
                <Loader className="animate-spin text-primary" size={48} />
                <p className="mt-4">Carregando seus dados...</p>
            </div>
        );
    }

    const handleWhatsAppClick = (whatsapp: string | undefined) => {
        if (!whatsapp) return;
        const number = whatsapp.replace(/\D/g, '');
        const message = `Olá, sou ${user?.name}. Acabei de solicitar acesso ao aplicativo De Casa em Casa para a congregação ${user?.congregationName}. Você poderia aprovar meu acesso, por favor?`;
        const url = `https://wa.me/55${number}?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-background p-4">
            <div className="w-full max-w-lg p-8 space-y-6 bg-card text-card-foreground rounded-xl shadow-lg">
                <div className="text-center">
                    <MailCheck size={64} className="mx-auto text-primary" />
                    <h1 className="text-2xl font-bold mt-4">Solicitação Recebida!</h1>
                    <p className="text-muted-foreground mt-2">
                        Olá, <span className="font-semibold text-foreground">{user?.name}</span>!
                        Sua solicitação de acesso para a congregação <span className="font-semibold text-foreground">{user?.congregationName || '...'}</span> foi enviada.
                    </p>
                </div>

                <div className="pt-4 border-t border-border">
                    <h2 className="text-center text-lg font-semibold flex items-center justify-center gap-2">
                        <Users size={20} />
                        Avise um dos Dirigentes abaixo
                    </h2>
                    
                    {loadingManagers ? (
                         <div className="pt-4 text-center">
                            <Loader className="animate-spin mx-auto text-primary" />
                            <p className="text-sm text-muted-foreground mt-2">Buscando contatos...</p>
                        </div>
                    ) : managers.length > 0 ? (
                        <div className="space-y-2 mt-4">
                            {managers.map((manager) => (
                                <div key={manager.uid} className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
                                    <span className="font-medium">{manager.name}</span>
                                    {manager.whatsapp ? (
                                        <Button size="sm" variant="ghost" onClick={() => handleWhatsAppClick(manager.whatsapp)} className="text-green-500 hover:text-green-600 hover:bg-green-500/10">
                                            <MessageSquare size={16} className="mr-2" /> WhatsApp
                                        </Button>
                                    ) : (
                                        <span className="text-xs text-muted-foreground">Sem contato</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-center text-sm text-muted-foreground mt-4">
                            Nenhum contato de dirigente encontrado para esta congregação. Por favor, aguarde a aprovação.
                        </p>
                    )}
                </div>

                <div className="pt-4 border-t border-border">
                    <Button
                        onClick={logout}
                        variant="destructive"
                        className="w-full"
                    >
                        Sair
                    </Button>
                </div>
            </div>
        </div>
    );
}

export default withAuth(AguardandoAprovacaoPage);
