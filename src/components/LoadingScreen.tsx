
"use client";

import Image from 'next/image';

// Simplificamos o componente para não precisar mais da prop 'isSyncing'
export function LoadingScreen() {
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
            <div className="w-full max-w-xs space-y-3">
                <div className="relative w-full h-2 overflow-hidden rounded-full bg-primary/20">
                    <div 
                        className="absolute top-0 left-0 h-full w-full animate-indeterminate-progress"
                        style={{
                            backgroundImage: 'linear-gradient(to right, transparent 0%, hsl(var(--primary)) 50%, transparent 100%)',
                            backgroundSize: '200% 100%',
                        }}
                    />
                </div>
                <p className="text-center text-sm text-muted-foreground">Carregando...</p>
            </div>
        </div>
    );
}
