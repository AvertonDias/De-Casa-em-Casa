"use client";

import { Dialog, Transition } from '@headlessui/react';
import { Fragment, type ReactNode } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: ReactNode;
  // ▼▼▼ MUDANÇA: 'confirmButtonText' agora é a propriedade correta. ▼▼▼
  confirmButtonText?: string; 
  cancelText?: string;
  isLoading?: boolean;
}

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  // ▼▼▼ MUDANÇA: Valor padrão agora usa 'confirmButtonText'. ▼▼▼
  confirmButtonText = "Sim", 
  cancelText = "Não",
  isLoading = false
}: ConfirmationModalProps) {

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        {/* ... */}
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child as={Fragment} /* ... */>
              <Dialog.Panel className="w-full max-w-md ...Ok, este screenshot é fantástico! É um daqueles casos raros em que múltiplos problemas acontecem de uma vez, mas cada um deles é muito claro e fácil de resolver.

Vamos analisar e resolver um por um.

**Diagnóstico Geral:**
O seu `npm run build` agora está funcionando! O erro do `next.config.js` **desapareceu**. Isso é uma vitória! O processo agora continua e nos mostra o próximo erro de build, que é exatamente o propósito do teste de build local.

### Problema 1: Erro de Aut">
                {/* ... */}
                <div className="mt-6 flex justify-end space-x-4">
                  <button type="button" onClick={onClose} disabled={isLoading} className="...">
                    {cancelText}
                  </button>
                  <button type="button" onClick={onConfirm} disabled={isLoading} className="... bg-red-600 ...">
                     {/* ▼▼▼ MUDANÇA: O texto do botão agora vem de 'confirmButtonText'. ▼▼▼ */}
                    {isLoading ? "Processando..." : confirmButtonText}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
