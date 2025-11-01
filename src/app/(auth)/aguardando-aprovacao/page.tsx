
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useUser } from "@/contexts/UserContext";
import { Loader, MailCheck, MessageCircle } from "lucide-react";
import withAuth from "@/components/withAuth";
import { AppUser } from '@/types/types';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from '@/components/ui/button';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app, auth } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';

const functions = getFunctions(app, 'southamerica-east1');
const getManagersForNotification = httpsCallable(functions, 'getManagersForNotification');


function AguardandoAprovacaoPage() {
    const { user, loading, logout } = useUser();
    const { toast } = useToast();
    const [adminsAndLeaders, setAdminsAndLeaders] = useState<AppUser[]>([]);
    const [isLoadingContacts, setIsLoadingContacts] = useState(true);

    const fetchAdminsAndLeaders = useCallback(async () => {
        if (!user?.congregationId) return;
        setIsLoadingContacts(true);
        try {
            const idToken = await auth.currentUser?.getIdToken();
            const response = await fetch("https://southamerica-east1-appterritorios-e5bb5.cloudfunctions.net/getManagersForNotification", {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`
                },
                body: JSON.stringify({ data: { congregationId: user.congregationId } })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Falha ao buscar contatos.');
            }

            const result = await response.json();
            
            if (result.success) {
                setAdminsAndLeaders(result.data.managers);
            } else {
                throw new Error(result.error || "Falha ao buscar contatos.");
            }
        } catch (error: any) {
            console.error("Erro ao buscar administradores e dirigentes:", error);
            toast({
                title: "Erro ao buscar contatos",
                description: "Não foi possível carregar a lista de responsáveis. Verifique sua conexão ou tente mais tarde.",
                variant: "destructive"
            });
        } finally {
            setIsLoadingContacts(false);
        }
    }, [user?.congregationId, toast]);


    useEffect(() => {
        if (user?.congregationId) {
            fetchAdminsAndLeaders();
        }
    }, [user?.congregationId, fetchAdminsAndLeaders]);

    const handleNotify = (contact: AppUser) => {
        if (!user || !contact.whatsapp) return;
        
        const contactFirstName = contact.name.split(' ')[0];
        const userFirstName = user.name.split(' ')[0];

        const message = `Olá, ${contactFirstName}. O publicador "${userFirstName}" está aguardando aprovação de acesso no aplicativo De Casa em Casa.`;
        const whatsappNumber = contact.whatsapp.replace(/\D/g, ''); // Remove caracteres não numéricos
        const whatsappUrl = `https://wa.me/55${whatsappNumber}?text=${encodeURIComponent(message)}`;

        window.open(whatsappUrl, '_blank');
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground">
                <Loader className="animate-spin text-primary" size={48} />
                <p className="mt-4">Carregando seus dados...</p>
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-background p-4">
            <div className="w-full max-w-lg p-8 space-y-6 bg-card text-card-foreground rounded-xl shadow-lg text-center">
                <MailCheck size={64} className="mx-auto text-primary" />
                <h1 className="text-2xl font-bold">Solicitação Recebida!</h1>
                <p className="text-muted-foreground">
                    Olá, <span className="font-semibold text-foreground">{user?.name}</span>!
                    Sua solicitação de acesso para a congregação <span className="font-semibold text-foreground">{user?.congregationName || '...'}</span> foi enviada.
                </p>
                <p className="text-muted-foreground">
                    Para agilizar, você pode notificar um dos dirigentes abaixo.
                </p>

                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="item-1">
                    <AccordionTrigger className="font-semibold">Notificar um responsável</AccordionTrigger>
                    <AccordionContent>
                      {isLoadingContacts ? (
                        <Loader className="animate-spin text-primary mx-auto my-4" />
                      ) : (
                        <div className="space-y-3 text-left">
                          {adminsAndLeaders.length > 0 ? adminsAndLeaders.map((contact) => (
                            <div key={contact.uid} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                              <div>
                                <p className="font-semibold">{contact.name}</p>
                              </div>
                              <Button 
                                size="sm" 
                                onClick={() => handleNotify(contact)}
                                disabled={!contact.whatsapp}
                                title={!contact.whatsapp ? "Este usuário não tem WhatsApp cadastrado" : `Enviar mensagem para ${contact.name}`}
                              >
                                <MessageCircle size={16} className="mr-2"/> Notificar
                              </Button>
                            </div>
                          )) : (
                            <p className="text-sm text-center text-muted-foreground">
                              Nenhum dirigente ou administrador com WhatsApp cadastrado foi encontrado.
                            </p>
                          )}
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>


                <div className="pt-4">
                    <button
                        onClick={logout}
                        className="w-full px-4 py-2 font-semibold text-destructive-foreground bg-destructive rounded-md hover:bg-destructive/90"
                    >
                        Sair
                    </button>
                </div>
            </div>
        </div>
    );
}

export default withAuth(AguardandoAprovacaoPage);
