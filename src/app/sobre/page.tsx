"use client";

import { useState, useEffect, ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Check, Users2, MapPin, BarChart2, Tv, Shield, Zap, PlayCircle, Home, Waypoints, Settings, LogOut, Share2 } from 'lucide-react';

// ========================================================================
//   1. COMPONENTES MODULARES (Definidos Completamente, Fora da Página)
// ========================================================================

const Header = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  useEffect(() => {
    const handleScroll = () => { setIsScrolled(window.scrollY > 10); };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  return (
    <header className={`sticky top-0 z-50 w-full transition-all duration-300 ${isScrolled ? 'border-b border-border bg-background/80 backdrop-blur-sm' : ''}`}>
      <div className="container mx-auto h-20 flex items-center justify-between px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/icon-192x192.png" alt="Logo" width={32} height={32} />
          <span className="font-bold text-lg">De Casa em Casa</span>
        </Link>
        <Button asChild><Link href="/login">Acessar Painel</Link></Button>
      </div>
    </header>
  );
};

const FeatureSection = ({ title, imageUrl, children, reverse = false, onVideoClick }: { title: ReactNode; imageUrl: string; children: ReactNode; reverse?: boolean; onVideoClick?: () => void; }) => (
  <div className={`flex flex-col md:flex-row items-center gap-12 ${reverse ? 'md:flex-row-reverse' : ''}`}>
    <div className="md:w-1/2">
      <h2 className="text-3xl font-bold mb-4">{title}</h2>
      <div className="prose prose-invert max-w-none text-muted-foreground">{children}</div>
      {onVideoClick && (
          <Button onClick={onVideoClick} variant="outline" className="mt-6">
              <PlayCircle size={18} className="mr-2"/> Ver Vídeo da Seção
          </Button>
      )}
    </div>
    <div className="md:w-1/2">
      <Image src={imageUrl} alt={typeof title === 'string' ? title : 'Feature'} width={1200} height={900} className="rounded-lg shadow-2xl" />
    </div>
  </div>
);

const VideoModal = ({ isOpen, onClose, videoUrl }: { isOpen: boolean; onClose: () => void; videoUrl: string; }) => {
  if (!isOpen) return null;
  return (
    <div onClick={onClose} className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-4xl aspect-video bg-black rounded-lg shadow-2xl">
        <iframe width="100%" height="100%" src={videoUrl} title="Tutorial De Casa em Casa" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen className="rounded-lg"></iframe>
      </div>
    </div>
  );
};

// ========================================================================
//   2. PÁGINA PRINCIPAL
// ========================================================================
export default function SobrePage() {
  const [videoModalUrl, setVideoModalUrl] = useState<string | null>(null);
  const handlePlayVideo = (videoId: string) => { const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&controls=0&rel=0`; setVideoModalUrl(embedUrl); };

  return (
    <>
      <div className="bg-background text-foreground">
        <Header />
        <main>
          {/* Seção 1: Introdução */}
          <section className="text-center py-20 md:py-32 px-4">
             <h1 className="text-4xl md:text-6xl font-bold mb-4 tracking-tighter">Gerenciamento de Territórios, <br/><span className="text-primary">elevado a outro nível.</span></h1>
             <p className="max-w-2xl mx-auto text-lg text-muted-foreground mb-8">Diga adeus aos mapas de papel e às planilhas complicadas. O "De Casa em Casa" centraliza e automatiza a organização dos territórios da sua congregação.</p>
             <div className="mt-12 container max-w-5xl mx-auto">
               <Image src="https://placehold.co/1200x675/1e1b29/ffffff?text=Visual+do+App" alt="Dashboard do De Casa em Casa" width={1200} height={675} className="rounded-xl shadow-2xl" />
             </div>
          </section>

          {/* Seções de Funcionalidades baseadas no seu Roteiro */}
          <section className="container mx-auto py-20 px-4 md:px-6 space-y-24">
            
            <FeatureSection
              title={<>O Primeiro <span className="text-primary">Acesso</span></>}
              imageUrl="https://placehold.co/1200x900/2a2736/ffffff?text=Acesso+e+Cadastro"
              onVideoClick={() => handlePlayVideo("ID_DO_SEU_VIDEO_DE_ACESSO")}
            >
              <p>O processo foi desenhado para ser intuitivo. Administradores registram a congregação, e publicadores solicitam acesso, que é aprovado por um dirigente, garantindo que apenas os membros corretos tenham acesso.</p>
            </FeatureSection>
            
            <FeatureSection
              title={<>Painel de Controle <span className="text-primary">Inteligente</span></>}
              imageUrl="https://placehold.co/1200x900/2a2736/ffffff?text=Dashboard+com+Stats"
              reverse={true}
              onVideoClick={() => handlePlayVideo("ID_DO_SEU_VIDEO_DO_PAINEL")}
            >
              <p>Admins e Dirigentes têm uma visão geral com estatísticas em tempo real: total de territórios, casas visitadas e os trabalhos mais recentes. A visão do Publicador é limpa e focada nas suas tarefas.</p>
            </FeatureSection>
            
            <FeatureSection
              title={<>Territórios <span className="text-primary">Urbanos</span> e <span className="text-primary">Rurais</span></>}
              imageUrl="https://placehold.co/1200x900/2a2736/ffffff?text=Gerenciamento+de+Territórios"
              onVideoClick={() => handlePlayVideo("ID_DO_SEU_VIDEO_DE_TERRITORIOS")}
            >
              <p>Adicione quadras, mapeie as casas e marque o trabalho com um clique. Para territórios rurais, use um diário de bordo digital. Tudo atualizado para todos instantaneamente.</p>
            </FeatureSection>

            <FeatureSection
              title={<>Gerenciamento de <span className="text-primary">Usuários</span></>}
              imageUrl="https://placehold.co/1200x900/2a2736/ffffff?text=Gestão+de+Usuários"
              reverse={true}
              onVideoClick={() => handlePlayVideo("ID_DO_SEU_VIDEO_DE_USUARIOS")}
            >
              <p>Aprove novos usuários pendentes com um clique, promova publicadores a dirigentes ou administradores, e mantenha a lista de membros sempre atualizada e segura.</p>
            </FeatureSection>

          </section>
          
          {/* Seção Final de CTA com Vídeo Completo */}
          <section className="bg-card">
            <div className="container mx-auto py-20 px-4 md:px-6 text-center">
              <h2 className="text-3xl font-bold">Pronto para organizar seus territórios?</h2>
              <p className="text-muted-foreground mt-2 mb-8">Veja o tutorial completo e comece hoje mesmo. É gratuito.</p>
              <div className="flex justify-center gap-4">
                  <Button asChild size="lg"><Link href="/login">Criar Conta ou Acessar</Link></Button>
                  <Button onClick={() => handlePlayVideo("ID_DO_SEU_VIDEO_COMPLETO")} size="lg" variant="outline">
                      <PlayCircle size={18} className="mr-2"/> Ver Tutorial Completo
                  </Button>
              </div>
            </div>
          </section>

        </main>
        <footer className="border-t">
          <div className="container mx-auto py-8 px-4 md:px-6 text-center text-muted-foreground"><p>© {new Date().getFullYear()} De Casa em Casa.</p></div>
        </footer>
      </div>
      
      <VideoModal isOpen={!!videoModalUrl} onClose={() => setVideoModalUrl(null)} videoUrl={videoModalUrl || ''} />
    </>
  );
}