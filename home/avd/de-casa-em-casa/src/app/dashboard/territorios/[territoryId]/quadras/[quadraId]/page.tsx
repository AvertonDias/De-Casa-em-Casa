
"use client";

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { doc, getDoc, collection, query, orderBy, onSnapshot, updateDoc, writeBatch, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Search, ArrowUp, ArrowDown, ArrowLeft, Loader, Pencil } from 'lucide-react';
import { AddCasaModal } from '@/components/AddCasaModal';
import { EditCasaModal } from '@/components/EditCasaModal';
import { useUser } from '@/contexts/UserContext';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { type Casa, type Quadra, type Territory } from '@/types/types';
import withAuth from '@/components/withAuth';
import { useRouter } from 'next/navigation';
import React from 'react';

interface QuadraDetailPageProps {
  params: Promise<{
    territoryId: string;
    quadraId: string;
  }>;
}

function QuadraDetailPage({ params }: QuadraDetailPageProps) {
  const { user, loading: userLoading } = useUser();
  const resolvedParams = React.use(params);
  const { territoryId, quadraId } = resolvedParams;
  const [territory, setTerritory] = useState<Territory | null>(null);
  const [quadra, setQuadra] = useState<Quadra | null>(null);
  const [casas, setCasas] = useState<Casa[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isReordering, setIsReordering] = useState(false);
  const router = useRouter();
  

  // Estados para modais
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedCasa, setSelectedCasa] = useState<Casa | null>(null);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [casaToDelete, setCasaToDelete] = useState<Casa | null>(null);
  const [statusAction, setStatusAction] = useState<{ casaId: string; newStatus: boolean; } | null>(null);
  
  const [recentlyMovedId, setRecentlyMovedId] = useState<string | null>(null);
  const [highlightedHouseId, setHighlightedHouseId] = useState<string | null>(null);


  useEffect(() => {
    if (userLoading || !user?.congregationId || !territoryId || !quadraId) {
        if(!userLoading) setLoading(false);
        return;
    }

    const territoryRef = doc(db, 'congregations', user.congregationId, 'territories', territoryId);
    getDoc(territoryRef).then(snap => snap.exists() && setTerritory(snap.data() as Territory));

    const quadraPath = `congregations/${user.congregationId}/territories/${territoryId}/quadras/${quadraId}`;
    const quadraRef = doc(db, quadraPath);

    const unsubQuadra = onSnapshot(quadraRef, (docSnap) => {
      if (docSnap.exists()) {
        setQuadra(docSnap.data() as Quadra);
      } else {
        setQuadra(null);
      }
      setLoading(false);
    }, (error) => {
      console.error("Erro ao ouvir o documento da quadra:", error);
      setLoading(false);
    });
    
    const casasRef = collection(quadraRef, 'casas');
    const q = query(casasRef, orderBy('order'));
    
    const unsubCasas = onSnapshot(q, (casasSnap) => {
      if (!isReordering) {
        const fetchedCasas = casasSnap.docs.map(docSnap => ({
          id: docSnap.id,
          order: 0,
          status: false,
          ...docSnap.data(),
        })) as Casa[];
        setCasas(fetchedCasas);
      }
    }, (error) => {
      console.error("Erro ao ouvir as atualizações das casas:", error);
    });

    return () => {
      unsubQuadra();
      unsubCasas();
    };
  }, [user, userLoading, territoryId, quadraId, isReordering]);
  
  useEffect(() => {
    if (!loading && quadra === null) {
      setTimeout(() => {
        if (territoryId) {
            router.push(`/dashboard/territorios/${territoryId}`);
        } else {
            router.push('/dashboard/territorios');
        }
      }, 2000);
    }
  }, [loading, quadra, router, territoryId]);

  useEffect(() => {
    if (highlightedHouseId) {
      requestAnimationFrame(() => {
        const element = document.querySelector(`[data-id="${highlightedHouseId}"]`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('bg-primary/30', 'dark:bg-primary/50');
          setTimeout(() => {
            element.classList.remove('bg-primary/30', 'dark:bg-primary/50');
          }, 1500); 
        }
      });
      setHighlightedHouseId(null);
    }
  }, [highlightedHouseId]);

  const stats = {
      total: quadra?.totalHouses || 0,
      feitos: quadra?.housesDone || 0,
      pendentes: (quadra?.totalHouses || 0) - (quadra?.housesDone || 0),
      progresso: (quadra?.totalHouses || 0) > 0 ? Math.round(((quadra?.housesDone || 0) / (quadra?.totalHouses || 1)) * 100) : 0,
  }

  const handleReorder = (casaId: string, direction: 'up' | 'down') => {
    const currentIndex = casas.findIndex(c => c.id === casaId);
    if (currentIndex === -1) return;
    if ((direction === 'up' && currentIndex === 0) || (direction === 'down' && currentIndex === casas.length - 1)) return;
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    const reorderedCasas = [...casas];
    const [movedItem] = reorderedCasas.splice(currentIndex, 1);
    reorderedCasas.splice(newIndex, 0, movedItem);
    setRecentlyMovedId(movedItem.id);
    setCasas(reorderedCasas);
  };

  const handleToggleCheckbox = (casa: Casa) => {
    setStatusAction({ casaId: casa.id, newStatus: !casa.status });
  };
  
  const handleConfirmStatusChange = () => {
    if (!statusAction || !user?.congregationId || !territoryId || !quadraId) return;

    const { casaId, newStatus } = statusAction;
    const casaRef = doc(db, 'congregations', user.congregationId, 'territories', territoryId, 'quadras', quadraId, 'casas', casaId);
    
    const updateData: { status: boolean, lastWorkedBy?: { uid: string, name: string } } = { status: newStatus };
    if (newStatus === true) {
      updateData.lastWorkedBy = {
        uid: user.uid,
        name: user.name
      };
    }

    updateDoc(casaRef, updateData).catch(error => {
        console.error("Erro ao atualizar o status da casa em segundo plano:", error);
    });
    
    setStatusAction(null);
  };

  const handleEditClick = (casa: Casa) => {
    setSelectedCasa(casa);
    setIsEditModalOpen(true);
  };

  const handleDeleteRequestFromModal = (house: Casa) => {
    setCasaToDelete(house);
    setIsConfirmDeleteOpen(true);
  };

  const executeDelete = async () => {
    if (!casaToDelete || !user?.congregationId || !territoryId || !quadraId) return;

    const casaRef = doc(db, 'congregations', user.congregationId, 'territories', territoryId, 'quadras', quadraId, 'casas', casaToDelete.id);
    await deleteDoc(casaRef);
    
    setIsConfirmDeleteOpen(false);
    setCasaToDelete(null);
  };

  const handleHouseClick = (houseId: string) => {
    if (!searchTerm) return;
    setSearchTerm('');
    setHighlightedHouseId(houseId);
  };

  const filteredCasas = casas.filter(c => 
    c.number.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (c.observations && c.observations.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const finishReordering = async () => {
    if (!user?.congregationId || !territoryId || !quadraId) return;
    setLoading(true);

    const batch = writeBatch(db);
    casas.forEach((casa, index) => {
      const casaRef = doc(db, 'congregations', user.congregationId!, 'territories', territoryId, 'quadras', quadraId, 'casas', casa.id);
      batch.update(casaRef, { order: index }); 
    });

    try {
      await batch.commit();
    } catch (error)      {
      console.error("Falha ao reordenar:", error);
    } finally {
      setRecentlyMovedId(null);
      setIsReordering(false);
    }
  };

  const startReordering = () => {
    setIsReordering(true);
    setRecentlyMovedId(null);
  };

  
  if (userLoading || loading) {
    return <div className="flex items-center justify-center h-full"><Loader className="animate-spin text-purple-600" size={48} /></div>;
  }
  
  if (!quadra || !territoryId) {
    return (
        <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <h1 className="text-2xl font-bold text-destructive">Quadra Excluída</h1>
            <p className="text-muted-foreground mt-2">Esta quadra não existe mais. Você será redirecionado...</p>
        </div>
    );
  }

  if (!user || !user.congregationId) {
    return <div className="text-center p-10 text-red-500">Erro: Usuário não associado a uma congregação. Contate o administrador.</div>;
  }
  
  return (
    <>
      <div className="min-h-full">
        <div className="flex justify-between items-center mb-6">
            <div>
              <Link href={`/dashboard/territorios/${territoryId}`} className="text-sm text-blue-600 hover:text-blue-800 dark:text-purple-400 dark:hover:text-purple-300 flex items-center mb-2">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar para {territory ? `${territory.number} - ${territory.name}` : 'o Território'}
              </Link>
              <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
                {quadra.name || 'Detalhes da Quadra'}
              </h1>
            </div>
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

        <div className="flex justify-between items-center mb-4">
          {user.congregationId && <AddCasaModal territoryId={territoryId} quadraId={quadraId} onCasaAdded={() => {}} congregationId={user.congregationId} />}
          
          {isReordering ? (
              <button onClick={finishReordering} className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 text-sm">
                  Concluir Reordenação
              </button>
          ) : (
              <button 
                  onClick={startReordering}
                  disabled={searchTerm !== '' || casas.length < 2}
                  className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 text-sm disabled:bg-blue-900/50 disabled:cursor-not-allowed"
                  title={searchTerm !== '' ? "Limpe a busca para reordenar" : ""}
              >
                  Reordenar
              </button>
          )}
        </div>
        
        <div className="relative mb-4">
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

        <div className="bg-white dark:bg-[#2f2b3a] rounded-lg shadow-md overflow-hidden">
          <div>
              {filteredCasas.length > 0 ? filteredCasas.map((casa, index) => {
                  const isHighlighted = isReordering && casa.id === recentlyMovedId;
                  const baseBg = 'bg-transparent';
                  const highlightedBg = 'bg-purple-300 dark:bg-purple-900/60';

                  return (
                      <div
                          key={casa.id}
                          data-id={casa.id}
                          onClick={() => handleHouseClick(casa.id)}
                          className={`flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 last:border-b-0 transition-colors duration-300 ${isHighlighted ? highlightedBg : baseBg} ${searchTerm ? 'cursor-pointer hover:bg-purple-500/10 dark:hover:bg-purple-900/50' : ''}`}
                      >
                          <div className="flex items-center space-x-4 min-w-0">
                              {!isReordering && (
                                  <input
                                      type="checkbox"
                                      checked={casa.status}
                                      onChange={() => handleToggleCheckbox(casa)}
                                      className="flex-shrink-0 h-6 w-6 rounded border-gray-300 dark:border-gray-600 text-purple-600 focus:ring-purple-500 cursor-pointer"
                                  />
                              )}
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
                              <div className="flex flex-col items-center gap-1">
                                  <button onClick={() => handleReorder(casa.id, 'up')} disabled={index === 0} className="p-1 disabled:opacity-20 text-blue-500 dark:text-blue-400">
                                  <ArrowUp size={18} />
                                  </button>
                                  <button onClick={() => handleReorder(casa.id, 'down')} disabled={index === filteredCasas.length - 1} className="p-1 disabled:opacity-20 text-blue-500 dark:text-blue-400">
                                  <ArrowDown size={18} />
                                  </button>
                              </div>
                              ) : (
                                  <button onClick={() => handleEditClick(casa)} className="p-1 text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white" title="Editar Número">
                                      <Pencil className="h-4 w-4" />
                                  </button>
                              )}
                          </div>
                      </div>
                  )
              }) : (
                  <p className="text-center text-gray-500 dark:text-gray-400 py-8">Nenhum registro encontrado</p>
              )}
          </div>
        </div>
      </div>
      
      {selectedCasa && user.congregationId && territoryId && quadraId && (
        <EditCasaModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          casa={selectedCasa}
          territoryId={territoryId}
          quadraId={quadraId}
          onCasaUpdated={() => {}}
          congregationId={user.congregationId}
          onDeleteRequest={handleDeleteRequestFromModal}
        />
      )}

      {statusAction && (
        <ConfirmationModal
          isOpen={!!statusAction}
          onClose={() => setStatusAction(null)}
          onConfirm={handleConfirmStatusChange}
          title="Confirmar Alteração de Status"
          message={
            statusAction.newStatus
              ? `Tem certeza de que deseja marcar a casa "${casas.find(c => c.id === statusAction.casaId)?.number}" como trabalhada?`
              : `Tem certeza de que deseja desmarcar a casa "${casas.find(c => c.id === statusAction.casaId)?.number}" como não trabalhada?`
          }
          confirmText="Sim, confirmar"
          cancelText="Cancelar"
          variant="default"
        />
      )}

      {casaToDelete && (
        <ConfirmationModal
          isOpen={isConfirmDeleteOpen}
          onClose={() => setIsConfirmDeleteOpen(false)}
          onConfirm={executeDelete}
          title="Confirmar Exclusão"
          message={`Tem certeza de que deseja EXCLUIR permanentemente o número "${casaToDelete.number}"? Esta ação não pode ser desfeita.`}
          confirmText="Sim, Excluir"
          cancelText="Cancelar"
          variant="destructive"
        />
      )}

    </>
  );
}

export default withAuth(QuadraDetailPage);

    