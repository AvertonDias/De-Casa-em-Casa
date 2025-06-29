
"use client";

import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { doc, getDoc, collection, query, orderBy, onSnapshot, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Search, ArrowUp, ArrowDown, ArrowLeft } from 'lucide-react';
import { AddCasaModal } from '@/components/AddCasaModal';
import { EditCasaModal } from '@/components/EditCasaModal';
import { useUser } from '@/contexts/UserContext';

interface Casa {
  id: string;
  number: string;
  status: boolean;
  observations: string;
  order: number;
}

interface Territory {
  name: string;
  number: string;
}

export default function QuadraDetailPage() {
  const { user, loading: userLoading } = useUser();
  const [territory, setTerritory] = useState<Territory | null>(null);
  const [quadraName, setQuadraName] = useState('');
  const [casas, setCasas] = useState<Casa[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isReordering, setIsReordering] = useState(false);
  const params = useParams<{ territoryId: string; quadraId: string }>();
  const { territoryId, quadraId } = params;

  useEffect(() => {
    if (userLoading) {
      return;
    }
    if (!user?.congregationId) {
        if(!userLoading) setLoading(false);
        return;
    }

    const territoryRef = doc(db, 'congregations', user.congregationId, 'territories', territoryId);
    const quadraRef = doc(territoryRef, 'quadras', quadraId);

    getDoc(territoryRef).then(snap => snap.exists() && setTerritory(snap.data() as Territory));
    getDoc(quadraRef).then(snap => snap.exists() && setQuadraName(snap.data().name));
    
    const casasRef = collection(quadraRef, 'casas');
    const q = query(casasRef, orderBy('order'));
    
    const unsubscribe = onSnapshot(q, (casasSnap) => {
      const fetchedCasas = casasSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Casa);
      setCasas(fetchedCasas);
      setLoading(false);
    }, (error) => {
      console.error("Erro ao ouvir as atualizações das casas:", error);
      setLoading(false);
    });

    return () => unsubscribe();
    
  }, [user, userLoading, territoryId, quadraId]);

  const stats = useMemo(() => {
    const total = casas.length;
    if (total === 0) return { total: 0, feitos: 0, pendentes: 0, progresso: 0 };

    const feitos = casas.filter(c => c.status).length;
    const pendentes = total - feitos;
    const progresso = Math.round((feitos / total) * 100);
    return { total, feitos, pendentes, progresso };
  }, [casas]);

  const handleReorder = async (casaId: string, direction: 'up' | 'down') => {
    const congregationId = user!.congregationId!;
    const originalCasas = [...casas];
    const currentIndex = originalCasas.findIndex(c => c.id === casaId);
    if (currentIndex === -1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= originalCasas.length) return;

    const reorderedCasas = [...originalCasas];
    const [movedItem] = reorderedCasas.splice(currentIndex, 1);
    reorderedCasas.splice(newIndex, 0, movedItem);

    setCasas(reorderedCasas);

    const batch = writeBatch(db);
    reorderedCasas.forEach((casa, index) => {
      const casaRef = doc(db, 'congregations', congregationId, 'territories', territoryId, 'quadras', quadraId, 'casas', casa.id);
      batch.update(casaRef, { order: index }); 
    });

    try {
      await batch.commit();
    } catch (error)      {
      console.error("Falha ao reordenar:", error);
      setCasas(originalCasas);
    }
  };

  const handleStatusChange = async (casaId: string, currentStatus: boolean) => {
    const congregationId = user!.congregationId!;
    const newStatus = !currentStatus;
    try {
        const casaRef = doc(db, 'congregations', congregationId, 'territories', territoryId, 'quadras', quadraId, 'casas', casaId);
        await updateDoc(casaRef, { status: newStatus });
    } catch (error) {
        console.error("Erro ao atualizar status:", error);
    }
  };

  const filteredCasas = casas.filter(c => 
    c.number.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.observations.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (userLoading || loading) {
    return <div className="text-center text-gray-500 dark:text-gray-400">Carregando...</div>;
  }

  if (!user || !user.congregationId) {
    return <div className="text-center p-10 text-red-500">Erro: Usuário não associado a uma congregação. Contate o administrador.</div>;
  }

  return (
    <div className="min-h-full">
      <div className="mb-6">
        <Link href={`/dashboard/territorios/${territoryId}`} className="text-sm text-blue-600 hover:text-blue-800 dark:text-purple-400 dark:hover:text-purple-300 flex items-center mb-2">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar para {territory?.name || 'Território'}
        </Link>
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
          {quadraName || 'Detalhes da Quadra'}
        </h1>
      </div>
      
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        <input
          type="text"
          placeholder="Buscar por número ou observações..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-white dark:bg-[#2f2b3a] dark:text-white dark:placeholder-gray-400 border border-gray-300 dark:border-gray-700 rounded-lg pl-12 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-purple-500"
          disabled={isReordering}
        />
      </div>

      <div className="bg-white dark:bg-[#2f2b3a] p-4 rounded-lg shadow-md mb-6">
        <div className="grid grid-cols-4 divide-x divide-gray-200 dark:divide-gray-700 text-center">
          <div><p className="text-gray-500 dark:text-gray-400 text-sm">Total</p><p className="text-2xl font-bold text-gray-800 dark:text-white">{stats.total}</p></div>
          <div><p className="text-gray-500 dark:text-gray-400 text-sm">Feitos</p><p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.feitos}</p></div>
          <div><p className="text-gray-500 dark:text-gray-400 text-sm">Pendentes</p><p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.pendentes}</p></div>
          <div><p className="text-gray-500 dark:text-gray-400 text-sm">Progresso</p><p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.progresso}%</p></div>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mt-4">
          <div className="bg-blue-600 dark:bg-blue-400 h-2.5 rounded-full" style={{ width: `${stats.progresso}%` }}></div>
        </div>
      </div>
      
      <div className="bg-white dark:bg-[#2f2b3a] rounded-lg shadow-md overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
            <AddCasaModal territoryId={territoryId} quadraId={quadraId} onCasaAdded={() => {}} congregationId={user.congregationId} />
            <button 
                onClick={() => setIsReordering(!isReordering)}
                disabled={searchTerm !== '' || casas.length < 2}
                className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed dark:disabled:bg-gray-800 dark:disabled:text-gray-500 ${
                    isReordering 
                    ? 'bg-green-600 hover:bg-green-700 text-white' 
                    : 'bg-blue-100 hover:bg-blue-200 text-blue-800 dark:bg-purple-900/50 dark:hover:bg-purple-900/70 dark:text-purple-300'
                }`}
                title={searchTerm !== '' ? "Limpe a busca para reordenar" : ""}
            >
                {isReordering ? 'Concluir Reordenação' : 'Reordenar'}
            </button>
        </div>

        <div>
            {filteredCasas.length > 0 ? filteredCasas.map((casa, index) => (
                <div
                    key={casa.id}
                    className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 last:border-b-0"
                >
                    <div className="flex items-center space-x-4 min-w-0">
                        <input
                            type="checkbox"
                            checked={casa.status}
                            onChange={() => handleStatusChange(casa.id, casa.status)}
                            className="flex-shrink-0 h-6 w-6 rounded border-gray-300 dark:border-gray-600 text-purple-600 focus:ring-purple-500"
                            disabled={isReordering}
                        />
                        <div className="min-w-0 flex-1">
                            <p className="font-bold text-lg text-gray-800 dark:text-white truncate">
                                {casa.number}
                            </p>
                            {casa.observations && (
                                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                                {casa.observations}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="flex-shrink-0 pl-4">
                        {isReordering ? (
                        <div className="flex flex-col items-center space-y-1">
                            <button onClick={() => handleReorder(casa.id, 'up')} disabled={index === 0} className="p-1 disabled:opacity-20 text-blue-500 dark:text-blue-400">
                            <ArrowUp size={22} />
                            </button>
                            <button onClick={() => handleReorder(casa.id, 'down')} disabled={index === filteredCasas.length - 1} className="p-1 disabled:opacity-20 text-blue-500 dark:text-blue-400">
                            <ArrowDown size={22} />
                            </button>
                        </div>
                        ) : (
                          user?.congregationId && (
                            <EditCasaModal casa={casa} territoryId={territoryId} quadraId={quadraId} onCasaUpdated={() => {}} congregationId={user.congregationId} />
                          )
                        )}
                    </div>
                </div>
            )) : (
                <p className="text-center text-gray-500 dark:text-gray-400 py-8">Nenhum registro encontrado</p>
            )}
        </div>
      </div>
    </div>
  );
}
