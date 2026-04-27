
"use client";

import { X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';

interface VideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string;
}

export const VideoModal = ({ isOpen, onClose, videoUrl }: VideoModalProps) => {
  const [mounted, setMounted] = useState(false);

  // Garante que o componente só tente renderizar no cliente
  useEffect(() => {
    setMounted(true);
    
    if (isOpen) {
      // Impede a rolagem do fundo quando o vídeo está aberto
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  // Usa createPortal para renderizar o modal fora da hierarquia do menu lateral
  return createPortal(
    <div 
      className="fixed inset-0 bg-black/90 flex items-center justify-center z-[9999] p-4 sm:p-6"
      onClick={onClose}
    >
      <div 
        className="relative bg-black w-full max-w-[400px] aspect-[9/16] max-h-[95vh] rounded-2xl shadow-2xl overflow-hidden border border-white/10 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 bg-black/60 hover:bg-black text-white rounded-full p-2 z-20 transition-all border border-white/20"
        >
          <X size={24} />
        </button>
        
        <iframe
          width="100%"
          height="100%"
          src={videoUrl}
          title="YouTube video player"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="w-full h-full"
        ></iframe>
      </div>
    </div>,
    document.body
  );
};
