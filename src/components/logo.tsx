import { MapPinned } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ className, textClassName }: { className?: string; textClassName?: string }) {
  return (
    <div className={cn("flex items-center gap-2 font-headline text-white", className)}>
      <div className="bg-primary/20 p-2 rounded-lg">
        <MapPinned className="h-5 w-5 text-primary" />
      </div>
      <span className={cn("text-lg font-bold", textClassName)}>
        De Casa em Casa
      </span>
    </div>
  );
}
