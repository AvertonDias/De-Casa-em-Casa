
"use client";

import { Fragment, type ReactNode } from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { buttonVariants } from './ui/button';
import { cn } from '@/lib/utils';


interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: ReactNode;
  confirmText?: string;
  cancelText?: string;
  isLoading?: boolean;
  showCancelButton?: boolean;
  variant?: 'default' | 'destructive';
}

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Sim, Confirmar",
  cancelText = "Cancelar",
  isLoading = false,
  showCancelButton = true,
  variant = 'destructive' // Cor padrão é a destrutiva (vermelho)
}: ConfirmationModalProps) {

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            {message}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {showCancelButton && <AlertDialogCancel disabled={isLoading}>{cancelText}</AlertDialogCancel>}
          <AlertDialogAction 
            onClick={onConfirm} 
            disabled={isLoading} 
            className={cn(buttonVariants({ variant: variant }))}
          >
            {isLoading ? "Processando..." : confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
