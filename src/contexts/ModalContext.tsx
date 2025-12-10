"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

type ModalRegistry = {
  [key: string]: () => void; // A função é o handler para fechar o modal
};

interface ModalContextType {
  registerModal: (id: string, onClose: () => void) => void;
  unregisterModal: (id: string) => void;
  getTopModalCloseHandler: () => (() => void) | null;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const useModal = () => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
};

export const ModalProvider = ({ children }: { children: ReactNode }) => {
  // Usamos um array para manter a ordem de abertura dos modais
  const [openModals, setOpenModals] = useState<string[]>([]);
  const [modalRegistry, setModalRegistry] = useState<ModalRegistry>({});

  const registerModal = useCallback((id: string, onClose: () => void) => {
    setModalRegistry(prev => ({ ...prev, [id]: onClose }));
    setOpenModals(prev => [...prev, id]);
  }, []);

  const unregisterModal = useCallback((id: string) => {
    setOpenModals(prev => prev.filter(modalId => modalId !== id));
    // A remoção do registro pode ser opcional ou atrasada para evitar problemas de concorrência
  }, []);

  const getTopModalCloseHandler = useCallback(() => {
    if (openModals.length === 0) {
      return null;
    }
    const topModalId = openModals[openModals.length - 1];
    return modalRegistry[topModalId] || null;
  }, [openModals, modalRegistry]);

  const value = {
    registerModal,
    unregisterModal,
    getTopModalCloseHandler,
  };

  return (
    <ModalContext.Provider value={value}>
      {children}
    </ModalContext.Provider>
  );
};