'use client';

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';

export function FirebaseErrorListener() {
  useEffect(() => {
    errorEmitter.on('permission-error', (error) => {
      // Lança o erro para que seja capturado pelo overlay de desenvolvimento do Next.js
      throw error;
    });
  }, []);

  return null;
}
