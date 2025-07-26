// src/components/ImagePreviewModal.tsx
"use client";

import { useEffect } from 'react';
import { X } from 'lucide-react';

interface ImagePreviewModalProps {
  isOpen: boolean;
  imageUrl: string | null;
  onClose: () => void;
}

export default function ImagePreviewModal({ isOpen, imageUrl, onClose }: ImagePreviewModalProps) {

  useEffect(() => {
    // Esta função manipula o botão "voltar" do navegador.
    const handlePopState = () => {
      onClose();
    };

    if (isOpen) {
      // Adiciona um novo estado ao histórico quando o modal abre.
      // A URL não muda, mas um novo ponto de histórico é criado.
      window.history.pushState({ modalOpen: true }, '');
      
      // Começa a "ouvir" o evento do botão voltar.
      window.addEventListener('popstate', handlePopState);
    } else {
      // Se o modal foi fechado sem usar o botão "voltar" (ex: clicando no X),
      // e o nosso estado ainda está no topo, removemos ele.
      if (window.history.state?.modalOpen) {
        window.history.back();
      }
    }

    // Função de limpeza: remove o listener quando o componente é desmontado ou o estado muda.
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isOpen, onClose]);


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
          // A imagem se ajusta automaticamente ao tamanho da tela,
          // rotacionando em dispositivos móveis para melhor visualização.
          className="max-w-[90vw] max-h-[90vh] object-contain transition-transform duration-300 md:rotate-0 rotate-90"
        />
      </div>
    </div>
  );
}