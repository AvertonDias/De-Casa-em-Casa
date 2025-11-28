"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Progress } from '@/components/ui/progress';

export function LoadingScreen() {
    const [progress, setProgress] = useState(13);

    useEffect(() => {
        // Simula um progresso de carregamento contínuo.
        const timer = setInterval(() => {
            setProgress((prevProgress) => {
                if (prevProgress >= 90) {
                    clearInterval(timer);
                    return 90;
                }
                return prevProgress + 5;
            });
        }, 200); // A cada 200ms, aumenta o progresso.

        return () => {
            clearInterval(timer);
        };
    }, []);

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
