
"use client";

import { useState, useEffect } from 'react';
import { useUser } from "@/contexts/UserContext";
import { Loader, MailCheck, MessageCircle, AlertTriangle } from "lucide-react";
import withAuth from "@/components/withAuth";
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '@/lib/firebase';
import { AppUser } from '@/types/types';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from '@/components/ui/button';

const functions = getFunctions(app, 'southamerica-east1');
const getManagersFn = httpsCallable(functions, 'getManagersForNotification');

function AguardandoAprovacaoPage() {
    const { user, loading, logout } = useUser();
    const [adminsAndLeaders, setAdminsAndLeaders] = useState<AppUser[]>([]);
    const [isLoadingContacts, setIsLoadingContacts] = useState(true);

    useEffect(() => {
        if (user?.congregationId) {
            const fetchAdminsAndLeaders = async () => {
                setIsLoadingContacts(true);
                try {
                    const result: any = await getManagersFn({ congregationId: user.congregationId });
                    if(result.data.success) {
                        setAdminsAndLeaders(result.data.contacts);
                    }
                } catch (error) {
                    console.error("Erro ao buscar administradores e dirigentes:", error);
                } finally {
                    setIsLoadingContacts(false);
                }
            };

            fetchAdminsAndLeaders();
        }
    }, [user?.congregationId]);

    const handleNotify = (contact: AppUser) => {
        if (!user || !contact.whatsapp) return;
        
        const contactFirstName = contact.name.split(' ')[0];
        
        const message = `Olá, ${contactFirstName}, tudo bem? Aqui é o ${user.name}. Solicitei o acesso ao aplicativo 'De Casa em Casa' e estou aguardando a aprovação. Poderia verificar, por favor? Muito obrigado!`;
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
    
    const contactsWithWhatsapp = adminsAndLeaders.filter(c => c.whatsapp && c.whatsapp.trim() !== '');

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
                        <div className="flex items-center justify-center gap-2 text-muted-foreground p-4">
                            <Loader className="animate-spin text-primary" size={16}/>
                            <span>Buscando contatos...</span>
                        </div>
                      ) : contactsWithWhatsapp.length > 0 ? (
                        <div className="space-y-3 text-left">
                          {contactsWithWhatsapp.map((contact) => (
                            <div key={contact.uid} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                              <div>
                                <p className="font-semibold">{contact.name}</p>
                              </div>
                              <Button 
                                size="sm" 
                                onClick={() => handleNotify(contact)}
                                title={`Enviar mensagem para ${contact.name}`}
                              >
                                <MessageCircle size={16} className="mr-2"/> Notificar
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center p-4 text-sm text-muted-foreground bg-muted/30 rounded-lg">
                           <AlertTriangle size={24} className="mx-auto mb-2 text-amber-500"/>
                           Nenhum dirigente ou administrador com WhatsApp cadastrado foi encontrado.
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
