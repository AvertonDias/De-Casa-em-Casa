
"use client";

import { useUser } from "@/contexts/UserContext";
import { Wine, Newspaper, Sparkles } from "lucide-react";

// Componente para o ícone de estádio (Congresso) - Representação de arena/estádio
const StadiumIcon = ({ className }: { className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width="16" 
    height="16" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
    aria-hidden="true"
  >
    <path d="M12 21c-5.5 0-10-2.2-10-5V8c0-2.8 4.5-5 10-5s10 2.2 10 5v8c0 2.8-4.5 5-10 5Z" />
    <path d="M12 16c-3.3 0-6-1.3-6-3V8c0-1.7 2.7-3 6-3s6 1.3 6 3v5c0 1.7-2.7 3-6 3Z" />
    <path d="M2 8c0 2.8 4.5 5 10 5s10-2.2 10-5" />
  </svg>
);

export function CampaignBanner() {
  const { congregation } = useUser();
  const campaign = congregation?.activeCampaign;

  if (!campaign) return null;

  const getCampaignIcon = () => {
    switch (campaign.type) {
      case 'congress':
        return <StadiumIcon className="animate-pulse" />;
      case 'memorial':
        return <Wine size={16} className="animate-pulse" />;
      case 'other':
        return <Newspaper size={16} className="animate-pulse" />;
      default:
        return <Sparkles size={16} className="animate-pulse" />;
    }
  };

  const Icon = getCampaignIcon();

  return (
    <div className="bg-primary/95 text-primary-foreground py-2 px-4 flex items-center justify-center gap-3 shadow-md animate-in slide-in-from-top duration-300">
      {Icon}
      <div className="flex items-center gap-1.5 overflow-hidden">
        <span className="text-[10px] font-black uppercase tracking-widest opacity-80 whitespace-nowrap">Campanha Ativa:</span>
        <span className="font-bold text-sm truncate">{campaign.title}</span>
      </div>
      {Icon}
    </div>
  );
}
