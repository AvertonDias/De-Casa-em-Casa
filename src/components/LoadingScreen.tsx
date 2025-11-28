
"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Progress } from '@/components/ui/progress';

export function LoadingScreen() {
    const [progress, setProgress] = useState(10);

    useEffect(() => {
        // Esta é uma animação de progresso simulada.
        // Ela não representa o progresso real do carregamento.
        const timer = setTimeout(() => {
            const newProgress = progress < 90 ? progress + Math.random() * 20 : 90;
            setProgress(newProgress);
        }, 500);
        return () => clearTimeout(timer);
    }, [progress]);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground">
            <Image
                src="/images/Logo_v3.png"
                alt="Logo De Casa em Casa"
                width={100}
                height={100}
                className="rounded-2xl mb-6"
                priority
            />
            <div className="w-full max-w-xs">
                <Progress value={progress} className="w-full h-2" />
                <p className="text-center text-sm text-muted-foreground mt-3">Carregando seus dados...</p>
            </div>
        </div>
    );
}
