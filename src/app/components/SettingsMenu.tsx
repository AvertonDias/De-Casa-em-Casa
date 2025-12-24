
"use client";

import { useTheme } from 'next-themes';
import { useFontSize } from "@/contexts/FontSizeContext";
import { useUser } from '@/contexts/UserContext';
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Settings, Sun, Moon, Laptop, User, House, CaseUpper } from 'lucide-react';
import { Slider } from '@/components/ui/slider';

interface SettingsMenuProps {
  asButton?: boolean;
  onEditProfileClick: () => void;
  onEditCongregationClick: () => void;
}

export function SettingsMenu({ asButton = false, onEditProfileClick, onEditCongregationClick }: SettingsMenuProps) {
  const { setTheme, resolvedTheme } = useTheme();
  const { scale, setScale } = useFontSize();
  const { user } = useUser();

  const TriggerComponent = asButton ? (
    <Button variant="outline" className="w-full justify-center">
      <Settings className="h-5 w-5" />
      <span className="ml-2">Configurações</span>
    </Button>
  ) : (
    <Button variant="ghost" size="icon" className="rounded-full">
      <Settings className="h-5 w-5" />
      <span className="sr-only">Configurações</span>
    </Button>
  );

  const ThemeIcon = () => {
    if (resolvedTheme === 'dark') return <Moon />;
    return <Sun />;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {TriggerComponent}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64 p-2" align="end" forceMount>
          <DropdownMenuItem onClick={onEditProfileClick}>
            <User className="mr-2 h-4 w-4" />
            <span>Editar Perfil</span>
          </DropdownMenuItem>
          
          {user?.role === 'Administrador' && (
            <DropdownMenuItem onClick={onEditCongregationClick}>
              <House className="mr-2 h-4 w-4" />
              <span>Editar Congregação</span>
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          <Accordion type="multiple" className="w-full">
            <AccordionItem value="theme">
              <AccordionTrigger className="text-sm font-semibold px-2 py-1.5 rounded-sm hover:bg-accent hover:no-underline">
                <div className="flex items-center gap-2"><ThemeIcon /><span>Tema</span></div>
              </AccordionTrigger>
              <AccordionContent className="pt-2">
                <div className="pl-5">
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
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="font-size" className="border-b-0">
               <AccordionTrigger className="text-sm font-semibold px-2 py-1.5 rounded-sm hover:bg-accent hover:no-underline">
                 <div className="flex items-center gap-2"><CaseUpper /><span>Tamanho do Texto</span></div>
              </AccordionTrigger>
              <AccordionContent className="pt-4 pb-2 px-4">
                  <div className="flex items-center gap-4">
                      <span className="text-xs">A</span>
                      <Slider
                        value={[scale]}
                        onValueChange={(value) => setScale(value[0])}
                        min={0.8}
                        max={1.3}
                        step={0.1}
                      />
                      <span className="text-lg">A</span>
                  </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
