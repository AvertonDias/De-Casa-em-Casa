"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export function LoginForm() {
  const router = useRouter();
  const { toast } = useToast();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = formData.get("name") as string;
    
    toast({
      title: `Bem-vindo, ${name || 'Publicador'}!`,
      description: "Você foi conectado com sucesso.",
    });
    router.push("/dashboard");
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="congregation-number">Número da Congregação</Label>
        <Input
          id="congregation-number"
          name="congregation-number"
          type="text"
          placeholder="Ex: 12345"
          required
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="name">Seu Nome</Label>
        <Input
          id="name"
          name="name"
          type="text"
          placeholder="Ex: João da Silva"
          required
        />
      </div>
      <Button type="submit" className="w-full mt-2">
        Entrar
      </Button>
    </form>
  );
}
