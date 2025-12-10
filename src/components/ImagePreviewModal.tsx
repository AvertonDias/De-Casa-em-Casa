"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

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

  useEffect(() => {
    if (!isOpen) return;

    // Tenta forçar o modo paisagem (funciona bem em Android).
    const lockOrientation = async () => {
      try {
        // A API screen.orientation pode não estar disponível em todos os navegadores/contextos.
        if (screen.orientation?.lock) {
          await screen.orientation.lock("landscape");
        }
      } catch (error) {
        // Ignora erros, pois isso é uma melhoria de experiência e não é crítico.
        // iOS, por exemplo, não permite isso e lançará um erro.
        console.warn("Não foi possível travar a orientação da tela:", error);
      }
    };

    lockOrientation();

    // Quando o componente é desmontado (modal fecha), destrava a orientação.
    return () => {
      try {
        screen.orientation?.unlock();
      } catch (error) {
        // Ignora erros ao destravar.
      }
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
      style={{ touchAction: "none" }} // Previne o comportamento padrão de toque no fundo
    >
      {/* Botão para fechar */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-50 text-white hover:opacity-80 transition-opacity"
        aria-label="Fechar visualização da imagem"
      >
        <X size={32} />
      </button>

      {/* Container da Imagem */}
      <div
        className="
          w-full h-full
          flex items-center justify-center
          p-2
        "
      >
        <img
          src={imageUrl}
          alt="Visualização ampliada do cartão do território"
          className="
            max-w-full max-h-full
            object-contain
            rounded-md
          "
          draggable={false} // Impede o arrastar padrão de imagens
        />
      </div>
    </div>
  );
}
