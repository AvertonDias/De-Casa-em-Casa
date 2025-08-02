"use client";

import withAuth from '@/components/withAuth';
import { Settings } from 'lucide-react';

function SettingsPage() {

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Configurações</h1>
          <p className="text-muted-foreground">Gerencie suas preferências e dados.</p>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center text-center p-10 bg-card rounded-lg mt-8">
        <Settings size={48} className="text-muted-foreground mb-4"/>
        <h2 className="text-xl font-semibold">Área em Desenvolvimento</h2>
        <p className="text-muted-foreground mt-2">
          As configurações da congregação foram movidas para a aba 'Administração'.<br/>
          As configurações de perfil podem ser acessadas clicando no seu nome no menu lateral.
        </p>
      </div>
      
    </div>
  );
}

export default withAuth(SettingsPage);
