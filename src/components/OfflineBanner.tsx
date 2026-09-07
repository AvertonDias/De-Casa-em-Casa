"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;

    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="bg-destructive text-destructive-foreground text-xs py-1 px-4 text-center font-medium flex items-center justify-center gap-2 animate-in slide-in-from-top duration-300">
      <WifiOff className="h-3.5 w-3.5" />
      <span>Você está sem conexão com a internet. O aplicativo está funcionando no modo offline.</span>
    </div>
  );
}
