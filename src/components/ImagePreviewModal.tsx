"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useModal } from "@/contexts/ModalContext";

interface ImagePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string | null;
}

export default function ImagePreviewModal({
  isOpen,
  onClose,
  imageUrl,
}: ImagePreviewModalProps) {
  const { registerModal, unregisterModal } = useModal();

  // Registrar/desregistrar o modal no contexto global
  useEffect(() => {
    const modalId = 'imagePreview';
    if (isOpen) {
      registerModal(modalId, onClose);
    }
    return () => {
      unregisterModal(modalId);
    };
  }, [isOpen, registerModal, unregisterModal, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const lockOrientation = async () => {
      try {
        if (screen.orientation?.lock) {
          await screen.orientation.lock("landscape");
        }
      } catch {}
    };

    lockOrientation();

    return () => {
      try {
        screen.orientation?.unlock();
      } catch {}
    };
  }, [isOpen]);

  if (!isOpen || !imageUrl) return null;

  return (
    <div
      className="
        fixed inset-0 z-50 bg-black
        flex items-center justify-center
        select-none
      "
      style={{ touchAction: "none" }}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-50 text-white hover:opacity-80"
        aria-label="Fechar visualização"
      >
        <X size={32} />
      </button>

      <div
        className="
          w-full h-full
          flex items-center justify-center
          px-2 py-2
        "
      >
        <img
          src={imageUrl}
          alt="Visualização do cartão do território"
          className="
            max-w-full max-h-full
            object-contain
          "
          loading="eager"
          referrerPolicy="no-referrer"
          draggable={false}
        />
      </div>
    </div>
  );
}