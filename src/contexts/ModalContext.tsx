"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
  useMemo,
} from "react";

type ModalRegistry = {
  [key: string]: () => void;
};

interface ModalContextType {
  registerModal: (id: string, onClose: () => void) => void;
  unregisterModal: (id: string) => void;
  hasOpenModal: boolean;
  closeTopModal: () => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const useModal = () => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error("useModal must be used within a ModalProvider");
  }
  return context;
};

export const ModalProvider = ({ children }: { children: ReactNode }) => {
  const [openModals, setOpenModals] = useState<string[]>([]);
  const [modalRegistry, setModalRegistry] = useState<ModalRegistry>({});

  const registerModal = useCallback((id: string, onClose: () => void) => {
    setOpenModals((prev) => {
      if (prev.includes(id)) return prev;
      return [...prev, id];
    });
    setModalRegistry((prev) => ({ ...prev, [id]: onClose }));
  }, []);

  const unregisterModal = useCallback((id: string) => {
    setOpenModals((prev) => prev.filter((modalId) => modalId !== id));
    setModalRegistry((prev) => {
      const newRegistry = { ...prev };
      delete newRegistry[id];
      return newRegistry;
    });
  }, []);

  const closeTopModal = useCallback(() => {
    if (openModals.length > 0) {
      const topModalId = openModals[openModals.length - 1];
      const closeHandler = modalRegistry[topModalId];
      if (closeHandler) {
        closeHandler();
      }
    }
  }, [openModals, modalRegistry]);

  const value = useMemo(
    () => ({
      registerModal,
      unregisterModal,
      hasOpenModal: openModals.length > 0,
      closeTopModal,
    }),
    [registerModal, unregisterModal, openModals.length, closeTopModal]
  );

  return (
    <ModalContext.Provider value={value}>
      {children}
    </ModalContext.Provider>
  );
};
