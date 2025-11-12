
"use client";

import { useState, ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Disclosure, Transition } from '@headlessui/react';
import { ChevronUp, ChevronsRight, LogIn, Map, Waypoints, Users, PlayCircle, Users2, SunMoon, ShieldCheck, Wifi, BarChart3 } from 'lucide-react';
import { VideoModal } from '@/components/VideoModal';

// ========================================================================
//   1. COMPONENTES MODULARES (Definidos Fora do Componente Principal)
// ========================================================================

const FeatureCard = ({ title, icon, children }: { title: string, icon: ReactNode, children: ReactNode }) => (
  <div className="bg-card p-6 rounded-lg border border-border shadow-sm h-full">
    <div className="flex items-center justify-center w-12 h-12 bg-primary/10 text-primary rounded-full mb-4">
      {icon}
    </div>
    <h3 className="text-xl font-bold mb-2">{title}</h3>
    <p className="text-muted-foreground">{children}</p>
  </div>
);

const TutorialSection = ({ title, icon, imageUrl, onVideoClick, children }: { 
    title: string;
    icon: ReactNode;
    imageUrl?: string; // Imagem agora é opcional
    onVideoClick?: () => void; // Função para tocar o vídeo
    children: ReactNode; 
}) => (
  <Disclosure as="div" className="mb-2">
    {({ open }) => (
      <div className="rounded-lg bg-card p-2">
        <Disclosure.Button className="flex w-full justify-between items-center rounded-lg px-4 py-3 text-left text-lg font-medium hover:bg-white/5 focus:outline-none focus-visible:ring focus-visible:ring-primary/75">
          <div className="flex items-center gap-4">{icon}<span>{title}</span></div>
          <ChevronUp className={`${open ? 'rotate-180 transform' : ''} h-5 w-5 text-primary transition-transform`} />
        </Disclosure.Button>
        <Transition enter="transition duration-100 ease-out" enterFrom="transform scale-95 opacity-0" enterTo="transform scale-100 opacity-100" leave="transition duration-75 ease-out" leaveFrom="transform scale-100 opacity-100" leaveTo="transform scale-95 opacity-0">
          <Disclosure.Panel className="px-4 pb-4 pt-4 text-base text-muted-foreground border-t border-border mt-2">
            <div className="flex flex-col md:flex-row gap-6">
              {/* Coluna do Texto e Vídeo */}
              <div className="prose prose-invert max-w-none prose-p:my-2">
                {children}
                {onVideoClick && (
                    <Button onClick={onVideoClick} variant="outline" size="sm" className="mt-4">
                        <PlayCircle size={16} className="mr-2"/> Ver Vídeo
                    </Button>
                )}
              </div>
              {/* Coluna da Imagem (opcional) */}
              {imageUrl && (
                  <div className="flex-shrink-0 md:w-1/3">
                      <Image src={imageUrl} alt={`Imagem para ${title}`} width={400} height={300} className="rounded-lg shadow-md" />
                  </div>
              )}
            </div>
          </Disclosure.Panel>
        </Transition>
      </div>
    )}
  </Disclosure>
);


