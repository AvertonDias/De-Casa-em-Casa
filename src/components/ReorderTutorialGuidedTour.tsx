"use client";

import { useState, useEffect } from 'react';
import { Lightbulb, ArrowUpDown, X, HelpCircle, ChevronRight, ChevronLeft, CheckCircle2, GripVertical, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from '@/lib/utils';

interface ReorderTutorialGuidedTourProps {
  /** Controls if the automatic balloon (popover) is visible */
  showTipBalloon: boolean;
  /** Function to close the balloon */
  onCloseTipBalloon: () => void;
  /** Callback when user clicks "Entendi" (marks as read permanently) */
  onDismissForever: () => void;
  /** Optional callback to open the actual Reorder Modal directly */
  onOpenReorderModal?: () => void;
  /** Optional controlled state for opening tutorial modal directly */
  isTutorialOpen?: boolean;
  /** Callback when tutorial modal open state changes */
  onTutorialOpenChange?: (open: boolean) => void;
}

export function ReorderTutorialGuidedTour({
  showTipBalloon,
  onCloseTipBalloon,
  onDismissForever,
  onOpenReorderModal,
  isTutorialOpen: externalIsTutorialOpen,
  onTutorialOpenChange,
}: ReorderTutorialGuidedTourProps) {
  const [internalIsTutorialOpen, setInternalIsTutorialOpen] = useState(false);
  const [step, setStep] = useState(1);

  const isTutorialOpen = externalIsTutorialOpen ?? internalIsTutorialOpen;
  const setIsTutorialOpen = (open: boolean) => {
    setInternalIsTutorialOpen(open);
    if (onTutorialOpenChange) {
      onTutorialOpenChange(open);
    }
  };

  const handleStartTutorial = () => {
    onCloseTipBalloon();
    setStep(1);
    setIsTutorialOpen(true);
  };

  const handleDismiss = () => {
    onDismissForever();
    onCloseTipBalloon();
  };

  const handleFinishTutorial = () => {
    setIsTutorialOpen(false);
    onDismissForever();
  };

  return (
    <>
      {/* Balão Flutuante (Tip Balloon) exibido após adicionar um novo número */}
      {showTipBalloon && (
        <div 
          className="fixed bottom-5 right-4 sm:bottom-6 sm:right-6 z-[9999] max-w-sm w-[calc(100vw-2rem)] bg-card dark:bg-slate-900 border-2 border-blue-500 rounded-2xl p-4 shadow-2xl animate-in fade-in slide-in-from-bottom-5 duration-300 ring-4 ring-blue-500/20"
          role="alert"
          aria-live="polite"
        >
          {/* Seta visual do balão */}
          <div className="absolute -top-3 right-8 w-6 h-6 bg-card dark:bg-slate-900 border-t-2 border-l-2 border-blue-500/80 rotate-45 rounded-xs" />

          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 shrink-0">
              <Lightbulb className="h-6 w-6 animate-pulse" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-bold text-base text-foreground flex items-center gap-1.5">
                  Número adicionado!
                </h4>
                <button
                  onClick={onCloseTipBalloon}
                  className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors"
                  title="Fechar balão"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                Você sabia que pode organizar os números na sequência exata da rua usando o botão <strong className="text-foreground inline-flex items-center gap-1 bg-muted px-1.5 py-0.5 rounded text-xs font-semibold"><ArrowUpDown className="h-3 w-3 text-blue-500" /> Reordenar</strong>?
              </p>

              {/* Ações: Entendi e Como? */}
              <div className="flex items-center gap-2 mt-4">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDismiss}
                  className="flex-1 text-xs font-medium border-border hover:bg-muted"
                >
                  Entendi
                </Button>

                <Button
                  size="sm"
                  onClick={handleStartTutorial}
                  className="flex-1 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md flex items-center justify-center gap-1.5"
                >
                  <HelpCircle className="h-4 w-4" />
                  Como?
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Interativo de Tutorial Passo a Passo */}
      <Dialog open={isTutorialOpen} onOpenChange={setIsTutorialOpen}>
        <DialogContent className="max-w-md p-6 rounded-2xl overflow-hidden border-border bg-card">
          <DialogHeader className="space-y-2 text-left">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-500/10 dark:bg-blue-500/20 px-2.5 py-1 rounded-full">
                Tutorial Interativo • Passo {step} de 3
              </span>
              {/* Barra de progresso visual */}
              <div className="flex gap-1">
                {[1, 2, 3].map((s) => (
                  <div
                    key={s}
                    className={cn(
                      "h-2 rounded-full transition-all duration-300",
                      s === step ? "w-6 bg-blue-600" : s < step ? "w-2 bg-blue-400" : "w-2 bg-muted"
                    )}
                  />
                ))}
              </div>
            </div>

            <DialogTitle className="text-xl font-bold text-foreground">
              {step === 1 && "1. Localize o botão 'Reordenar'"}
              {step === 2 && "2. Use as setas para mover os números"}
              {step === 3 && "3. Salve a nova sequência"}
            </DialogTitle>
          </DialogHeader>

          {/* Conteúdo Dinâmico por Passo */}
          <div className="my-4 space-y-4">
            {step === 1 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  No topo da tela da quadra, ao lado do botão de busca e de adicionar números, você encontrará o botão <strong className="text-foreground font-semibold">Reordenar</strong>.
                </p>

                {/* Demonstração visual do Passo 1 */}
                <div className="p-4 rounded-xl border border-border bg-muted/40 space-y-3">
                  <div className="text-xs font-medium text-muted-foreground">Exemplo da Barra de Ações:</div>
                  <div className="flex items-center gap-2 bg-card p-2 rounded-lg border border-border shadow-sm">
                    <div className="flex-1 bg-muted h-9 rounded-md flex items-center px-3 text-xs text-muted-foreground">
                      🔍 Buscar número...
                    </div>
                    <div className="flex gap-1.5">
                      <div className="h-9 px-3 bg-primary text-primary-foreground rounded-md text-xs font-bold flex items-center">
                        + Adicionar
                      </div>
                      <div className="h-9 px-3 bg-blue-600 text-white rounded-md text-xs font-bold flex items-center gap-1.5 shadow-md ring-2 ring-blue-500 ring-offset-2 animate-bounce">
                        <ArrowUpDown className="h-3.5 w-3.5" />
                        Reordenar
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Ao clicar em Reordenar, escolha o número que deseja mover e toque nas <strong className="text-foreground font-semibold">setas para cima (↑) e para baixo (↓)</strong> para colocar na ordem exata da rua.
                </p>

                {/* Demonstração Interativa do Passo 2 */}
                <div className="p-4 rounded-xl border border-border bg-muted/40 space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">Simulação do uso das setas:</div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-2.5 bg-card rounded-lg border border-border text-xs font-bold text-foreground shadow-xs">
                      <span className="flex items-center gap-2">
                        <GripVertical className="h-4 w-4 text-muted-foreground/50" />
                        123
                      </span>
                      <div className="flex gap-1">
                        <div className="p-1 rounded bg-muted text-muted-foreground"><ArrowUp className="h-3 w-3" /></div>
                        <div className="p-1 rounded bg-muted text-muted-foreground"><ArrowDown className="h-3 w-3" /></div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-2.5 bg-primary/10 border-2 border-primary rounded-lg text-xs font-bold text-primary shadow-md">
                      <span className="flex items-center gap-2">
                        <GripVertical className="h-4 w-4 text-primary" />
                        65 (Selecionado)
                      </span>
                      <div className="flex gap-1">
                        <div className="p-1.5 rounded-md bg-primary text-primary-foreground shadow-xs animate-bounce" title="Mover para cima">
                          <ArrowUp className="h-3.5 w-3.5" />
                        </div>
                        <div className="p-1.5 rounded-md bg-primary text-primary-foreground shadow-xs" title="Mover para baixo">
                          <ArrowDown className="h-3.5 w-3.5" />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-2.5 bg-card rounded-lg border border-border text-xs font-bold text-foreground shadow-xs">
                      <span className="flex items-center gap-2">
                        <GripVertical className="h-4 w-4 text-muted-foreground/50" />
                        125
                      </span>
                      <div className="flex gap-1">
                        <div className="p-1 rounded bg-muted text-muted-foreground"><ArrowUp className="h-3 w-3" /></div>
                        <div className="p-1 rounded bg-muted text-muted-foreground"><ArrowDown className="h-3 w-3" /></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Quando todos os números estiverem na ordem correta, basta clicar em <strong className="text-foreground font-semibold">Salvar Ordem</strong> para atualizar a lista para toda a congregação.
                </p>

                {/* Sucesso / Passo final */}
                <div className="p-4 rounded-xl border border-green-500/30 bg-green-500/10 dark:bg-green-500/20 text-center space-y-2">
                  <div className="inline-flex p-3 rounded-full bg-green-500/20 text-green-600 dark:text-green-400">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                  <h4 className="font-bold text-base text-foreground">Tudo pronto!</h4>
                  <p className="text-xs text-muted-foreground">
                    A ordem ajustada ajudará todos os irmãos e publicadores a trabalharem o território de forma sequencial e eficiente.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Rodapé e Botões do Tutorial */}
          <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-border">
            <div className="flex gap-2 w-full">
              {step > 1 ? (
                <Button
                  variant="outline"
                  onClick={() => setStep(step - 1)}
                  className="flex-1 text-xs"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Anterior
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  onClick={() => setIsTutorialOpen(false)}
                  className="flex-1 text-xs text-muted-foreground"
                >
                  Fechar
                </Button>
              )}

              {step < 3 ? (
                <Button
                  onClick={() => setStep(step + 1)}
                  className="flex-1 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Próximo
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <div className="flex-1 flex gap-2">
                  {onOpenReorderModal && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsTutorialOpen(false);
                        onOpenReorderModal();
                      }}
                      className="flex-1 text-xs border-blue-500 text-blue-600 dark:text-blue-400"
                    >
                      <ArrowUpDown className="h-3.5 w-3.5 mr-1" />
                      Testar Agora
                    </Button>
                  )}
                  <Button
                    onClick={handleFinishTutorial}
                    className="flex-1 text-xs font-bold bg-green-600 hover:bg-green-700 text-white"
                  >
                    Concluir
                  </Button>
                </div>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
