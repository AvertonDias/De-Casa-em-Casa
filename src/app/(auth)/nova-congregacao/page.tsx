
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Loader } from "lucide-react";

export default function NovaCongregacaoPage() {
    const [adminName, setAdminName] = useState('');
    const [adminEmail, setAdminEmail] = useState('');
    const [adminPassword, setAdminPassword] = useState('');
    const [congregationName, setCongregationName] = useState('');
    const [congregationNumber, setCongregationNumber] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const router = useRouter();
    const { toast } = useToast();

    const handleCreateCongregation = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setErrorMessage('');

        try {
            const functionUrl = "https://southamerica-east1-appterritorios-e5bb5.cloudfunctions.net/createCongregationAndAdmin";

            const response = await fetch(functionUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    adminName: adminName.trim(),
                    adminEmail: adminEmail.trim(),
                    adminPassword: adminPassword.trim(),
                    congregationName: congregationName.trim(),
                    congregationNumber: congregationNumber.trim()
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Erro desconhecido');
            }
            
            toast({
                title: "Congregação Criada!",
                description: result.message || "Agora acesse o painel com seu novo usuário.",
            });
            router.push("/login");

        } catch (error: any) {
            console.error("Erro na criação:", error);
            setErrorMessage(error.message || "Erro inesperado ao criar congregação. Tente novamente mais tarde.");
        } finally {
            setIsLoading(false);
        }
      };
  
    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-100 dark:bg-gray-900">
            <div className="w-full max-w-md p-8 space-y-6 bg-white dark:bg-card rounded-lg shadow-lg">
              <div className="flex flex-col items-center">
                  <Link href="/" className="flex items-center gap-2">
                      <Image
                          src="/icon-192x192.png"
                          alt="Logo"
                          width={80}
                          height={80}
                          className="mb-4 rounded-lg"
                          priority
                      />
                  </Link>
                  <h1 className="font-bold text-3xl">De Casa em Casa</h1>
                  <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">
                    Configure sua congregação e o primeiro administrador
                  </p>
              </div>

              <form onSubmit={handleCreateCongregation} className="space-y-4">
                  <div>
                      <Label htmlFor="congregationName">Nome da Congregação</Label>
                      <Input type="text" id="congregationName" value={congregationName} onChange={(e) => setCongregationName(e.target.value)} required className="mt-1" />
                  </div>
                  <div>
                      <Label htmlFor="congregationNumber">Número da Congregação</Label>
                      <Input type="number" id="congregationNumber" value={congregationNumber} onChange={(e) => setCongregationNumber(e.target.value)} required className="mt-1" />
                  </div>

                  <h3 className="text-lg font-semibold text-foreground pt-4 border-t border-border">Seus Dados</h3>
                  <div>
                      <Label htmlFor="adminName">Seu nome completo</Label>
                      <Input type="text" id="adminName" value={adminName} onChange={(e) => setAdminName(e.target.value)} required className="mt-1" />
                  </div>
                  <div>
                      <Label htmlFor="adminEmail">Seu e-mail</Label>
                      <Input type="email" id="adminEmail" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} required className="mt-1" />
                  </div>
                  <div>
                      <Label htmlFor="adminPassword">Senha (mínimo 6 caracteres)</Label>
                      <Input type="password" id="adminPassword" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} required minLength={6} className="mt-1" />
                  </div>

                  {errorMessage && (
                      <div className="text-red-500 text-sm text-center pt-2">{errorMessage}</div>
                  )}

                  <Button
                      type="submit"
                      disabled={isLoading}
                      className="w-full"
                  >
                      {isLoading ? (
                          <>
                              <Loader className="mr-2 h-4 w-4 animate-spin" />
                              Criando...
                          </>
                      ) : (
                          "Criar Congregação"
                      )}
                  </Button>
              </form>

              <div className="text-center text-sm">
                  <Link href="/" className="text-primary hover:underline">
                      Já tem uma conta? Acesse o painel aqui
                  </Link>
              </div>
            </div>
        </div>
    )
}
