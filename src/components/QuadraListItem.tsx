"use client";

import { Quadra } from "@/types/types";
import { ChevronRight } from 'lucide-react';

interface QuadraListItemProps {
  quadra: Quadra;
}

export default function QuadraListItem({ quadra }: QuadraListItemProps) {
  return (
    <div className="flex items-center justify-between py-3 hover:bg-white/5 transition-colors cursor-pointer">
      <div>
        <h4 className="font-semibold text-base">{quadra.name || "Quadra sem nome"}</h4>
        <p className="text-sm text-muted-foreground">{quadra.description || "Sem descrição"}</p>
      </div>
      <ChevronRight className="text-muted-foreground h-5 w-5" />
    </div>
  );
}
