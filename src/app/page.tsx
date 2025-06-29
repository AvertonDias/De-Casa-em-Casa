"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInAnonymously } from "firebase/auth";
import { collection, query, where, getDocs, setDoc, doc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import Link from "next/link";

export default function EntryPage() {
  const [congregationNumber, setCongregationNumber] = useState("");
  const [userName, setUserName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (!userName.trim() || !congregationNumber.trim()) {
        setError("Por favor, preencha seu nome e o número da congregação.");
        setIsLoading(false);
        return;
    }

    try {
      // 1. Verifica se a congregação existe
      const congregationsRef = collection(db, "congregations");
      const q = query(congregationsRef, where("number", "==", congregationNumber.trim()));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        // CENÁRIO A: Congregação EXISTE -> Cria Publicador
        const userCredential = await signInAnonymously(auth);
        const congregationDoc = querySnapshot.docs[0];
        
        // Usa setDoc com o UID do usuário anônimo como ID do documento
        await setDoc(doc(db, "users", userCredential.user.uid), {
          name: userName.trim(),
          role: "Publicador",
          congregationId: congregationDoc.id,
        });

        router.push("/dashboard");

      } else {
        // CENÁRIO B: Congregação NÃO EXISTE -> Redireciona para Cadastro de Admin
        const params = new URLSearchParams({
          number: congregationNumber.trim(),
          name: userName.trim()
        }).toString();
        router.push(`/cadastro?${params}`);
      }
    } catch (err) {
      console.error("Erro na entrada:", err);
      setError("Ocorreu um erro. Verifique sua conexão e tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };
  
  const inputClasses = "w-full px-3 py-2 text-gray-800 dark:text-white bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md";

  return (
    <div className="flex items-center justify-center min-h-screen bg-white dark:bg-[#1e1b29]">
      <div className="w-full max-w-md p-8 space-y-6 bg-gray-50 dark:bg-[#2f2b3a] rounded-xl shadow-2xl">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Bem-vindo ao De Casa em Casa</h1>
          <p className="text-center text-sm text-gray-600 dark:text-gray-400">Insira seu nome e o número da sua congregação.</p>
        </div>
        
        <form onSubmit={handleEntry} className="space-y-4">
          <input type="text" placeholder="Seu Nome" value={userName} onChange={e => setUserName(e.target.value)} required className={inputClasses}/>
          <input type="tel" inputMode="numeric" pattern="[0-9]*" placeholder="Número da Congregação" value={congregationNumber} onChange={e => setCongregationNumber(e.target.value.replace(/\D/g, ''))} required className={inputClasses}/>
          
          {error && <p className="text-sm text-center text-red-500">{error}</p>}
          
          <button type="submit" disabled={isLoading} className="w-full px-4 py-2 font-semibold text-white bg-purple-600 rounded-md shadow-lg hover:bg-purple-700 disabled:bg-purple-800 disabled:cursor-not-allowed">
            {isLoading ? 'Verificando...' : 'Entrar'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-600 dark:text-gray-400">
          É um administrador? <Link href="/login" className="font-medium text-purple-600 hover:underline">Faça login aqui</Link>
        </p>
      </div>
    </div>
  );
}
