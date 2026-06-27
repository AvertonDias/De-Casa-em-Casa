
"use client";

import { useUser } from "@/contexts/UserContext";
import { Wine, Newspaper, Sparkles } from "lucide-react";

// Componente para o ícone de estádio (Congresso)
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
    <path d="M12 2c5.5 0 10 2 10 4.5s-4.5 4.5-10 4.5-10-2-10-4.5S6.5 2 12 2Z"/>
    <path d="M22 6.5v11c0 2.5-4.5 4.5-10 4.5s-10-2-10-4.5v-11"/>
    <path d="M2 12c0 2.5 4.5 4.5 10 4.5s10-2 10-4.5"/>
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
