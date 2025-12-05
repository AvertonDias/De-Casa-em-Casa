"use client";

import { useTheme } from 'next-themes';
import { useFontSize } from "@/contexts/FontSizeContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import { Settings, Sun, Moon, Laptop, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface SettingsMenuProps {
  asButton?: boolean;
}

export function SettingsMenu({ asButton = false }: SettingsMenuProps) {
  const { setTheme } = useTheme();
  const { increaseFontSize, decreaseFontSize, resetFontSize } = useFontSize();

  const TriggerComponent = asButton ? (
    <Button variant="outline" className="w-full justify-center">
      <Settings className="mr-2" size={20} />
      Configurações
    </Button>
  ) : (
    <Button variant="ghost" size="icon" className="rounded-full">
      <Settings className="h-5 w-5" />
      <span className="sr-only">Configurações</span>
    </Button>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {TriggerComponent}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Sun className="mr-2 h-4 w-4" />
            <span>Tema</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent>
              <DropdownMenuItem onClick={() => setTheme("light")}>
                <Sun className="mr-2 h-4 w-4" />
                <span>Claro</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("dark")}>
                <Moon className="mr-2 h-4 w-4" />
                <span>Escuro</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("system")}>
                <Laptop className="mr-2 h-4 w-4" />
                <span>Padrão do dispositivo</span>
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <ZoomIn className="mr-2 h-4 w-4" />
            <span>Tamanho do Texto</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent>
              <DropdownMenuItem onClick={increaseFontSize}>
                <ZoomIn className="mr-2 h-4 w-4" /> Aumentar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={decreaseFontSize}>
                <ZoomOut className="mr-2 h-4 w-4" /> Diminuir
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={resetFontSize}>
                <RotateCcw className="mr-2 h-4 w-4" /> Restaurar
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
