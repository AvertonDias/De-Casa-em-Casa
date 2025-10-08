
"use client";

import React from 'react';
import { GoogleMap, useJsApiLoader } from '@react-google-maps/api';

const containerStyle = {
  width: '100%',
  height: '100%',
  minHeight: '350px',
  borderRadius: '0.5rem',
};

const defaultCenter = {
  lat: -23.5505,
  lng: -46.6333
};

interface GoogleMapEmbedProps {
  mapLink?: string;
}

const getMapMid = (originalUrl?: string) => {
    if (!originalUrl) return null;
    try {
        const url = new URL(originalUrl);
        return url.searchParams.get('mid');
    } catch (e) {
        return null;
    }
};

export function GoogleMapEmbed({ mapLink }: GoogleMapEmbedProps) {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  });

  const mapId = getMapMid(mapLink);

  if (!mapLink || !mapId) {
    return <div className="flex items-center justify-center h-full"><p className="text-muted-foreground">Nenhum mapa disponível.</p></div>;
  }
  
  return isLoaded ? (
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={defaultCenter}
        zoom={8}
        options={{
            mapId: mapId,
            disableDefaultUI: true,
            zoomControl: true,
        }}
      />
  ) : <div className="flex items-center justify-center h-full"><p className="text-muted-foreground">Carregando mapa...</p></div>
}