// ========================================================================
//   2. PÁGINA PRINCIPAL (Com a Seção de Tutorial Completa)
// ========================================================================
export default function SobrePage() {
  const [videoModalUrl, setVideoModalUrl] = useState<string | null>(null);
  
  const handlePlayVideo = (videoId: string) => { 
    const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&controls=0&rel=0&modestbranding=1`;
    setVideoModalUrl(embedUrl); 
  };
  
  const handleCloseModal = () => { setVideoModalUrl(null); };

  return (
    <>
      <div className="bg-background text-foreground">
        <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur-sm">
           <div className="container mx-auto h-16 flex items-center justify-between px-4 md:px-6">
             <Link href="/" className="flex items-center gap-2"><Image src="/images/icon-512x512.jpg" alt="Logo" width={32} height={32} sizes="32px" className="rounded-md" /><span className="font-bold text-lg">De Casa em Casa</span></Link>
             <Button asChild><Link href="/">Acessar Painel</Link></Button>
           </div>
        </header>

        <main>
          {/* Hero Section */}
          <section className="text-center py-20 px-4">
            <h1 className="text-4xl md:text-6xl font-bold mb-4 tracking-tighter">
              A gestão de territórios, <span className="text-primary">finalmente simples.</span>
            </h1>
            <p className="max-w-2xl mx-auto text-lg text-muted-foreground mb-8">
              Diga adeus aos mapas de papel e às planilhas complicadas. O "De Casa em Casa" centraliza e automatiza a organização dos territórios da sua congregação.
            </p>
            <Button asChild size="lg"><Link href="/">Começar a Usar</Link></Button>
          </section>

          {/* Feature Grid */}
          <section id="features" className="container mx-auto py-20 px-4 md:px-6">
            <h2 className="text-3xl font-bold text-center mb-12">Funcionalidades Poderosas</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              <FeatureCard title="Perfis de Usuário" icon={<Users2 className="w-6 h-6" />}>Controle granular com perfis de Administrador, Dirigente e Publicador.</FeatureCard>
              <FeatureCard title="Territórios" icon={<Map className="w-6 h-6" />}>Gerencie territórios urbanos com quadras e rurais com diários de bordo.</FeatureCard>
              <FeatureCard title="Estatísticas" icon={<BarChart3 className="w-6 h-6" />}>Acompanhe o progresso com estatísticas atualizadas automaticamente.</FeatureCard>
              <FeatureCard title="Acesso Offline" icon={<Wifi className="w-6 h-6" />}>Instale o app e continue trabalhando mesmo sem conexão (PWA).</FeatureCard>
              <FeatureCard title="Segurança" icon={<ShieldCheck className="w-6 h-6" />}>Construído sobre a plataforma segura do Firebase com regras de acesso.</FeatureCard>
              <FeatureCard title="Interface Moderna" icon={<SunMoon className="w-6 h-6" />}>Tema claro e escuro e design responsivo para uma ótima experiência.</FeatureCard>
            </div>
          </section>
        
          {/* Tutorial Interativo com Placeholders */}
          <section id="tutorial" className="container mx-auto py-20 px-4 md:px-6">
            <h2 className="text-3xl font-bold text-center mb-12">Guia Rápido de Uso</h2>
            <div className="max-w-4xl mx-auto">
              
              <TutorialSection title="Introdução" icon={<ChevronsRight className="text-primary"/>} onVideoClick={() => handlePlayVideo("COLE_SEU_ID_AQUI")}>
                <p>Olá! Este aplicativo foi feito para você que quer organizar os territórios de forma mais eficiente.</p>
              </TutorialSection>
              
              <TutorialSection title="O Primeiro Acesso" icon={<LogIn className="text-primary"/>}
                imageUrl="/images/Tela+de+Login.jpg"
                onVideoClick={() => handlePlayVideo("COLE_SEU_ID_AQUI")}
              >
                <p><strong>Para Admins:</strong> Use o link "Comece aqui" para registrar sua congregação.</p>
                <p><strong>Para Publicadores:</strong> Use "Solicite seu acesso aqui" e insira o número da sua congregação.</p>
              </TutorialSection>
              
              <TutorialSection title="Territórios Urbanos" icon={<Map className="text-primary"/>}
                imageUrl="/tutorial/territorio-urbano.png"
                onVideoClick={() => handlePlayVideo("COLE_SEU_ID_AQUI")}
              >
                <p>Adicione quadras, insira os números das casas e marque a caixa ao visitar. Use "Reordenar" para ajustar a rota.</p>
              </TutorialSection>
              
              <TutorialSection title="Territórios Rurais" icon={<Waypoints className="text-primary"/>}
                imageUrl="/tutorial/territorio-rural.png"
                onVideoClick={() => handlePlayVideo("COLE_SEU_ID_AQUI")}
              >
                <p>Funciona como um diário de bordo. Adicione um novo registro com data e observações a cada trabalho.</p>
              </TutorialSection>
              
              <TutorialSection title="Gerenciamento de Usuários" icon={<Users className="text-primary"/>}
                imageUrl="/tutorial/usuarios.jpg"
                onVideoClick={() => handlePlayVideo("COLE_SEU_ID_AQUI")}
              >
                <p>Admins e Dirigentes podem aprovar novos membros e gerenciar seus perfis de acesso.</p>
              </TutorialSection>
          </div>
        </section>
        
        </main>
        
        {/* Footer */}
        <footer className="border-t">
            <div className="container mx-auto py-8 px-4 md:px-6 text-center text-muted-foreground"><p>© {new Date().getFullYear()} De Casa em Casa.</p></div>
        </footer>
      </div>

      <VideoModal 
        isOpen={!!videoModalUrl} 
        onClose={handleCloseModal} 
        videoUrl={videoModalUrl || ''}
      />
    </>
  );
}
