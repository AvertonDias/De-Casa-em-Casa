
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
import { app } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { getInitials } from '@/lib/utils';

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
            const result: any = await getManagersForNotification({ congregationId: user.congregationId });
            
            if (result.data.success) {
                setAdminsAndLeaders(result.data.managers);
            } else {
                throw new Error(result.data.error || "Falha ao buscar contatos.");
            }
        } catch (error: any) {
            console.error("Erro ao buscar administradores e dirigentes:", error);
            toast({
                title: "Erro ao buscar contatos",
                description: error.message || "Não foi possível carregar a lista de dirigentes. Verifique sua conexão ou tente mais tarde.",
                variant: "destructive"
            })
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
        const whatsappNumber = contact.whatsapp.replace(/\D/g, '');
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
                    Para agilizar, você pode notificar um dos dirigentes ou administradores abaixo.
                </p>

                <Accordion type="single" collapsible className="w-full text-left">
                  <AccordionItem value="item-1">
                    <AccordionTrigger className="font-semibold hover:no-underline">Notificar um responsável</AccordionTrigger>
                    <AccordionContent>
                      {isLoadingContacts ? (
                        <div className="flex justify-center p-4">
                            <Loader className="animate-spin text-primary" />
                        </div>
                      ) : (
                        <div className="space-y-3 pt-2">
                          {adminsAndLeaders.length > 0 ? adminsAndLeaders.map((contact) => (
                            <div key={contact.uid} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                              <div className="flex items-center gap-3">
                                <Avatar className="h-9 w-9">
                                  <AvatarFallback>{getInitials(contact.name)}</AvatarFallback>
                                </Avatar>
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
                            <p className="text-sm text-center text-muted-foreground py-4">
                              Nenhum dirigente ou administrador com WhatsApp cadastrado foi encontrado.
                            </p>
                          )}
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>


                <div className="pt-4">
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
