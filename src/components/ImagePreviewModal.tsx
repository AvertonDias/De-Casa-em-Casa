// src/components/ImagePreviewModal.tsx
"use client";

import { X } from 'lucide-react';

interface ImagePreviewModalProps {
  isOpen: boolean;
  imageUrl: string | null;
  onClose: () => void;
}

export default function ImagePreviewModal({ isOpen, imageUrl, onClose }: ImagePreviewModalProps) {
  if (!isOpen || !imageUrl) return null;

  return (
    // O Fundo Escuro (Overlay) - clicar aqui fecha o modal
    <div 
      onClick={onClose} 
      className="fixed inset-0 bg-black/80 flex justify-center items-center z-50 p-4 transition-opacity duration-300"
    >
      {/* Botão de Fechar no canto */}
      <button onClick={onClose} className="absolute top-4 right-4 text-white hover:text-gray-300">
        <X size={32} />
      </button>

      {/* Container da Imagem - evita que clicar na imagem feche o modal */}
      <div 
        onClick={(e) => e.stopPropagation()}
        className="relative"
      >
        <img 
          src={imageUrl} 
          alt="Preview do Cartão em tela cheia" 
          // AQUI A MUDANÇA:
          // Em telas pequenas (md:), a imagem é rotacionada.
          // max-w-[90vh] e max-h-[90vw] garantem que a imagem rotacionada se ajuste perfeitamente à tela.
          // Em telas grandes, voltamos ao comportamento padrão.
          className="max-w-[90vw] max-h-[90vh] object-contain transition-transform duration-300 md:rotate-0 md:max-w-[90vw] md:max-h-[90vh] rotate-90"
        />
      </div>
    </div>
  );
}
