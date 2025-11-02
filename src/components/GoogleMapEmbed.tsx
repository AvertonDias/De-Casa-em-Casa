
"use client";

import React from 'react';

// Estilo para o container do iframe
const containerStyle = {
  width: '100%',
  height: '100%',
  minHeight: '350px',
  borderRadius: '0.5rem',
};

interface GoogleMapEmbedProps {
  mapLink?: string;
}

// Função para extrair o 'mid' (ID do mapa) da URL original do Google My Maps
const getMapMid = (originalUrl?: string): string | null => {
    if (!originalUrl) return null;
    try {
        const url = new URL(originalUrl);
        // O ID do mapa está no parâmetro 'mid'
        return url.searchParams.get('mid');
    } catch (e) {
        console.error("URL do mapa inválida:", e);
        return null;
    }
};

export function GoogleMapEmbed({ mapLink }: GoogleMapEmbedProps) {
  const mapId = getMapMid(mapLink);

  // Se não houver link ou ID do mapa, exibe uma mensagem
  if (!mapLink || !mapId) {
    return (
        <div style={containerStyle} className="flex items-center justify-center bg-muted rounded-lg">
            <p className="text-muted-foreground">Nenhum mapa disponível ou link inválido.</p>
        </div>
    );
  }
  
  // Constrói a URL para a API de Incorporação do Google Maps para My Maps
  const embedUrl = `https://www.google.com/maps/d/embed?mid=${mapId}`;

  return (
    <iframe
      style={containerStyle}
      width="100%"
      height="100%"
      loading="lazy"
      allowFullScreen
      src={embedUrl}
      title="Mapa do Território"
      className="border-0 rounded-lg"
    ></iframe>
  );
}
