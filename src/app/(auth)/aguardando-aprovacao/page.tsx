
"use client";

import { useUser } from "@/contexts/UserContext";
import { Loader, MailCheck } from "lucide-react";
import withAuth from "@/components/withAuth";
import { Button } from '@/components/ui/button';

function AguardandoAprovacaoPage() {
    const { user, loading, logout } = useUser();

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
                    Um dirigente ou administrador irá aprovar seu acesso em breve.
                </p>

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
