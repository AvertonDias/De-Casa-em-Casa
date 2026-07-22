
"use client";

import { type ReactNode, useCallback, useEffect } from 'react';
import { useModal } from "@/contexts/ModalContext";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { buttonVariants } from './ui/button';
import { cn } from '@/lib/utils';
import { Loader } from 'lucide-react';
import { Button } from './ui/button';


interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message?: ReactNode;
  children?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  isLoading?: boolean;
  showCancelButton?: boolean;
  variant?: 'default' | 'destructive' | 'info';
  confirmDisabled?: boolean;
}

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  children,
  confirmText = "Sim, Confirmar",
  cancelText = "Cancelar",
  isLoading = false,
  showCancelButton = true,
  variant = 'destructive',
  confirmDisabled = false,
}: ConfirmationModalProps) {
  const { registerModal, unregisterModal } = useModal();
  const modalId = `confirmationModal-${title.replace(/\s+/g, '-')}`;

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      registerModal(modalId, handleClose);
      return () => {
        unregisterModal(modalId);
      };
    }
  }, [isOpen, modalId, registerModal, unregisterModal, handleClose]);

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      handleClose();
    }
  }, [handleClose]);


  return (
    <AlertDialog open={isOpen} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div>
              {message}
              {children}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {showCancelButton && <AlertDialogCancel onClick={handleClose} disabled={isLoading}>{cancelText}</AlertDialogCancel>}
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isLoading || confirmDisabled}
            className={cn(buttonVariants({ variant }))}
          >
            {isLoading ? <><Loader className="mr-2 h-4 w-4 animate-spin" /> Processando...</> : confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
