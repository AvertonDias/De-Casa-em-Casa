"use client";

import withAuth from "@/components/withAuth";
import CongregationEditForm from "@/components/admin/CongregationEditForm";
import { useUser } from "@/contexts/UserContext";

function CongregationSettingsPage() {
    const { user } = useUser();

    if (user?.role !== 'Administrador') {
        return (
            <div className="text-center p-8">
                <h1 className="text-2xl font-bold">Acesso Negado</h1>
                <p className="text-muted-foreground">Apenas administradores podem acessar esta página.</p>
            </div>
        )
    }
  
    return (
        <div className="p-4 md:p-6 lg:p-8 space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Configurações da Congregação</h1>
                <p className="text-muted-foreground">Gerencie as informações e modelos de mensagem da sua congregação.</p>
            </div>

            <CongregationEditForm onSaveSuccess={() => {
                // Ação opcional após salvar com sucesso
                console.log("Configurações salvas!");
            }} />
        </div>
    );
}

export default withAuth(CongregationSettingsPage);
