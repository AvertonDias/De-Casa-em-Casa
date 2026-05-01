"use client";

import { TUTORIAL_LIST } from '@/lib/tutorials';
import { PlayCircle } from 'lucide-react';
import { useState } from 'react';
import { VideoModal } from '@/components/VideoModal';
import { getTutorialUrl } from '@/lib/tutorials';
import withAuth from '@/components/withAuth';

function TutoriaisPage() {
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Tutoriais em Vídeo</h1>
        <p className="text-muted-foreground text-lg">Aprenda a usar as principais funções do De Casa em Casa.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {TUTORIAL_LIST.map((tutorial) => (
          <div 
            key={tutorial.id} 
            className="bg-card border border-border/50 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all group cursor-pointer"
            onClick={() => setSelectedVideoId(tutorial.id)}
          >
            <div className="aspect-[16/9] bg-muted flex items-center justify-center relative">
              <img 
                src={`https://img.youtube.com/vi/${tutorial.id}/mqdefault.jpg`} 
                alt={tutorial.title}
                className="w-full h-full object-cover opacity-60 group-hover:opacity-40 transition-opacity"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                 <div className="bg-primary/20 p-4 rounded-full group-hover:bg-primary/40 transition-colors">
                    <PlayCircle size={48} className="text-primary group-hover:scale-110 transition-transform" />
                 </div>
              </div>
            </div>
            <div className="p-5 space-y-2">
              <h3 className="font-bold text-lg leading-tight group-hover:text-primary transition-colors">{tutorial.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{tutorial.description}</p>
            </div>
          </div>
        ))}
      </div>

      <VideoModal
        isOpen={!!selectedVideoId}
        onClose={() => setSelectedVideoId(null)}
        videoUrl={selectedVideoId ? getTutorialUrl(selectedVideoId) : ''}
      />
    </div>
  );
}

export default withAuth(TutoriaisPage);
