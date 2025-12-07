
"use client";

import { useState, useEffect, useRef, WheelEvent } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImagePreviewModalProps {
  isOpen: boolean;
  imageUrl: string | null;
  onClose: () => void;
}

const getDistance = (touches: React.TouchList) => {
  return Math.hypot(
    touches[0].clientX - touches[1].clientX,
    touches[0].clientY - touches[1].clientY
  );
};

export default function ImagePreviewModal({ isOpen, imageUrl, onClose }: ImagePreviewModalProps) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);
  const lastMousePosition = useRef({ x: 0, y: 0 });
  const initialPinchDistance = useRef<number | null>(null);

  // Reseta o estado quando o modal abre ou a imagem muda
  useEffect(() => {
    if (isOpen) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
  }, [isOpen, imageUrl]);

  // Gerenciador do botão "voltar" do navegador
  useEffect(() => {
    const handlePopState = () => {
      if (isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      window.history.pushState({ modalOpen: true }, '');
      window.addEventListener('popstate', handlePopState);
    } else if (window.history.state?.modalOpen) {
      // Este caso pode não ser necessário dependendo de como o ShadCN gerencia o popstate
    }

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isOpen, onClose]);

  const handleZoom = (direction: 'in' | 'out') => {
    setScale(prevScale => {
      const newScale = direction === 'in' ? prevScale * 1.2 : prevScale / 1.2;
      return Math.max(0.5, Math.min(newScale, 5)); // Limites de zoom
    });
  };

  const handleReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };
  
  // Funções para arrastar a imagem (mouse)
  const handleMouseDown = (e: React.MouseEvent<HTMLImageElement>) => {
    e.preventDefault();
    if (scale > 1) {
        setIsDragging(true);
        lastMousePosition.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging && imageRef.current) {
        const dx = e.clientX - lastMousePosition.current.x;
        const dy = e.clientY - lastMousePosition.current.y;
        lastMousePosition.current = { x: e.clientX, y: e.clientY };
        setPosition(prev => ({ x: prev.x + dx, y: prev.y + dy }));
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };
  
  const handleWheel = (e: WheelEvent<HTMLImageElement>) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      handleZoom('in');
    } else {
      handleZoom('out');
    }
  };

  // Funções de toque para pinça e arrastar
  const handleTouchStart = (e: React.TouchEvent<HTMLImageElement>) => {
    if (e.touches.length === 2) {
        initialPinchDistance.current = getDistance(e.touches);
    } else if (e.touches.length === 1 && scale > 1) {
        lastMousePosition.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        setIsDragging(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLImageElement>) => {
      if (e.touches.length === 2 && initialPinchDistance.current !== null) {
        const newDistance = getDistance(e.touches);
        const scaleFactor = newDistance / initialPinchDistance.current;
        setScale(prevScale => Math.max(0.5, Math.min(prevScale * scaleFactor, 5)));
        initialPinchDistance.current = newDistance; // Atualiza a distância para o próximo movimento
      } else if (e.touches.length === 1 && isDragging) {
        const dx = e.touches[0].clientX - lastMousePosition.current.x;
        const dy = e.touches[0].clientY - lastMousePosition.current.y;
        lastMousePosition.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        setPosition(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      }
  };

  const handleTouchEnd = () => {
      setIsDragging(false);
      initialPinchDistance.current = null;
  };

  if (!isOpen || !imageUrl) return null;

  return (
    <div 
      onClick={onClose} 
      className="fixed inset-0 bg-black/80 flex justify-center items-center z-50 p-4 transition-opacity duration-300 overflow-hidden"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="absolute bottom-4 flex items-center gap-2 bg-gray-800/70 p-2 rounded-lg z-10"
      >
        <button onClick={() => handleZoom('out')} className="p-2 text-white hover:bg-white/20 rounded-md"><ZoomOut size={24} /></button>
        <button onClick={handleReset} className="p-2 text-white hover:bg-white/20 rounded-md"><RotateCcw size={20} /></button>
        <button onClick={() => handleZoom('in')} className="p-2 text-white hover:bg-white/20 rounded-md"><ZoomIn size={24} /></button>
      </div>

      <button onClick={onClose} className="absolute top-4 right-4 text-white hover:text-gray-300 z-10">
        <X size={32} />
      </button>

      <div 
        onClick={(e) => e.stopPropagation()}
        className="relative w-full h-full flex items-center justify-center"
      >
        <img 
          ref={imageRef}
          src={imageUrl} 
          alt="Preview do Cartão em tela cheia" 
          className={cn(
            "object-contain transition-transform duration-200",
            scale > 1 ? 'cursor-grab' : 'cursor-default',
            isDragging && 'cursor-grabbing'
          )}
          style={{ 
            transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
            maxWidth: '100%',
            maxHeight: '100%',
          }}
          onMouseDown={handleMouseDown}
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        />
      </div>
    </div>
  );
}
