
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

const FONT_SIZE_KEY = 'app-font-size-scale';
const MIN_SCALE = 0.8;
const MAX_SCALE = 1.3;
const STEP = 0.1;

interface FontSizeContextType {
  scale: number;
  setScale: (newScale: number) => void;
  increaseFontSize: () => void;
  decreaseFontSize: () => void;
  resetFontSize: () => void;
}

const FontSizeContext = createContext<FontSizeContextType | undefined>(undefined);

export const useFontSize = () => {
  const context = useContext(FontSizeContext);
  if (!context) {
    throw new Error('useFontSize must be used within a FontSizeProvider');
  }
  return context;
};

export const FontSizeProvider = ({ children }: { children: ReactNode }) => {
  const [scale, setScaleState] = useState(1.0);
  const [isLoaded, setIsLoaded] = useState(false);

  // Efeito para carregar a escala salva do localStorage APENAS no lado do cliente
  useEffect(() => {
    const savedScale = localStorage.getItem(FONT_SIZE_KEY);
    if (savedScale) {
      setScaleState(parseFloat(savedScale));
    }
    setIsLoaded(true); // Marca que o carregamento inicial do cliente foi concluído
  }, []);

  // Efeito para aplicar a escala ao HTML e salvar no localStorage sempre que ela mudar
  useEffect(() => {
    // Só executa se já tiver carregado o estado do cliente para evitar sobrescrever
    // o valor padrão (1.0) antes de ler o valor salvo.
    if (isLoaded) {
      document.documentElement.style.fontSize = `${scale * 100}%`;
      localStorage.setItem(FONT_SIZE_KEY, scale.toString());
    }
  }, [scale, isLoaded]);
  
  const setScale = useCallback((newScale: number) => {
    const clampedScale = Math.max(MIN_SCALE, Math.min(newScale, MAX_SCALE));
    setScaleState(clampedScale);
  }, []);

  const increaseFontSize = useCallback(() => {
    setScaleState(prevScale => Math.min(prevScale + STEP, MAX_SCALE));
  }, []);

  const decreaseFontSize = useCallback(() => {
    setScaleState(prevScale => Math.max(prevScale - STEP, MIN_SCALE));
  }, []);

  const resetFontSize = useCallback(() => {
    setScaleState(1.0);
  }, []);

  const value = {
    scale,
    setScale,
    increaseFontSize,
    decreaseFontSize,
    resetFontSize,
  };

  return (
    <FontSizeContext.Provider value={value}>
      {children}
    </FontSizeContext.Provider>
  );
};
