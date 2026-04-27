"use client";

import { useState } from 'react';
import { PlayCircle } from 'lucide-react';
import { VideoModal } from './VideoModal';
import { getTutorialUrl } from '@/lib/tutorials';
import { cn } from '@/lib/utils';

interface TutorialButtonProps {
  videoId: string;
  label?: string;
  className?: string;
  iconOnly?: boolean;
}

export function TutorialButton({ videoId, label = "Ver Tutorial", className, iconOnly = false }: TutorialButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!videoId) return null;

  return (
    <>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(true);
        }}
        className={cn(
          "inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary/80 transition-colors uppercase tracking-wider",
          className
        )}
        title={label}
      >
        <PlayCircle size={iconOnly ? 20 : 16} className="shrink-0" />
        {!iconOnly && <span>{label}</span>}
      </button>

      <VideoModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        videoUrl={getTutorialUrl(videoId)}
      />
    </>
  );
}
