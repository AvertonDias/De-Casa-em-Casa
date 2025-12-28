
"use client";

import { useState, ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ChevronUp, ChevronsRight, LogIn, Map, Waypoints, Users, PlayCircle, Users2, SunMoon, ShieldCheck, Wifi, BarChart3, HelpCircle } from 'lucide-react';
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
  <Accordion type="single" collapsible className="mb-2 bg-card rounded-lg p-1">
    <AccordionItem value="item-1" className="border-b-0">
      <AccordionTrigger className="flex w-full justify-between items-center rounded-lg px-4 py-3 text-left text-lg font-medium hover:bg-white/5 focus:outline-none focus-visible:ring focus-visible:ring-primary/75 hover:no-underline">
        <div className="flex items-center gap-4">{icon}<span>{title}</span></div>
      </AccordionTrigger>
      <AccordionContent>
          <div className="px-4 pb-4 pt-2 text-base text-muted-foreground border-t border-border mt-2">
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
          </div>
      </AccordionContent>
    </AccordionItem>
  </Accordion>
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
             <Link href="/" className="flex items-center gap-2"><Image src="/images/Logo_v3.png" alt="Logo" width={32} height={32} className="rounded-md" priority /><span className="font-bold text-lg">De Casa em Casa</span></Link>
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

        {/* FAQ Section */}
        <section id="faq" className="container mx-auto py-20 px-4 md:px-6">
          <h2 className="text-3xl font-bold text-center mb-12">Perguntas Frequentes</h2>
          <div className="max-w-4xl mx-auto">
            <Accordion type="single" collapsible className="w-full space-y-3">
              
              <AccordionItem value="item-1" className="bg-card rounded-lg border px-2">
                <AccordionTrigger className="text-left font-semibold text-lg hover:no-underline">Como faço para me cadastrar se minha congregação já usa o sistema?</AccordionTrigger>
                <AccordionContent className="pt-2 text-base">
                  Na tela inicial, clique em "Solicite seu acesso aqui". Preencha seus dados e, o mais importante, insira o número correto da sua congregação. Sua solicitação será enviada para aprovação de um dirigente ou administrador.
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="item-2" className="bg-card rounded-lg border px-2">
                <AccordionTrigger className="text-left font-semibold text-lg hover:no-underline">O aplicativo funciona sem internet?</AccordionTrigger>
                <AccordionContent className="pt-2 text-base">
                  Sim! O aplicativo foi projetado para funcionar offline. Você pode acessar seus territórios designados, marcar casas e fazer anotações mesmo sem conexão. Assim que você estiver online novamente, suas alterações serão sincronizadas automaticamente com a nuvem.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-3" className="bg-card rounded-lg border px-2">
                <AccordionTrigger className="text-left font-semibold text-lg hover:no-underline">Quem pode ver os dados e o progresso dos territórios?</AccordionTrigger>
                <AccordionContent className="pt-2 text-base">
                  Apenas os membros aprovados da sua congregação podem ver os dados. O progresso de um território (casas feitas, etc.) é visível para todos da congregação em tempo real, promovendo a colaboração. Apenas Administradores e Dirigentes podem ver e gerenciar a lista completa de usuários.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-4" className="bg-card rounded-lg border px-2">
                <AccordionTrigger className="text-left font-semibold text-lg hover:no-underline">Como a ordem das casas na rua é definida?</AccordionTrigger>
                <AccordionContent className="pt-2 text-base">
                  Ao entrar em uma quadra, você pode usar o botão "Reordenar". Isso permite que você arraste e solte as casas na sequência exata do seu percurso, facilitando o trabalho no campo.
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="item-5" className="bg-card rounded-lg border px-2">
                <AccordionTrigger className="text-left font-semibold text-lg hover:no-underline">Qual a diferença entre território "Urbano" e "Rural"?</AccordionTrigger>
                <AccordionContent className="pt-2 text-base">
                  Territórios <strong>Urbanos</strong> são baseados em quadras e casas/números, onde cada casa é marcada individualmente. Territórios <strong>Rurais</strong> funcionam como um "diário de bordo", onde o trabalho é registrado com uma data e uma observação geral a cada visita, sem uma lista fixa de casas.
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="item-6" className="bg-card rounded-lg border px-2">
                <AccordionTrigger className="text-left font-semibold text-lg hover:no-underline">Esqueci minha senha. Como posso recuperá-la?</AccordionTrigger>
                <AccordionContent className="pt-2 text-base">
                  Na tela de login, clique em "Esqueceu a senha?". Você precisará inserir o e-mail que usou para se cadastrar. Se o e-mail estiver correto, você receberá um link para criar uma nova senha. Lembre-se de verificar sua caixa de spam!
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="item-7" className="bg-card rounded-lg border px-2">
                <AccordionTrigger className="text-left font-semibold text-lg hover:no-underline">O que são os diferentes perfis de usuário (Publicador, Dirigente, Admin)?</AccordionTrigger>
                <AccordionContent className="pt-2 text-base">
                  Cada perfil tem permissões diferentes: <br/>• <strong>Publicador:</strong> Pode ver e trabalhar os territórios que lhe são designados. <br/>• <strong>Servo de Territórios:</strong> Pode ver todos os territórios e gerenciar as designações. <br/>• <strong>Dirigente:</strong> Tem as mesmas permissões do Servo de Territórios e também pode aprovar novos usuários. <br/>• <strong>Administrador:</strong> Tem acesso total, incluindo a edição de dados da congregação e a promoção de outros usuários.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-8" className="bg-card rounded-lg border px-2">
                <AccordionTrigger className="text-left font-semibold text-lg hover:no-underline">Como instalo o aplicativo no meu celular ou computador?</AccordionTrigger>
                <AccordionContent className="pt-2 text-base">
                  No menu lateral (ou em Configurações), você encontrará um botão "Instalar App". Se não o vir, seu navegador pode oferecer a opção "Adicionar à Tela de Início" no menu de compartilhamento (iOS/Safari) ou no menu principal do navegador (Chrome/Android). A instalação permite acesso rápido e uma melhor experiência offline.
                </AccordionContent>
              </AccordionItem>

            </Accordion>
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
