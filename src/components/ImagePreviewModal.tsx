
"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { useAndroidBack } from "@/hooks/useAndroidBack";

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

  // Hook para o botão "voltar" do Android
  useAndroidBack({
    enabled: isOpen,
    onClose: onClose,
  });

  useEffect(() => {
    if (!isOpen) return;

    // 🔄 Tenta forçar modo paisagem (funciona em Android)
    const lockOrientation = async () => {
      try {
        if (screen.orientation?.lock) {
          await screen.orientation.lock("landscape");
        }
      } catch {
        // iOS ignora — comportamento normal
      }
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
      {/* Botão fechar */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-50 text-white hover:opacity-80"
        aria-label="Fechar visualização"
      >
        <X size={32} />
      </button>

      {/* Container adaptável */}
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
