

"use client";

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { doc, getDoc, collection, query, orderBy, onSnapshot, updateDoc, writeBatch, deleteDoc, runTransaction, getDocs, addDoc, serverTimestamp, Timestamp, where, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Search, ArrowUp, ArrowDown, ArrowLeft, Loader, Pencil, X, GripVertical, ChevronsUpDown } from 'lucide-react';
import { AddCasaModal } from '@/components/AddCasaModal';
import { EditCasaModal } from '@/components/EditCasaModal';
import { useUser } from '@/contexts/UserContext';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { type Casa, type Quadra, type Territory } from '@/types/types';
import withAuth from '@/components/withAuth';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { format as formatDate } from 'date-fns';


interface QuadraDetailPageProps {
  params: {
    territoryId: string;
    quadraId: string;
  };
}

function QuadraDetailPage({ params }: QuadraDetailPageProps) {
  const { user, loading: userLoading } = useUser();
  const { territoryId, quadraId } = params;
  const [territory, setTerritory] = useState<Territory | null>(null);
  const [quadra, setQuadra] = useState<Quadra | null>(null);
  const [allQuadras, setAllQuadras] = useState<Quadra[]>([]);
  const [casas, setCasas] = useState<Casa[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isReordering, setIsReordering] = useState(false);
  const router = useRouter();
  
  // Drag and Drop states
  const [draggedItem, setDraggedItem] = useState<Casa | null>(null);
  const dragItemNode = useRef<HTMLLIElement | null>(null);


  // Estados para modais
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedCasa, setSelectedCasa] = useState<Casa | null>(null);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [casaToDelete, setCasaToDelete] = useState<Casa | null>(null);
  const [statusAction, setStatusAction] = useState<{ casa: Casa; newStatus: boolean; } | null>(null);
  
  const [recentlyMovedId, setRecentlyMovedId] = useState<string | null>(null);
  const [highlightedHouseId, setHighlightedHouseId] = useState<string | null>(null);


  useEffect(() => {
    if (userLoading || !user?.congregationId || !territoryId || !quadraId) {
        if(!userLoading) setLoading(false);
        return;
    }

    const congregationId = user.congregationId;
    const territoryRef = doc(db, 'congregations', congregationId, 'territories', territoryId);
    const quadrasRef = collection(territoryRef, 'quadras');

    getDoc(territoryRef).then(snap => snap.exists() && setTerritory(snap.data() as Territory));

    const qQuadras = query(quadrasRef, orderBy('name'));
    const unsubAllQuadras = onSnapshot(qQuadras, (snapshot) => {
        setAllQuadras(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Quadra)));
    });


    const quadraPath = `congregations/${congregationId}/territories/${territoryId}/quadras/${quadraId}`;
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
      unsubAllQuadras();
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

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent<HTMLLIElement> | React.TouchEvent<HTMLLIElement>, item: Casa) => {
      setDraggedItem(item);
      // For touch, the target is different
      if (e.nativeEvent instanceof TouchEvent) {
          dragItemNode.current = e.target as HTMLLIElement;
      } else {
          dragItemNode.current = e.currentTarget;
      }
      dragItemNode.current?.addEventListener('dragend', handleDragEnd);
  };
  
  const handleDragEnter = (e: React.DragEvent<HTMLLIElement> | React.TouchEvent<HTMLLIElement>, targetItem: Casa) => {
    if (!draggedItem || draggedItem.id === targetItem.id) return;
    
    setCasas(oldList => {
      let newList = JSON.parse(JSON.stringify(oldList));
      const draggedItemIndex = newList.findIndex((i: Casa) => i.id === draggedItem.id);
      const targetItemIndex = newList.findIndex((i: Casa) => i.id === targetItem.id);
      
      // Remove o item arrastado e o insere na nova posição
      const [removed] = newList.splice(draggedItemIndex, 1);
      newList.splice(targetItemIndex, 0, removed);
      
      return newList;
    });
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    dragItemNode.current?.removeEventListener('dragend', handleDragEnd);
    dragItemNode.current = null;
  };
  

  const handleToggleCheckbox = (casa: Casa) => {
    setStatusAction({ casa, newStatus: !casa.status });
  };
  
  const handleConfirmStatusChange = async () => {
    if (!statusAction || !user?.uid || !user?.congregationId || !territoryId || !quadraId) return;

    const { casa, newStatus } = statusAction;
    const congregationId = user.congregationId;

    const congRef = doc(db, 'congregations', congregationId);
    const territoryRef = doc(congRef, 'territories', territoryId);
    const quadraRef = doc(territoryRef, 'quadras', quadraId);
    const casaRef = doc(quadraRef, 'casas', casa.id);
    const activityHistoryRef = collection(territoryRef, 'activityHistory');

    try {
        await runTransaction(db, async (transaction) => {
            const [congDoc, territoryDoc, quadraDoc, casaDoc] = await Promise.all([
                transaction.get(congRef),
                transaction.get(territoryRef),
                transaction.get(quadraRef),
                transaction.get(casaRef),
            ]);

            if (!congDoc.exists() || !territoryDoc.exists() || !quadraDoc.exists() || !casaDoc.exists()) {
                throw new Error("Um dos documentos necessários não foi encontrado.");
            }

            const wasDone = casaDoc.data().status === true;
            if (wasDone === newStatus) return;

            const increment = newStatus ? 1 : -1;

            const newQuadraHousesDone = (quadraDoc.data().housesDone || 0) + increment;
            const newTerritoryHousesDone = (territoryDoc.data().stats.housesDone || 0) + increment;
            const territoryTotalHouses = territoryDoc.data().stats.totalHouses || 0;
            const newTerritoryProgress = territoryTotalHouses > 0 ? newTerritoryHousesDone / territoryTotalHouses : 0;
            const newCongTotalHousesDone = (congDoc.data().totalHousesDone || 0) + increment;

            const casaUpdateData: any = { status: newStatus };
            if (newStatus) {
                casaUpdateData.lastWorkedBy = { uid: user.uid, name: user.name };
            }
            transaction.update(casaRef, casaUpdateData);
            transaction.update(quadraRef, { housesDone: newQuadraHousesDone });
            
            const territoryUpdateData: any = {
                "stats.housesDone": newTerritoryHousesDone,
                progress: newTerritoryProgress,
                lastUpdate: serverTimestamp()
            };
            if(newStatus){
                territoryUpdateData.lastWorkedAt = serverTimestamp();
            }
            transaction.update(territoryRef, territoryUpdateData);
            
            transaction.update(congRef, { totalHousesDone: newCongTotalHousesDone });
            
            if (newStatus) {
              const newActivityRef = doc(activityHistoryRef);
              transaction.set(newActivityRef, {
                  type: "work",
                  activityDate: Timestamp.now(),
                  description: `Casa ${casa.number} (da ${quadraDoc.data().name}) foi feita.`,
                  userId: 'automatic_system_log',
                  userName: user.name,
              });
            }
        });
    } catch (error) {
        console.error("Erro na transação ao atualizar status da casa:", error);
    } finally {
        setStatusAction(null);
    }
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
    const congregationId = user.congregationId;

    try {
        await runTransaction(db, async (transaction) => {
            const congRef = doc(db, 'congregations', congregationId);
            const territoryRef = doc(congRef, 'territories', territoryId);
            const quadraRef = doc(territoryRef, 'quadras', quadraId);
            const casaRef = doc(quadraRef, 'casas', casaToDelete.id);
            
            const [quadraDoc, territoryDoc, casaDoc, congDoc] = await Promise.all([
                transaction.get(quadraRef),
                transaction.get(territoryRef),
                transaction.get(casaRef),
                transaction.get(congRef)
            ]);

            if (!quadraDoc.exists() || !territoryDoc.exists() || !casaDoc.exists() || !congDoc.exists()) {
                throw new Error("Documento não encontrado para a transação de exclusão.");
            }

            transaction.delete(casaRef);
            
            const wasDone = casaDoc.data().status === true;
            const quadraTotal = quadraDoc.data().totalHouses || 0;
            const quadraDone = quadraDoc.data().housesDone || 0;
            transaction.update(quadraRef, {
                totalHouses: quadraTotal - 1,
                housesDone: wasDone ? quadraDone - 1 : quadraDone
            });
            
            const territoryTotal = territoryDoc.data().stats.totalHouses || 0;
            const territoryDone = territoryDoc.data().stats.housesDone || 0;
            const newTerritoryTotal = territoryTotal - 1;
            const newTerritoryDone = wasDone ? territoryDone - 1 : territoryDone;
            const newProgress = newTerritoryTotal > 0 ? newTerritoryDone / newTerritoryTotal : 0;
            transaction.update(territoryRef, {
                "stats.totalHouses": newTerritoryTotal,
                "stats.housesDone": newTerritoryDone,
                progress: newProgress
            });

            const congTotalHouses = congDoc.data().totalHouses || 0;
            const congTotalHousesDone = congDoc.data().totalHousesDone || 0;
            transaction.update(congRef, {
                totalHouses: congTotalHouses - 1,
                totalHousesDone: wasDone ? congTotalHousesDone - 1 : congTotalHousesDone
            });
        });
    } catch(error) {
        console.error("Erro ao excluir casa e atualizar estatísticas:", error);
    } finally {
        setIsConfirmDeleteOpen(false);
        setCasaToDelete(null);
    }
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
    const congregationId = user.congregationId;

    const batch = writeBatch(db);
    casas.forEach((casa, index) => {
      const casaRef = doc(db, 'congregations', congregationId, 'territories', territoryId, 'quadras', quadraId, 'casas', casa.id);
      batch.update(casaRef, { order: index }); 
    });

    try {
      await batch.commit();
    } catch (error)      {
      console.error("Falha ao reordenar:", error);
    } finally {
      setIsReordering(false);
      setDraggedItem(null);
    }
  };

  const startReordering = () => {
    setIsReordering(true);
  };

  const currentQuadraIndex = allQuadras.findIndex(q => q.id === quadraId);
  const prevQuadra = currentQuadraIndex > 0 ? allQuadras[currentQuadraIndex - 1] : null;
  const nextQuadra = currentQuadraIndex < allQuadras.length - 1 ? allQuadras[currentQuadraIndex + 1] : null;

  
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
      <div className="p-4 md:p-8 min-h-full">
        <div className="flex justify-between items-center mb-6">
            <div>
              <Link href={`/dashboard/territorios/${territoryId}`} className="text-sm text-blue-600 hover:text-blue-800 dark:text-purple-400 dark:hover:text-purple-300 flex items-center mb-2">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar para {territory ? `${territory.number} - ${territory.name}` : 'o Território'}
              </Link>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="icon" asChild disabled={!prevQuadra}>
                  <Link href={prevQuadra ? `/dashboard/territorios/${territoryId}/quadras/${prevQuadra.id}` : '#'}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 15V19a1 1 0 0 1-1.81.75l-6.837-6.836a1.207 1.207 0 0 1 0-1.707L11.189 4.37A1 1 0 0 1 13 5.061V9a1 1 0 0 0 1 1h7a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-7a1 1 0 0 0-1 1z"/></svg>
                  </Link>
                </Button>
                <h1 className="text-xl sm:text-3xl font-bold text-gray-800 dark:text-white text-center">
                  {quadra.name || 'Detalhes da Quadra'}
                </h1>
                <Button variant="secondary" size="icon" asChild disabled={!nextQuadra}>
                   <Link href={nextQuadra ? `/dashboard/territorios/${territoryId}/quadras/${nextQuadra.id}` : '#'}>
                     <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 9a1 1 0 0 0 1-1V5.061a1 1 0 0 1 1.811-.75l6.836 6.836a1.207 1.207 0 0 1 0 1.707L12.812 19.63A1 1 0 0 1 11 18.938V15a1 1 0 0 0-1-1H3a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h7z"/></svg>
                  </Link>
                </Button>
              </div>
            </div>
        </div>
        
        <div className="bg-card p-4 rounded-lg shadow-md mb-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div><p className="text-sm text-muted-foreground">Total</p><p className="font-bold text-2xl">{stats.total}</p></div>
                <div><p className="text-sm text-muted-foreground">Feitos</p><p className="font-bold text-2xl text-green-400">{stats.feitos}</p></div>
                <div><p className="text-sm text-muted-foreground">Pendentes</p><p className="font-bold text-2xl text-yellow-400">{stats.pendentes}</p></div>
                <div><p className="text-sm text-muted-foreground">Progresso</p><p className="font-bold text-2xl text-blue-400">{stats.progresso}%</p></div>
            </div>
             <div className="w-full bg-muted rounded-full h-2.5 mt-2">
                <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${stats.progresso}%` }}></div>
            </div>
        </div>

        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 justify-between">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                <input 
                  type="text" 
                  placeholder="Buscar número ou observação..." 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                  className="w-full pl-10 pr-10 py-2 bg-card border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
                 {searchTerm && (
                  <button 
                    onClick={() => setSearchTerm('')} 
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X size={20} />
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <AddCasaModal territoryId={territoryId} quadraId={quadraId} congregationId={user.congregationId} onCasaAdded={() => {}} />
                {isReordering ? (
                  <Button onClick={finishReordering} className="bg-green-600 hover:bg-green-700">Concluir</Button>
                ) : (
                  <Button onClick={startReordering} variant="info">Reordenar</Button>
                )}
              </div>
            </div>
          
            <div className="bg-card rounded-lg shadow-md">
              <ul className="divide-y divide-border">
                {filteredCasas.map((casa) => (
                  <li 
                    key={casa.id}
                    draggable={isReordering}
                    onDragStart={isReordering ? (e) => handleDragStart(e, casa) : undefined}
                    onDragEnter={isReordering ? (e) => handleDragEnter(e, casa) : undefined}
                    onTouchStart={isReordering ? (e) => handleDragStart(e, casa) : undefined}
                    onTouchMove={(e) => {
                        const touch = e.touches[0];
                        const element = document.elementFromPoint(touch.clientX, touch.clientY);
                        const targetLi = element?.closest('li');
                        if (targetLi && targetLi.dataset.id && targetLi.dataset.id !== casa.id) {
                           const targetCasa = casas.find(c => c.id === targetLi.dataset.id);
                           if (targetCasa) {
                             handleDragEnter(e, targetCasa);
                           }
                        }
                    }}
                    onTouchEnd={handleDragEnd}
                    onClick={() => handleHouseClick(casa.id)}
                    data-id={casa.id}
                    className={`flex items-center p-3 transition-colors duration-300 ${draggedItem?.id === casa.id ? 'bg-primary/30 opacity-50' : ''}`}
                  >
                    {isReordering && (
                        <div className="text-muted-foreground cursor-grab touch-none mr-2">
                            <ChevronsUpDown size={24} />
                        </div>
                    )}
                    <input
                      type="checkbox"
                      checked={casa.status}
                      onChange={() => handleToggleCheckbox(casa)}
                      className="w-6 h-6 rounded-md border-2 border-primary text-primary focus:ring-primary"
                    />
                    <div className="ml-4 flex-grow">
                      <p className={`font-bold text-lg ${casa.status ? 'text-muted-foreground' : 'text-foreground'}`}>{casa.number}</p>
                      {casa.observations && <p className="text-sm text-muted-foreground">{casa.observations}</p>}
                    </div>
                    
                    {!isReordering && (
                        <button onClick={(e) => { e.stopPropagation(); handleEditClick(casa); }} className="p-2 rounded-full text-muted-foreground hover:text-foreground">
                            <Pencil size={18}/>
                        </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
        </div>
      </div>
      
      {selectedCasa && user.congregationId && (
        <EditCasaModal 
          isOpen={isEditModalOpen} 
          onClose={() => setIsEditModalOpen(false)} 
          casa={selectedCasa}
          territoryId={territoryId}
          quadraId={quadraId}
          congregationId={user.congregationId}
          onCasaUpdated={() => {}}
          onDeleteRequest={handleDeleteRequestFromModal}
        />
      )}

      {casaToDelete && (
        <ConfirmationModal
            isOpen={isConfirmDeleteOpen}
            onClose={() => setIsConfirmDeleteOpen(false)}
            onConfirm={executeDelete}
            title="Excluir Casa"
            message={`Tem certeza que deseja excluir a casa de número "${casaToDelete.number}"?`}
            confirmText="Sim, Excluir"
            cancelText="Cancelar"
        />
      )}

      {statusAction && (
        <ConfirmationModal
            isOpen={true}
            onClose={() => setStatusAction(null)}
            onConfirm={handleConfirmStatusChange}
            title="Confirmar Alteração de Status"
            message={
                statusAction.newStatus 
                ? `Tem certeza de que deseja marcar a casa "${statusAction.casa.number}" como trabalhada?`
                : `Tem certeza que deseja desmarcar a casa "${statusAction.casa.number}" como não trabalhada?`
            }
            confirmText="Sim, confirmar"
            cancelText="Cancelar"
            variant="default"
        />
      )}
    </>
  );
}

export default withAuth(QuadraDetailPage);




    