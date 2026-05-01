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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {TUTORIAL_LIST.map((tutorial) => (
          <div 
            key={tutorial.id} 
            className="bg-card border border-border/50 rounded-xl p-5 shadow-sm hover:shadow-md hover:border-primary/30 transition-all group cursor-pointer flex items-start gap-4"
            onClick={() => setSelectedVideoId(tutorial.id)}
          >
            <div className="bg-green-500/10 p-2.5 rounded-full shrink-0 group-hover:bg-green-500/20 transition-colors">
              <PlayCircle className="text-green-600 dark:text-green-500 h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-lg leading-tight group-hover:text-primary transition-colors">
                {tutorial.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {tutorial.description}
              </p>
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