"use client";

import { useState, useEffect } from 'react';
import { useUser } from '@/contexts/UserContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { Shield, User, MoreVertical, Loader } from 'lucide-react';

// Você pode já ter essa interface, mas vamos garantir
interface AppUser {
  uid: string;
  name: string;
  role: 'Administrador' | 'Dirigente' | 'Publicador';
  status: 'ativo' | 'pendente' | 'inativo';
}

export default function UsersPage() {
  const { user: currentUser, loading: userLoading } = useUser();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // --- MUDANÇA CRÍTICA AQUI ---
    // Apenas tentamos buscar dados se o usuário logado tiver a permissão necessária.
    if (currentUser && ['Administrador', 'Dirigente'].includes(currentUser.role)) {
      
      const usersCollectionRef = collection(db, 'users');
      
      // Criamos uma consulta segura que busca APENAS os usuários da MESMA congregação.
      const q = query(usersCollectionRef, where("congregationId", "==", currentUser.congregationId));
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const usersData = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() })) as AppUser[];
        setUsers(usersData);
        setLoading(false);
      }, (error) => {
        // Log de erro para depuração, caso ainda haja algum problema.
        console.error("Erro no listener da lista de usuários:", error);
        setLoading(false);
      });

      return () => unsubscribe();
    } else if (!userLoading) {
      // Se o usuário terminou de carregar e não tem permissão, apenas paramos o loading.
      setLoading(false);
    }
  }, [currentUser, userLoading]); // Dependências do useEffect

  // --- MUDANÇA CRÍTICA AQUI ---
  // Guard Clause: Bloqueia a renderização da página para quem não tem permissão.
  if (userLoading || loading) {
    return <div className="flex justify-center items-center h-full"><Loader className="animate-spin" /></div>;
  }

  if (!currentUser || !['Administrador', 'Dirigente'].includes(currentUser.role)) {
    return (
      <div className="text-center p-10">
        <h1 className="text-2xl font-bold">Acesso Negado</h1>
        <p>Você não tem permissão para visualizar esta página.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Gerenciamento de Usuários</h1>
        {currentUser.role === 'Administrador' && (
          <button className="px-4 py-2 bg-purple-600 text-white rounded-lg">
            + Adicionar Usuário
          </button>
        )}
      </div>
      
      {/* Aqui vai a sua lista/tabela de usuários */}
      <div className="bg-white dark:bg-[#2a2736] rounded-lg shadow-md p-4">
        {users.map((user) => (
          <div key={user.uid} className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700 last:border-b-0">
            <span>{user.name}</span>
            <span className={`px-2 py-1 text-xs rounded-full ${user.role === 'Administrador' ? 'bg-purple-200 text-purple-800 dark:bg-purple-800 dark:text-purple-200' : 'bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200'}`}>
              {user.role}
            </span>
            <span className={`px-2 py-1 text-xs rounded-full ${user.status === 'ativo' ? 'bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-200' : 'bg-yellow-200 text-yellow-800 dark:bg-yellow-700 dark:text-yellow-100'}`}>
              {user.status}
            </span>
            <button className="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white"><MoreVertical size={20} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
