"use client";

import { useState } from 'react';
import { useWebNotifications } from '@/hooks/useWebNotifications';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  BellRing, 
  BellOff, 
  CheckCircle2, 
  AlertCircle, 
  Send, 
  ChevronDown, 
  ChevronUp, 
  Smartphone, 
  HelpCircle,
  Loader2
} from 'lucide-react';

export function NotificationPushBanner() {
  const { 
    permission, 
    isSupported, 
    loadingPermission, 
    requestPermission, 
    sendTestNotification 
  } = useWebNotifications();

  const [showInstructions, setShowInstructions] = useState(false);

  if (!isSupported) {
    return null;
  }

  return (
    <div className="bg-card border rounded-xl p-5 shadow-sm space-y-4 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className={`p-2.5 rounded-xl shrink-0 ${
            permission === 'granted' 
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
              : permission === 'denied'
              ? 'bg-destructive/10 text-destructive border border-destructive/20'
              : 'bg-primary/10 text-primary border border-primary/20'
          }`}>
            {permission === 'granted' ? (
              <BellRing className="w-6 h-6 animate-pulse" />
            ) : permission === 'denied' ? (
              <BellOff className="w-6 h-6" />
            ) : (
              <Smartphone className="w-6 h-6" />
            )}
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-base leading-none">Notificações Push no Navegador / PWA</h3>
              {permission === 'granted' && (
                <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 gap-1 hover:bg-emerald-500/20">
                  <CheckCircle2 className="w-3 h-3" /> Ativadas
                </Badge>
              )}
              {permission === 'default' && (
                <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-400 bg-amber-500/10 gap-1">
                  <AlertCircle className="w-3 h-3" /> Inativas
                </Badge>
              )}
              {permission === 'denied' && (
                <Badge variant="destructive" className="gap-1">
                  <BellOff className="w-3 h-3" /> Bloqueadas no Navegador
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Receba alertas instantâneos no seu celular ou computador sobre <span className="font-semibold text-foreground">territórios vencidos</span> e <span className="font-semibold text-foreground">novas designações</span>.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
          {permission === 'granted' ? (
            <Button 
              onClick={sendTestNotification} 
              variant="outline" 
              size="sm"
              className="w-full sm:w-auto gap-2 border-emerald-500/30 hover:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
            >
              <Send className="w-3.5 h-3.5" /> Enviar Teste
            </Button>
          ) : (
            <Button 
              onClick={requestPermission} 
              disabled={loadingPermission} 
              size="sm"
              className="w-full sm:w-auto gap-2 font-semibold shadow-sm"
            >
              {loadingPermission ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Solicitando...
                </>
              ) : (
                <>
                  <BellRing className="w-3.5 h-3.5" /> Ativar Notificações
                </>
              )}
            </Button>
          )}

          {permission === 'denied' && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setShowInstructions(!showInstructions)}
              className="text-xs text-muted-foreground gap-1"
            >
              <HelpCircle className="w-3.5 h-3.5" /> Como desbloquear?
              {showInstructions ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </Button>
          )}
        </div>
      </div>

      {permission === 'denied' && showInstructions && (
        <div className="mt-3 p-3.5 bg-muted/60 border rounded-lg text-xs space-y-2 text-muted-foreground animate-in fade-in duration-200">
          <p className="font-semibold text-foreground flex items-center gap-1.5">
            <HelpCircle className="w-4 h-4 text-primary" /> Como liberar notificações bloqueadas no seu dispositivo:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong className="text-foreground">Google Chrome / Android:</strong> Toque no ícone de cadeado ou configurações <span className="font-mono">🔒</span> do lado da URL, acesse <span className="font-semibold">"Configurações do site"</span> e altere Notificações para <span className="font-semibold">"Permitir"</span>.</li>
            <li><strong className="text-foreground">iPhone / Safari iOS:</strong> Certifique-se de ter adicionado o aplicativo à <span className="font-semibold">"Tela de Início" (PWA)</span> e em <span className="font-semibold">Ajustes &gt; Notificações &gt; De Casa em Casa</span> permita os alertas.</li>
            <li><strong className="text-foreground">Computador (Chrome/Edge/Firefox):</strong> Clique no ícone de cadeado ao lado do endereço web e mude a permissão de Notificações para <span className="font-semibold">Permitir</span>. Em seguida, recarregue a página.</li>
          </ul>
        </div>
      )}
    </div>
  );
}
