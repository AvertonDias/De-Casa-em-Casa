
"use client";

import { useEffect, useRef, useState } from "react";
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

  /* ======================
     DETECÇÃO DE TOUCH
     ====================== */
  const isTouch =
    typeof window !== "undefined" &&
    ("ontouchstart" in window || navigator.maxTouchPoints > 0);

  /* ======================
     STATES
     ====================== */
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const dragStart = useRef({ x: 0, y: 0 });
  const lastPosition = useRef({ x: 0, y: 0 });

  const lastTap = useRef(0);
  const initialDistance = useRef(0);

  /* ======================
     RESET AO ABRIR
     ====================== */
  useEffect(() => {
    if (isOpen) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
      lastPosition.current = { x: 0, y: 0 };
    }
  }, [isOpen]);

  if (!isOpen || !imageUrl) return null;

  /* ======================
     DRAG (CORRIGIDO)
     ====================== */
  const startDrag = (x: number, y: number) => {
    if (scale <= 1) return;
    setIsDragging(true);
    dragStart.current = { x, y };
  };

  const moveDrag = (x: number, y: number) => {
    if (!isDragging) return;

    const deltaX = x - dragStart.current.x;
    const deltaY = y - dragStart.current.y;

    const adjusted = isTouch
      ? {
          x: lastPosition.current.x + deltaY,
          y: lastPosition.current.y - deltaX,
        }
      : {
          x: lastPosition.current.x + deltaX,
          y: lastPosition.current.y + deltaY,
        };

    setPosition(adjusted);
  };

  const endDrag = () => {
    setIsDragging(false);
    lastPosition.current = position;
  };

  /* ======================
     TOUCH: DUPLO TOQUE + PINÇA
     ====================== */
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      startDrag(e.touches[0].clientX, e.touches[0].clientY);

      const now = Date.now();
      if (now - lastTap.current < 300) {
        const newScale = scale === 1 ? 2 : 1;
        setScale(newScale);
        setPosition({ x: 0, y: 0 });
        lastPosition.current = { x: 0, y: 0 };
      }
      lastTap.current = now;
    }

    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      initialDistance.current = Math.hypot(dx, dy);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      moveDrag(e.touches[0].clientX, e.touches[0].clientY);
    }

    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const distance = Math.hypot(dx, dy);

      setScale(prev =>
        Math.max(1, Math.min(prev * (distance / initialDistance.current), 4))
      );

      initialDistance.current = distance;
    }
  };

  /* ======================
     SCROLL NO PC
     ====================== */
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setScale(prev =>
      Math.max(1, Math.min(prev - e.deltaY * 0.001, 4))
    );
  };

  /* ======================
     RENDER
     ====================== */
  return (
    <div className="fixed inset-0 z-50 bg-black">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-50 text-white"
      >
        <X size={32} />
      </button>

      <div
        className="absolute flex items-center justify-center overflow-hidden touch-none"
        style={{
          top: "50%",
          left: "50%",
          width: isTouch ? "100vh" : "100vw",
          height: isTouch ? "100vw" : "100vh",
          transform: isTouch
            ? "translate(-50%, -50%) rotate(90deg)"
            : "translate(-50%, -50%)",
        }}
        onMouseDown={e => startDrag(e.clientX, e.clientY)}
        onMouseMove={e => moveDrag(e.clientX, e.clientY)}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={endDrag}
        onWheel={handleWheel}
      >
        <img
          src={imageUrl}
          alt="Imagem ampliada"
          draggable={false}
          className="object-contain select-none"
          style={{
            maxWidth: "100%",
            maxHeight: "100%",
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transition: isDragging ? "none" : "transform 0.15s ease-out",
            cursor: scale > 1 ? "grab" : "default",
          }}
        />
      </div>
    </div>
  );
}
