
"use client";

import { useUser } from "@/contexts/UserContext";
import { Milestone, Sparkles } from "lucide-react";

export function CampaignBanner() {
  const { congregation } = useUser();
  const campaign = congregation?.activeCampaign;

  if (!campaign) return null;

  return (
    <div className="bg-primary/95 text-primary-foreground py-2 px-4 flex items-center justify-center gap-3 shadow-md animate-in slide-in-from-top duration-300">
      <Sparkles size={16} className="animate-pulse" />
      <div className="flex items-center gap-1.5 overflow-hidden">
        <span className="text-[10px] font-black uppercase tracking-widest opacity-80 whitespace-nowrap">Campanha Ativa:</span>
        <span className="font-bold text-sm truncate">{campaign.title}</span>
      </div>
      <Milestone size={16} className="opacity-80" />
    </div>
  );
}
