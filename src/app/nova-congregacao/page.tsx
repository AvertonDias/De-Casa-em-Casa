"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

// Aponta para a função 'createCongregationAndAdmin' no backend
const createCongregationAndAdminFunction = httpsCallable(functions, 'createCongregationAndAdmin');

export default function NewCongregationPage() {
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [congregationName, setCongregationName] = useState('');
  const [congregationNumber, setCongregationNumber] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (adminPassword !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }
    if (adminPassword.length < 6) {
        setError("A senha precisa ter pelo menos 6 caracteres.");
        return;
    }

    setLoading(true);
    
    try {
      // Chama a Cloud Function com os dados do formulário
      await createCongregationAndAdminFunction({
        adminName,
        adminEmail,
        adminPassword,
        congregationName,
        congregationNumber
      });
      
      toast({
          title: "Congregação criada com sucesso!",
          description: "Você será redirecionado para fazer o login."
      });
      
      router.push('/');

    } catch (err: any) {
      console.error("ERRO DETALHADO NA CRIAÇÃO:", err);
      // Trata erros específicos da Cloud Function
      if (err.code === 'functions/already-exists') {
        setError("Este e-mail de administrador já está em uso.");
      } else if (err.code === 'functions/invalid-argument') {
        setError("Todos os campos são obrigatórios. Verifique o preenchimento.");
      } else {
        setError("Ocorreu um erro ao criar a congregação. Tente novamente.");
      }
    } finally {
        setLoading(false);
    }
  };
  
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="w-full max-w-lg p-8 space-y-6 bg-card text-card-foreground rounded-xl shadow-lg">
        <div className="text-center">
            <h1 className="text-3xl font-bold">Criar uma Nova Congregação</h1>
            <p className="text-muted-foreground mt-2">Você será o administrador principal.</p>
        </div>
        <form onSubmit={handleCreate} className="space-y-6">
            <fieldset className="border border-input p-4 rounded-md">
                <legend className="px-2 text-lg font-semibold text-primary">Dados da Congregação</legend>
                <div className="space-y-4 pt-2">
                    <input type="text" value={congregationName} onChange={e => setCongregationName(e.target.value)} placeholder="Nome da Congregação (Ex: Central)" required className="w-full px-4 py-2 bg-background border border-input rounded-md" />
                    <input type="tel" inputMode="numeric" value={congregationNumber} onChange={e => setCongregationNumber(e.target.value.replace(/\D/g, ''))} placeholder="Número da Congregação (Ex: 13607)" required className="w-full px-4 py-2 bg-background border border-input rounded-md" />
                </div>
            </fieldset>

            <fieldset className="border border-input p-4 rounded-md">
                <legend className="px-2 text-lg font-semibold text-primary">Seus Dados</legend>
                <div className="space-y-4 pt-2">
                    <input type="text" value={adminName} onChange={e => setAdminName(e.target.value)} placeholder="Seu Nome Completo" required className="w-full px-4 py-2 bg-background border border-input rounded-md" />
                    <input type="email" value={adminEmail} onChange={e => setEmail(e.target.value)} placeholder="Seu E-mail" required className="w-full px-4 py-2 bg-background border border-input rounded-md" />

                    <div className="relative">
                        <input type={showPassword ? 'text' : 'password'} value={adminPassword} onChange={e => setAdminPassword(e.target.value)} placeholder="Sua Senha (mín. 6 caracteres)" required className="w-full px-4 py-2 bg-background border border-input rounded-md pr-10"/>
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 px-3 text-muted-foreground">
                           {showPassword ? <EyeOff size={20}/> : <Eye size={20}/>}
                        </button>
                    </div>

                    <div className="relative">
                        <input type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirme sua Senha" required className="w-full px-4 py-2 bg-background border border-input rounded-md pr-10"/>
                        <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute inset-y-0 right-0 px-3 text-muted-foreground">
                           {showConfirmPassword ? <EyeOff size={20}/> : <Eye size={20}/>}
                        </button>
                    </div>
                </div>
            </fieldset>

            {error && <p className="text-destructive text-sm text-center">{error}</p>}
            <button type="submit" disabled={loading} className="w-full px-4 py-3 font-semibold text-primary-foreground bg-primary rounded-md hover:bg-primary/90 disabled:opacity-50">
                {loading ? 'Criando...' : 'Criar Congregação'}
            </button>
        </form>
        <div className="text-center text-sm">
             <Link href="/" className="text-muted-foreground hover:text-primary">Já tem uma congregação? Faça login</Link>
         </div>
      </div>
    </div>
  );
}
