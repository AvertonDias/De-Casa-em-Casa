"use client";

import { X } from 'lucide-react';

interface VideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string;
}

export const VideoModal = ({ isOpen, onClose, videoUrl }: VideoModalProps) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div 
        className="relative bg-black w-full max-w-4xl aspect-video rounded-lg shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute -top-10 right-0 text-white hover:text-gray-300 z-10">
          <X size={32} />
        </button>
        <iframe
          width="100%"
          height="100%"
          src={videoUrl}
          title="YouTube video player"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="rounded-lg"
        ></iframe>
      </div>
    </div>
  );
};
