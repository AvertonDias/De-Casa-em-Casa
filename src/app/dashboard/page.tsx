"use client";

import { useState, useEffect } from 'react';
import { useUser } from '@/contexts/UserContext';
import { Users, Map, Home, CheckSquare, Building } from 'lucide-react';
import { useRouter } from 'next/navigation';

// O StatCard não muda, continua igual
interface StatCardProps {
  icon: React.ElementType;
  title: string;
  value: number | string;
  loading: boolean;
}

function StatCard({ icon: Icon, title, value, loading }: StatCardProps) {
  return (
    <div className="bg-white dark:bg-[#2a2736] p-6 rounded-lg shadow-md flex items-center">
      <div className="bg-purple-600/20 text-purple-500 p-3 rounded-full mr-4">
        <Icon size={24} />
      </div>
      <div>
        <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium">{title}</h3>
        {loading ? (
          <div className="h-7 w-12 bg-gray-300 dark:bg-gray-600 rounded-md animate-pulse mt-1"></div>
        ) : (
          <p className="text-2xl font-bold text-gray-800 dark:text-white">{value}</p>
        )}
      </div>
    </div>
  );
}


// --- PÁGINA PRINCIPAL MINIMALISTA ---
export default function DashboardPage() {
  const { user, loading: userLoading } = useUser();
  const router = useRouter();

  // Vamos desativar o useEffect que busca dados por enquanto.
  /*
  useEffect(() => {
    // TODAS AS CONSULTAS AO FIREBASE ESTÃO DESATIVADAS NESTA VERSÃO
  }, [user, userLoading]);
  */

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">Painel de Controle</h1>
      <p className="text-gray-500 dark:text-gray-400 mb-8">
        {user ? `Bem-vindo, ${user.name}!` : "Carregando informações do usuário..."}
      </p>

      {/* Exibimos os cards com valores zerados e sem estado de carregamento */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard icon={Map} title="Total de Territórios" value={0} loading={false} />
        <StatCard icon={Building} title="Quadras Registradas" value={0} loading={false} />
        <StatCard icon={Home} title="Casas Mapeadas" value={0} loading={false} />
        <StatCard icon={CheckSquare} title="Casas Visitadas" value={0} loading={false} />
      </div>
      
      {/* A lista de territórios recentes também fica vazia */}
      <div className="bg-white dark:bg-[#2a2736] p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Territórios Recentemente Trabalhados</h2>
        <p className="text-gray-500 dark:text-gray-400">A busca por dados está temporariamente desativada para depuração.</p>
      </div>
    </div>
  );
}
