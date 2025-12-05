
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

const FONT_SIZE_KEY = 'app-font-size-scale';
const MIN_SCALE = 0.8;
const MAX_SCALE = 1.3;
const STEP = 0.1;

interface FontSizeContextType {
  scale: number;
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
  const [scale, setScale] = useState(1.0);

  useEffect(() => {
    const savedScale = localStorage.getItem(FONT_SIZE_KEY);
    if (savedScale) {
      setScale(parseFloat(savedScale));
    }
  }, []);

  useEffect(() => {
    document.documentElement.style.fontSize = `${scale * 100}%`;
    localStorage.setItem(FONT_SIZE_KEY, scale.toString());
  }, [scale]);

  const increaseFontSize = useCallback(() => {
    setScale(prevScale => Math.min(prevScale + STEP, MAX_SCALE));
  }, []);

  const decreaseFontSize = useCallback(() => {
    setScale(prevScale => Math.max(prevScale - STEP, MIN_SCALE));
  }, []);

  const resetFontSize = useCallback(() => {
    setScale(1.0);
  }, []);

  const value = {
    scale,
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
