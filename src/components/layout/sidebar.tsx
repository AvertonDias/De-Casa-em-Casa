"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Map,
  Users,
  Settings,
  LogOut,
  ChevronFirst,
  ChevronLast,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { useState, createContext, useContext } from "react";

const navItems = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Territórios", href: "/dashboard/territorios", icon: Map },
  { name: "Usuários", href: "/dashboard/usuarios", icon: Users },
  { name: "Configurações", href: "/dashboard/configuracoes", icon: Settings },
];

const SidebarContext = createContext({ expanded: true });

export function Sidebar() {
  const [expanded, setExpanded] = useState(true);
  const pathname = usePathname();

  return (
    <aside className={`h-screen sticky top-0 ${expanded ? "w-64" : "w-20"} flex flex-col bg-card border-r transition-all duration-300`}>
      <div className="p-4 pb-2 flex justify-between items-center">
        <div className={`overflow-hidden transition-all ${expanded ? "w-40" : "w-0"}`}>
            <Logo />
        </div>
        <Button variant="ghost" size="icon" onClick={() => setExpanded((curr) => !curr)}>
          {expanded ? <ChevronFirst /> : <ChevronLast />}
        </Button>
      </div>

      <SidebarContext.Provider value={{ expanded }}>
        <ul className="flex-1 px-3">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <SidebarItem key={item.href} icon={<item.icon />} text={item.name} active={isActive} href={item.href} />
            )
          })}
        </ul>
      </SidebarContext.Provider>


      <div className="border-t flex p-3">
        <Avatar>
            <AvatarImage src="https://i.pravatar.cc/150?u=a042581f4e29026704d" />
            <AvatarFallback>CP</AvatarFallback>
        </Avatar>
        <div className={`flex justify-between items-center overflow-hidden transition-all ${expanded ? "w-52 ml-3" : "w-0"}`}>
            <div className="leading-4">
                <h4 className="font-semibold">Carlos Pereira</h4>
                <span className="text-xs text-muted-foreground">c.pereira@email.com</span>
            </div>
            <Link href="/" passHref>
                <Button variant="ghost" size="icon" aria-label="Logout">
                    <LogOut size={20} />
                </Button>
            </Link>
        </div>
      </div>
    </aside>
  );
}

function SidebarItem({ icon, text, active, href }: { icon: React.ReactNode, text: string, active: boolean, href: string }) {
    const { expanded } = useContext(SidebarContext);
    return (
        <Link href={href}>
            <li className={cn(
                "relative flex items-center py-2 px-3 my-1 font-medium rounded-md cursor-pointer transition-colors group",
                active ? "bg-primary/20 text-primary" : "hover:bg-secondary text-muted-foreground"
            )}>
                {icon}
                <span className={`overflow-hidden transition-all ${expanded ? "w-52 ml-3" : "w-0"}`}>{text}</span>

                {!expanded && (
                     <div className={`absolute left-full rounded-md px-2 py-1 ml-6 bg-card text-foreground text-sm invisible opacity-20 -translate-x-3 transition-all group-hover:visible group-hover:opacity-100 group-hover:translate-x-0`}>
                        {text}
                     </div>
                )}
            </li>
        </Link>
    )
}
