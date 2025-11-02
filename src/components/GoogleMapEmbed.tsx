
"use client";

import React from 'react';
import { Button } from './ui/button';
import { Map } from 'lucide-react';

interface GoogleMapEmbedProps {
  mapLink?: string;
}

export function GoogleMapEmbed({ mapLink }: GoogleMapEmbedProps) {
  if (!mapLink) {
    return (
      <div className="flex items-center justify-center h-full bg-muted rounded-lg">
        <p className="text-muted-foreground">Nenhum mapa disponível.</p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-full bg-muted rounded-lg">
        <Button 
            onClick={() => window.open(mapLink, '_blank')}
            variant="outline"
            className="w-full h-full text-lg"
        >
            <Map className="mr-2" />
            Abrir Mapa em Nova Aba
        </Button>
    </div>
  );
}
