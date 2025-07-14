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
          // Rotação aplicada em telas pequenas (smartphones)
          // AQUI A MUDANÇA: Reduzi o tamanho máximo para 80vw, um pouco menor.
          className="max-w-screen-xl max-h-[90vh] object-contain md:max-h-[90vh] md:max-w-[90vw] md:rotate-0 rotate-90 max-h-[80vw] max-w-[80vw] transition-transform duration-300"
        />
      </div>
    </div>
  );
}
