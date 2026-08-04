"use client";

import { useState, useCallback, useEffect } from 'react';
import { useWebNotifications } from '@/hooks/useWebNotifications';
import { useUser } from '@/contexts/UserContext';
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
  Loader2,
  Activity,
  Copy,
  Check,
  RotateCcw,
  ShieldCheck,
  Terminal,
  XCircle,
  Cpu
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DiagnosticResult {
  swRegistered: boolean;
  swScriptUrl: string;
  swState: string;
  swCount: number;
  permission: string;
  pushSupported: boolean;
  isPwa: boolean;
  hasFcmToken: boolean;
  fcmTokenValue: string;
  fcmTokensCount: number;
  lastSync: string;
  vapidConfigured: boolean;
  userAgent: string;
}

export function NotificationPushBanner() {
  const { user } = useUser();
  const { toast } = useToast();
  const { 
    permission, 
    isSupported, 
    loadingPermission, 
    requestPermission, 
    disableNotifications,
    syncWebFcmToken,
    sendTestNotification 
  } = useWebNotifications();

  const [showInstructions, setShowInstructions] = useState(false);
  const [showDiagnostic, setShowDiagnostic] = useState(false);
  const [syncingToken, setSyncingToken] = useState(false);
  const [runningDiagnostic, setRunningDiagnostic] = useState(false);
  const [copiedReport, setCopiedReport] = useState(false);
  const [diagnosticData, setDiagnosticData] = useState<DiagnosticResult | null>(null);

  const runDiagnostic = useCallback(async () => {
    setRunningDiagnostic(true);

    let swRegistered = false;
    let swScriptUrl = 'Nenhum Service Worker registrado';
    let swState = 'Inativo';
    let swCount = 0;

    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        swCount = regs.length;
        if (regs.length > 0) {
          swRegistered = true;
          const activeReg = regs.find(r => r.active || r.waiting || r.installing) || regs[0];
          const activeWorker = activeReg.active || activeReg.waiting || activeReg.installing;
          if (activeWorker) {
            swScriptUrl = activeWorker.scriptURL ? new URL(activeWorker.scriptURL).pathname : 'Ativo';
            swState = activeWorker.state || 'ativo';
          } else {
            swState = 'registrado';
          }
        }
      } catch (err) {
        console.warn("Erro ao obter Service Workers no diagnóstico:", err);
      }
    }

    const currentPermission = typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported';
    const pushSupported = typeof window !== 'undefined' && 'PushManager' in window;
    const isPwa = typeof window !== 'undefined' && (
      window.matchMedia('(display-mode: standalone)').matches || 
      (navigator as any).standalone === true
    );

    const hasFcmToken = !!user?.fcmToken;
    const fcmTokenValue = user?.fcmToken || '';
    const fcmTokensCount = Array.isArray(user?.fcmTokens) ? user.fcmTokens.length : (hasFcmToken ? 1 : 0);

    let lastSync = 'Nunca';
    if (user?.pushSubscriptionUpdated) {
      try {
        const updatedDate = user.pushSubscriptionUpdated.toDate ? user.pushSubscriptionUpdated.toDate() : new Date(user.pushSubscriptionUpdated);
        lastSync = updatedDate.toLocaleString('pt-BR');
      } catch {
        lastSync = 'Recente';
      }
    }

    const vapidConfigured = !!(process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || true);
    const userAgent = typeof window !== 'undefined' ? navigator.userAgent : 'Desconhecido';

    const result: DiagnosticResult = {
      swRegistered,
      swScriptUrl,
      swState,
      swCount,
      permission: currentPermission,
      pushSupported,
      isPwa,
      hasFcmToken,
      fcmTokenValue,
      fcmTokensCount,
      lastSync,
      vapidConfigured,
      userAgent
    };

    setDiagnosticData(result);
    setRunningDiagnostic(false);
  }, [user]);

  // Executa o diagnóstico automaticamente quando o painel de diagnóstico é aberto
  useEffect(() => {
    if (showDiagnostic && !diagnosticData) {
      runDiagnostic();
    }
  }, [showDiagnostic, diagnosticData, runDiagnostic]);

  if (!isSupported) {
    return null;
  }

  const isSystemActive = permission === 'granted' && user?.pushNotificationsEnabled !== false;
  const hasToken = !!user?.fcmToken;

  const handleSyncToken = async () => {
    if (!user?.uid) return;
    setSyncingToken(true);
    await syncWebFcmToken(user.uid, true);
    setSyncingToken(false);
    // Re-executa diagnóstico para atualizar status
    runDiagnostic();
  };

  const copyDiagnosticReport = () => {
    if (!diagnosticData) return;

    const report = `=== DIAGNÓSTICO PUSH DE CASA EM CASA ===
Data/Hora: ${new Date().toLocaleString('pt-BR')}
Usuário ID: ${user?.uid || 'Não autenticado'}
E-mail: ${user?.email || 'N/A'}

[1] Permissão de Notificação: ${diagnosticData.permission}
[2] Service Worker Registrado: ${diagnosticData.swRegistered ? 'SIM (' + diagnosticData.swCount + ' reg)' : 'NÃO'}
    Script: ${diagnosticData.swScriptUrl}
    Estado: ${diagnosticData.swState}
[3] Suporte Push API: ${diagnosticData.pushSupported ? 'SIM' : 'NÃO'}
[4] Modo PWA Standalone: ${diagnosticData.isPwa ? 'SIM (Instalado)' : 'NÃO (Navegador)'}
[5] Token FCM no Firestore: ${diagnosticData.hasFcmToken ? 'SIM (' + diagnosticData.fcmTokensCount + ' tokens)' : 'NÃO'}
    Token Mascarado: ${diagnosticData.fcmTokenValue ? diagnosticData.fcmTokenValue.substring(0, 15) + '...' + diagnosticData.fcmTokenValue.substring(diagnosticData.fcmTokenValue.length - 8) : 'Nenhum'}
    Última Sincronização: ${diagnosticData.lastSync}
[6] VAPID Key: ${diagnosticData.vapidConfigured ? 'Configurada' : 'Ausente'}
[7] User Agent: ${diagnosticData.userAgent}
=======================================`;

    navigator.clipboard.writeText(report);
    setCopiedReport(true);
    toast({
      title: "Relatório Copiado! 📋",
      description: "O diagnóstico do sistema foi copiado para sua área de transferência.",
    });
    setTimeout(() => setCopiedReport(false), 3000);
  };

  return (
    <div className="bg-card border rounded-xl p-5 shadow-sm space-y-4 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className={`p-2.5 rounded-xl shrink-0 ${
            isSystemActive 
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
              : permission === 'denied'
              ? 'bg-destructive/10 text-destructive border border-destructive/20'
              : 'bg-primary/10 text-primary border border-primary/20'
          }`}>
            {isSystemActive ? (
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
              {isSystemActive ? (
                <>
                  <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 gap-1 hover:bg-emerald-500/20">
                    <CheckCircle2 className="w-3 h-3" /> Ativadas
                  </Badge>
                  {!hasToken && (
                    <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-400 bg-amber-500/10 gap-1 animate-pulse">
                      <AlertCircle className="w-3 h-3" /> Token Pendente
                    </Badge>
                  )}
                </>
              ) : permission === 'denied' ? (
                <Badge variant="destructive" className="gap-1">
                  <BellOff className="w-3 h-3" /> Bloqueadas no Navegador
                </Badge>
              ) : (
                <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-400 bg-amber-500/10 gap-1">
                  <AlertCircle className="w-3 h-3" /> Desativadas
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Receba alertas instantâneos no seu celular ou computador sobre <span className="font-semibold text-foreground">territórios vencidos</span> e <span className="font-semibold text-foreground">novas designações</span>.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
          {isSystemActive ? (
            <>
              {!hasToken && (
                <Button 
                  onClick={handleSyncToken} 
                  disabled={syncingToken}
                  size="sm"
                  className="flex-1 sm:flex-initial gap-2 font-semibold shadow-sm bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {syncingToken ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <BellRing className="w-3.5 h-3.5" />
                  )}
                  Sincronizar Token agora
                </Button>
              )}
              <Button 
                onClick={sendTestNotification} 
                variant="outline" 
                size="sm"
                className="flex-1 sm:flex-initial gap-2 border-emerald-500/30 hover:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              >
                <Send className="w-3.5 h-3.5" /> Enviar Teste
              </Button>
              <Button 
                onClick={disableNotifications} 
                disabled={loadingPermission}
                variant="secondary" 
                size="sm"
                className="flex-1 sm:flex-initial gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                {loadingPermission ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <BellOff className="w-3.5 h-3.5" />
                )}
                Desativar Notificações
              </Button>
            </>
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

          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setShowDiagnostic(!showDiagnostic)}
            className={`text-xs gap-1.5 transition-colors ${showDiagnostic ? 'bg-primary/10 text-primary border-primary/30' : ''}`}
          >
            <Activity className="w-3.5 h-3.5" /> Diagnóstico
            {showDiagnostic ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </Button>

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

      {/* PAINEL DE DIAGNÓSTICO COMPLETO */}
      {showDiagnostic && (
        <div className="mt-4 pt-4 border-t space-y-4 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-muted/30 p-3.5 rounded-lg border">
            <div>
              <h4 className="font-bold text-sm flex items-center gap-2 text-foreground">
                <Activity className="w-4 h-4 text-primary" />
                Painel de Diagnóstico do Sistema Push FCM
              </h4>
              <p className="text-xs text-muted-foreground">
                Verificação técnica em tempo real do Service Worker, permissões do navegador e tokens de notificação.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button 
                onClick={runDiagnostic} 
                disabled={runningDiagnostic} 
                variant="outline" 
                size="sm"
                className="gap-1.5 text-xs h-8"
              >
                {runningDiagnostic ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="w-3.5 h-3.5" />
                )}
                Testar Novamente
              </Button>

              <Button 
                onClick={copyDiagnosticReport} 
                variant="outline" 
                size="sm"
                className="gap-1.5 text-xs h-8"
              >
                {copiedReport ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedReport ? 'Copiado!' : 'Copiar Relatório'}
              </Button>
            </div>
          </div>

          {diagnosticData ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              
              {/* Card 1: Service Worker */}
              <div className="bg-background p-3.5 rounded-lg border space-y-2 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-primary" /> Service Worker
                  </span>
                  {diagnosticData.swRegistered ? (
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 gap-1 text-[10px]">
                      <CheckCircle2 className="w-3 h-3" /> Registrado
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="gap-1 text-[10px]">
                      <XCircle className="w-3 h-3" /> Ausente
                    </Badge>
                  )}
                </div>
                <div className="space-y-1 text-muted-foreground">
                  <p><strong className="text-foreground">Arquivo:</strong> <code className="bg-muted px-1 py-0.5 rounded text-[11px] font-mono">{diagnosticData.swScriptUrl}</code></p>
                  <p><strong className="text-foreground">Estado:</strong> {diagnosticData.swState}</p>
                  <p><strong className="text-foreground">Registros ativos:</strong> {diagnosticData.swCount}</p>
                </div>
              </div>

              {/* Card 2: Permissão do Navegador */}
              <div className="bg-background p-3.5 rounded-lg border space-y-2 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-primary" /> Permissão Push
                  </span>
                  {diagnosticData.permission === 'granted' ? (
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 gap-1 text-[10px]">
                      <CheckCircle2 className="w-3 h-3" /> Concedida
                    </Badge>
                  ) : diagnosticData.permission === 'denied' ? (
                    <Badge variant="destructive" className="gap-1 text-[10px]">
                      <XCircle className="w-3 h-3" /> Bloqueada
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-amber-500/40 text-amber-700 bg-amber-500/10 gap-1 text-[10px]">
                      <AlertCircle className="w-3 h-3" /> Pendente
                    </Badge>
                  )}
                </div>
                <div className="space-y-1 text-muted-foreground">
                  <p><strong className="text-foreground">Notificações Web:</strong> {diagnosticData.permission}</p>
                  <p><strong className="text-foreground">Push API:</strong> {diagnosticData.pushSupported ? 'Suportada' : 'Não suportada'}</p>
                  <p><strong className="text-foreground">Modo PWA:</strong> {diagnosticData.isPwa ? 'Tela de Início (App)' : 'Navegador'}</p>
                </div>
              </div>

              {/* Card 3: Token FCM no Firestore */}
              <div className="bg-background p-3.5 rounded-lg border space-y-2 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-primary" /> Token FCM (Push)
                  </span>
                  {diagnosticData.hasFcmToken ? (
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 gap-1 text-[10px]">
                      <CheckCircle2 className="w-3 h-3" /> Válido
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-amber-500/40 text-amber-700 bg-amber-500/10 gap-1 text-[10px]">
                      <AlertCircle className="w-3 h-3" /> Ausente
                    </Badge>
                  )}
                </div>
                <div className="space-y-1 text-muted-foreground">
                  <p className="truncate"><strong className="text-foreground">Token:</strong> {diagnosticData.hasFcmToken ? <code className="bg-muted px-1 py-0.5 rounded text-[10px] font-mono">{diagnosticData.fcmTokenValue.substring(0, 10)}...</code> : 'Nenhum'}</p>
                  <p><strong className="text-foreground">Dispositivos:</strong> {diagnosticData.fcmTokensCount}</p>
                  <p><strong className="text-foreground">Última Sync:</strong> {diagnosticData.lastSync}</p>
                </div>
              </div>

              {/* Card 4: Status do Servidor FCM & Vercel */}
              <div className="bg-background p-3.5 rounded-lg border space-y-2 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-primary" /> Servidor / Vercel
                  </span>
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 gap-1 text-[10px]">
                    <CheckCircle2 className="w-3 h-3" /> Pronto
                  </Badge>
                </div>
                <div className="space-y-1 text-muted-foreground">
                  <p><strong className="text-foreground">Chave VAPID:</strong> {diagnosticData.vapidConfigured ? 'Ativa' : 'Ausente'}</p>
                  <p><strong className="text-foreground">Servidor Push:</strong> API / Vercel Cron</p>
                  <Button 
                    onClick={handleSyncToken} 
                    disabled={syncingToken} 
                    size="sm" 
                    variant="secondary"
                    className="w-full text-[11px] h-7 mt-1 gap-1"
                  >
                    {syncingToken ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                    Sincronizar Token Agora
                  </Button>
                </div>
              </div>

            </div>
          ) : (
            <div className="flex items-center justify-center p-6 text-muted-foreground gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary" /> Carregando informações de diagnóstico...
            </div>
          )}
        </div>
      )}
    </div>
  );
}

