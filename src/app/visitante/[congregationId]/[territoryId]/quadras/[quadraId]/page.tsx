"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, onSnapshot, collection, query, orderBy, runTransaction, Timestamp, deleteField, serverTimestamp } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { signInAnonymously } from "firebase/auth";
import { Territory, Quadra, Casa } from "@/types/types";
import { ArrowLeft, Search, Loader, UserCheck, Edit2, X, Pencil, ArrowUpDown } from "lucide-react";
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { enqueuePendingHouseAction } from "@/lib/offlineHouseQueue";
import { OfflineHouseSyncBanner } from "@/components/OfflineHouseSyncBanner";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { AddCasaModal } from "@/components/AddCasaModal";
import { EditCasaModal } from "@/components/EditCasaModal";
import { ReorderCasasModal } from "@/components/ReorderCasasModal";
import { cn } from "@/lib/utils";

export default function VisitorQuadraDetailPage() {
  const params = useParams();
  const congregationId = params.congregationId as string;
  const territoryId = params.territoryId as string;
  const quadraId = params.quadraId as string;

  const [territory, setTerritory] = useState<Territory | null>(null);
  const [quadra, setQuadra] = useState<Quadra | null>(null);
  const [allQuadras, setAllQuadras] = useState<Quadra[]>([]);
  const [casas, setCasas] = useState<Casa[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const [visitorName, setVisitorName] = useState("");
  const [isNameModalOpen, setIsNameModalOpen] = useState(false);
  const [tempName, setTempName] = useState("");
  const [statusAction, setStatusAction] = useState<{ casa: Casa; newStatus: boolean } | null>(null);

  // Estados para gerenciamento de casas (Adicionar, Editar, Reordenar, Excluir)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isReorderModalOpen, setIsReorderModalOpen] = useState(false);
  const [selectedCasa, setSelectedCasa] = useState<Casa | null>(null);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [casaToDelete, setCasaToDelete] = useState<Casa | null>(null);

  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (auth.currentUser?.isAnonymous) {
      auth.currentUser.delete().catch(() => {});
    }

    const storedName = localStorage.getItem(`visitor_name_${congregationId}_${territoryId}`);
    if (storedName) {
      setVisitorName(storedName);
    } else {
      setIsNameModalOpen(true);
    }
  }, [congregationId, territoryId]);

  useEffect(() => {
    if (!congregationId || !territoryId || !quadraId) return;

    const territoryRef = doc(db, 'congregations', congregationId, 'territories', territoryId);
    const quadraRef = doc(territoryRef, 'quadras', quadraId);
    const casasRef = collection(quadraRef, 'casas');

    const unsubTerritory = onSnapshot(territoryRef, (snap) => {
      if (snap.exists()) setTerritory({ id: snap.id, ...snap.data() } as Territory);
    });

    const qQuadras = query(collection(territoryRef, 'quadras'), orderBy('name'));
    const unsubAllQuadras = onSnapshot(qQuadras, (snapshot) => {
      setAllQuadras(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Quadra)));
    });

    const unsubQuadra = onSnapshot(quadraRef, (snap) => {
      if (snap.exists()) {
        setQuadra({ id: snap.id, ...snap.data() } as Quadra);
      } else {
        setQuadra(null);
      }
      setLoading(false);
    }, (error) => {
      console.error("Erro ao carregar quadra:", error);
      setLoading(false);
    });

    const qCasas = query(casasRef, orderBy('order'));
    const unsubCasas = onSnapshot(qCasas, (snap) => {
      const fetchedCasas = snap.docs.map(d => ({
        id: d.id,
        order: 0,
        status: false,
        ...d.data(),
      })) as Casa[];
      setCasas(fetchedCasas);
    });

    return () => {
      unsubTerritory();
      unsubQuadra();
      unsubCasas();
      unsubAllQuadras();
    };
  }, [congregationId, territoryId, quadraId]);

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempName.trim()) {
      toast({ title: "Nome obrigatório", description: "Digite seu nome para continuar.", variant: "destructive" });
      return;
    }
    const trimmed = tempName.trim();
    localStorage.setItem(`visitor_name_${congregationId}_${territoryId}`, trimmed);
    setVisitorName(trimmed);
    setIsNameModalOpen(false);
  };

  const handleToggleCheckbox = (casa: Casa) => {
    if (!visitorName) {
      setIsNameModalOpen(true);
      return;
    }
    setStatusAction({ casa, newStatus: !casa.status });
  };

  const handleConfirmStatusChange = async () => {
    if (!statusAction) return;
    const { casa, newStatus } = statusAction;
    setStatusAction(null);

    // Atualização Otimista Imediata
    setCasas(prev => prev.map(c => c.id === casa.id ? { ...c, status: newStatus } : c));
    setQuadra(prev => prev ? { ...prev, housesDone: Math.max(0, (prev.housesDone || 0) + (newStatus ? 1 : -1)) } : null);

    // Se offline, salva direto na fila do IndexedDB
    if (typeof window !== 'undefined' && !navigator.onLine) {
      await enqueuePendingHouseAction({
        congregationId,
        territoryId,
        quadraId,
        casaId: casa.id,
        casaNumber: casa.number,
        actionType: 'toggleStatus',
        newStatus,
        userName: `${visitorName} (Visitante)`,
        userUid: 'visitor',
      });

      toast({
        title: newStatus ? "Casa marcada (Offline) 📱" : "Casa desmarcada (Offline) 📱",
        description: `Marcação salva no seu aparelho! Será enviada ao servidor assim que houver conexão.`,
      });
      return;
    }

    const congRef = doc(db, 'congregations', congregationId);
    const territoryRef = doc(congRef, 'territories', territoryId);
    const quadraRef = doc(territoryRef, 'quadras', quadraId);
    const casaRef = doc(quadraRef, 'casas', casa.id);
    const activityHistoryRef = collection(territoryRef, 'activityHistory');

    try {
      await runTransaction(db, async (transaction) => {
        const congDoc = await transaction.get(congRef);
        const territoryDoc = await transaction.get(territoryRef);
        const quadraDoc = await transaction.get(quadraRef);
        const casaDoc = await transaction.get(casaRef);

        if (!congDoc.exists() || !territoryDoc.exists() || !quadraDoc.exists() || !casaDoc.exists()) {
          throw new Error("Documentos não encontrados.");
        }

        const wasDone = casaDoc.data().status === true;
        if (wasDone === newStatus) return;

        const incrementAmount = newStatus ? 1 : -1;

        transaction.update(quadraRef, { housesDone: Math.max(0, (quadraDoc.data().housesDone || 0) + incrementAmount) });

        const territoryStats = territoryDoc.data().stats || { totalHouses: 0, housesDone: 0 };
        const newTerritoryHousesDone = Math.max(0, (territoryStats.housesDone || 0) + incrementAmount);
        const territoryTotalHouses = territoryStats.totalHouses || 0;
        const newTerritoryProgress = territoryTotalHouses > 0 ? newTerritoryHousesDone / territoryTotalHouses : 0;

        transaction.update(territoryRef, {
          "stats.housesDone": newTerritoryHousesDone,
          progress: newTerritoryProgress,
          lastUpdate: serverTimestamp()
        });

        transaction.update(congRef, { totalHousesDone: Math.max(0, (congDoc.data().totalHousesDone || 0) + incrementAmount) });

        if (newStatus) {
          const newActivityRef = doc(activityHistoryRef);
          transaction.set(newActivityRef, {
            type: "work",
            activityDate: Timestamp.now(),
            description: `Casa ${casa.number} (da ${quadraDoc.data().name}) foi feita por ${visitorName} (Visitante).`,
            visitorName: visitorName,
            createdAt: serverTimestamp(),
          });

          transaction.update(casaRef, {
            status: true,
            lastWorkedBy: { uid: "visitor", name: `${visitorName} (Visitante)` },
            activityLogId: newActivityRef.id
          });
        } else {
          const activityLogIdToDelete = casaDoc.data().activityLogId;
          if (activityLogIdToDelete) {
            const logToDeleteRef = doc(activityHistoryRef, activityLogIdToDelete);
            transaction.delete(logToDeleteRef);
          }
          transaction.update(casaRef, {
            status: false,
            activityLogId: deleteField()
          });
        }
      });

      toast({
        title: newStatus ? "Casa marcada como feita!" : "Casa desmarcada",
        description: `Casa ${casa.number} atualizada com sucesso.`,
      });
    } catch (error) {
      console.warn("Erro ao atualizar status via rede, salvando no IndexedDB:", error);

      await enqueuePendingHouseAction({
        congregationId,
        territoryId,
        quadraId,
        casaId: casa.id,
        casaNumber: casa.number,
        actionType: 'toggleStatus',
        newStatus,
        userName: `${visitorName} (Visitante)`,
        userUid: 'visitor',
      });

      toast({
        title: "Salvo no modo Offline 📱",
        description: `Sua alteração na casa ${casa.number} foi mantida no dispositivo e será sincronizada em breve.`,
      });
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
    if (!casaToDelete || !congregationId || !territoryId || !quadraId) return;

    try {
      await runTransaction(db, async (transaction) => {
        const congRef = doc(db, 'congregations', congregationId);
        const territoryRef = doc(congRef, 'territories', territoryId);
        const quadraRef = doc(territoryRef, 'quadras', quadraId);
        const casaRef = doc(quadraRef, 'casas', casaToDelete.id);

        const quadraDoc = await transaction.get(quadraRef);
        const territoryDoc = await transaction.get(territoryRef);
        const casaDoc = await transaction.get(casaRef);
        const congDoc = await transaction.get(congRef);

        if (!quadraDoc.exists() || !territoryDoc.exists() || !casaDoc.exists() || !congDoc.exists()) {
          throw new Error("Documento não encontrado para exclusão.");
        }

        transaction.delete(casaRef);

        const wasDone = casaDoc.data().status === true;
        const quadraTotal = quadraDoc.data().totalHouses || 0;
        const quadraDone = quadraDoc.data().housesDone || 0;
        transaction.update(quadraRef, {
          totalHouses: Math.max(0, quadraTotal - 1),
          housesDone: wasDone ? Math.max(0, quadraDone - 1) : quadraDone
        });

        const territoryStats = territoryDoc.data().stats || { totalHouses: 0, housesDone: 0 };
        const territoryTotal = territoryStats.totalHouses || 0;
        const territoryDone = territoryStats.housesDone || 0;
        const newTerritoryTotal = Math.max(0, territoryTotal - 1);
        const newTerritoryDone = wasDone ? Math.max(0, territoryDone - 1) : territoryDone;
        const newProgress = newTerritoryTotal > 0 ? newTerritoryDone / newTerritoryTotal : 0;
        transaction.update(territoryRef, {
          "stats.totalHouses": newTerritoryTotal,
          "stats.housesDone": newTerritoryDone,
          progress: newProgress
        });

        const congTotalHouses = congDoc.data().totalHouses || 0;
        const congTotalHousesDone = congDoc.data().totalHousesDone || 0;
        transaction.update(congRef, {
          totalHouses: Math.max(0, congTotalHouses - 1),
          totalHousesDone: wasDone ? Math.max(0, congTotalHousesDone - 1) : congTotalHousesDone
        });
      });

      toast({
        title: "Casa excluída",
        description: `A casa ${casaToDelete.number} foi removida da quadra.`,
      });
    } catch (error) {
      console.error("Erro ao excluir casa:", error);
      toast({
        title: "Erro ao excluir",
        description: "Não foi possível excluir a casa.",
        variant: "destructive",
      });
    }

    setIsConfirmDeleteOpen(false);
    setCasaToDelete(null);
  };

  const filteredCasas = casas.filter(c => 
    c.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.observations && c.observations.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const currentQuadraIndex = allQuadras.findIndex(q => q.id === quadraId);
  const prevQuadra = currentQuadraIndex > 0 ? allQuadras[currentQuadraIndex - 1] : null;
  const nextQuadra = currentQuadraIndex < allQuadras.length - 1 ? allQuadras[currentQuadraIndex + 1] : null;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Carregando quadra...</p>
        </div>
      </div>
    );
  }

  if (!quadra) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">Quadra não encontrada</h1>
          <Button asChild>
            <Link href={`/visitante/${congregationId}/${territoryId}`}>Voltar ao Território</Link>
          </Button>
        </div>
      </div>
    );
  }

  const stats = {
    total: quadra.totalHouses || casas.length,
    feitos: casas.filter(c => c.status).length,
    pendentes: (quadra.totalHouses || casas.length) - casas.filter(c => c.status).length,
    progresso: (quadra.totalHouses || casas.length) > 0 ? Math.round((casas.filter(c => c.status).length / (quadra.totalHouses || casas.length)) * 100) : 0,
  };

  return (
    <div className="min-h-screen bg-background pb-12">
      {/* Top Visitor Banner */}
      <div className="bg-primary text-primary-foreground py-3 px-4 shadow-md sticky top-0 z-20 flex flex-col sm:flex-row justify-between items-center gap-2">
        <div className="flex items-center gap-2">
          <UserCheck className="h-5 w-5" />
          <span className="text-sm font-medium">
            Modo Visitante — Quadra: <strong>{quadra.name}</strong>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs bg-primary-foreground/20 px-3 py-1 rounded-full font-semibold">
            Visitante: {visitorName || "Convidado"}
          </span>
          <Button 
            variant="secondary" 
            size="sm" 
            onClick={() => { setTempName(visitorName); setIsNameModalOpen(true); }}
            className="h-7 text-xs"
          >
            <Edit2 className="h-3 w-3 mr-1" /> Alterar Nome
          </Button>
        </div>
      </div>

      <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
        <OfflineHouseSyncBanner />
        
        {/* Navigation Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <Link href={`/visitante/${congregationId}/${territoryId}`} className="text-sm text-blue-600 hover:text-blue-800 dark:text-purple-400 dark:hover:text-purple-300 flex items-center mb-2">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar para {territory ? `${territory.number} - ${territory.name}` : 'o Território'}
            </Link>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="icon" asChild disabled={!prevQuadra}>
                <Link href={prevQuadra ? `/visitante/${congregationId}/${territoryId}/quadras/${prevQuadra.id}` : '#'}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 15V19a1 1 0 0 1-1.81.75l-6.837-6.836a1.207 1.207 0 0 1 0-1.707L11.189 4.37A1 1 0 0 1 13 5.061V9a1 1 0 0 0 1 1h7a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-7a1 1 0 0 0-1 1z"/></svg>
                </Link>
              </Button>
              <h1 className="text-xl sm:text-3xl font-bold text-gray-800 dark:text-white text-center">
                {quadra.name || 'Detalhes da Quadra'}
              </h1>
              <Button variant="secondary" size="icon" asChild disabled={!nextQuadra}>
                <Link href={nextQuadra ? `/visitante/${congregationId}/${territoryId}/quadras/${nextQuadra.id}` : '#'}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 9a1 1 0 0 0 1-1V5.061a1 1 0 0 1 1.811-.75l6.836 6.836a1.207 1.207 0 0 1 0 1.707L12.812 19.63A1 1 0 0 1 11 18.938V15a1 1 0 0 0-1-1H3a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h7z"/></svg>
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Stats Card */}
        <div className="bg-card p-4 rounded-lg shadow-md border border-border">
          <div className="grid grid-cols-4 gap-1 sm:gap-4 text-center">
            <div><p className="text-xs sm:text-sm text-muted-foreground">Total</p><p className="font-bold text-lg sm:text-2xl">{stats.total}</p></div>
            <div><p className="text-xs sm:text-sm text-muted-foreground">Feitos</p><p className="font-bold text-lg sm:text-2xl text-green-400">{stats.feitos}</p></div>
            <div><p className="text-xs sm:text-sm text-muted-foreground">Pendentes</p><p className="font-bold text-lg sm:text-2xl text-yellow-400">{stats.pendentes}</p></div>
            <div><p className="text-xs sm:text-sm text-muted-foreground">Progresso</p><p className="font-bold text-lg sm:text-2xl text-blue-400">{stats.progresso}%</p></div>
          </div>
          <div className="w-full bg-muted rounded-full h-2.5 mt-2">
            <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${stats.progresso}%` }}></div>
          </div>
        </div>

        {/* Search & Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
            <input 
              type="text" 
              placeholder="Buscar número ou observação..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary pl-10 pr-10 py-2"
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
            <AddCasaModal 
              territoryId={territoryId} 
              quadraId={quadraId} 
              congregationId={congregationId} 
              onCasaAdded={() => {}} 
              territoryNumber={territory?.number}
              quadraName={quadra.name}
            />
            <Button onClick={() => setIsReorderModalOpen(true)} variant="info">
              <ArrowUpDown className="h-4 w-4 mr-2" />
              Reordenar
            </Button>
          </div>
        </div>

        {/* Casas List */}
        <div className="bg-card rounded-lg shadow-md border border-border">
          <ul className="divide-y divide-border">
            {filteredCasas.map((casa) => (
              <li 
                key={casa.id} 
                className="flex items-center p-3 transition-colors duration-300 hover:bg-muted/30"
              >
                <input
                  type="checkbox"
                  checked={casa.status}
                  onChange={() => handleToggleCheckbox(casa)}
                  className="w-6 h-6 rounded-md border-2 border-primary text-primary focus:ring-primary cursor-pointer"
                />
                <div 
                  className="ml-4 flex-grow cursor-pointer"
                  onClick={() => handleToggleCheckbox(casa)}
                >
                  <p className={cn("font-bold text-lg", casa.status ? 'text-muted-foreground' : 'text-foreground')}>
                    {casa.number}
                  </p>
                  {casa.observations && (
                    <p className="text-sm text-muted-foreground">{casa.observations}</p>
                  )}
                </div>

                <button 
                  onClick={(e) => { e.stopPropagation(); handleEditClick(casa); }} 
                  className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
                  title="Editar Casa"
                >
                  <Pencil size={18}/>
                </button>
              </li>
            ))}

            {filteredCasas.length === 0 && (
              <li className="p-8 text-center text-muted-foreground">
                Nenhuma casa encontrada.
              </li>
            )}
          </ul>
        </div>
      </div>

      {selectedCasa && congregationId && (
        <EditCasaModal 
          isOpen={isEditModalOpen} 
          onClose={() => setIsEditModalOpen(false)} 
          casa={selectedCasa}
          territoryId={territoryId}
          quadraId={quadraId}
          congregationId={congregationId}
          onCasaUpdated={() => {}}
          onDeleteRequest={handleDeleteRequestFromModal}
          territoryNumber={territory?.number}
          quadraName={quadra.name}
        />
      )}

      {congregationId && (
        <ReorderCasasModal
          isOpen={isReorderModalOpen}
          onClose={() => setIsReorderModalOpen(false)}
          casas={casas}
          territoryId={territoryId}
          quadraId={quadraId}
          congregationId={congregationId}
          territoryNumber={territory?.number}
          quadraName={quadra.name}
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

      {/* Confirmation Modal */}
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
          confirmText="Confirmar"
          cancelText="Cancelar"
        />
      )}

      {/* Name Input Modal */}
      <Dialog open={isNameModalOpen} onOpenChange={(open) => { if (visitorName) setIsNameModalOpen(open); }}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => { if (!visitorName) e.preventDefault(); }}>
          <form onSubmit={handleSaveName}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <UserCheck className="text-primary h-6 w-6" />
                Identificação do Visitante
              </DialogTitle>
              <DialogDescription>
                Digite seu nome para registrar quem marcou as casas.
              </DialogDescription>
            </DialogHeader>

            <div className="py-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="visitor-name">Seu Nome</Label>
                <Input
                  id="visitor-name"
                  placeholder="Ex: Maria Souza"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  autoFocus
                  required
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="submit" className="w-full">
                Salvar e Continuar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

