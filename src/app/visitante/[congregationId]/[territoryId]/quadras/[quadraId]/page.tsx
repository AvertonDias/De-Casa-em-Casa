"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, onSnapshot, collection, query, orderBy, runTransaction, Timestamp, deleteField, serverTimestamp } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { signInAnonymously } from "firebase/auth";
import { Territory, Quadra, Casa } from "@/types/types";
import { ArrowLeft, Search, CheckCircle2, Circle, Loader, UserCheck, Edit2 } from "lucide-react";
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { enqueuePendingHouseAction } from "@/lib/offlineHouseQueue";
import { OfflineHouseSyncBanner } from "@/components/OfflineHouseSyncBanner";

export default function VisitorQuadraDetailPage() {
  const params = useParams();
  const congregationId = params.congregationId as string;
  const territoryId = params.territoryId as string;
  const quadraId = params.quadraId as string;

  const [territory, setTerritory] = useState<Territory | null>(null);
  const [quadra, setQuadra] = useState<Quadra | null>(null);
  const [casas, setCasas] = useState<Casa[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const [visitorName, setVisitorName] = useState("");
  const [isNameModalOpen, setIsNameModalOpen] = useState(false);
  const [tempName, setTempName] = useState("");

  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    signInAnonymously(auth).catch((err) => {
      console.warn("Erro ao autenticar anonimamente:", err);
    });

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

  const handleToggleHouse = async (casa: Casa) => {
    if (!visitorName) {
      setIsNameModalOpen(true);
      return;
    }

    const newStatus = !casa.status;

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

  const filteredCasas = casas.filter(c => 
    c.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.observations && c.observations.toLowerCase().includes(searchTerm.toLowerCase()))
  );

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

  const totalCasas = quadra.totalHouses || casas.length;
  const casasFeitas = casas.filter(c => c.status).length;
  const progresso = totalCasas > 0 ? Math.round((casasFeitas / totalCasas) * 100) : 0;

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

      <div className="max-w-4xl mx-auto p-4 space-y-6 mt-4">
        <OfflineHouseSyncBanner />
        <Link href={`/visitante/${congregationId}/${territoryId}`} className="text-sm flex items-center text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao Território {territory?.number}
        </Link>

        {/* Quadra Header & Stats */}
        <div className="bg-card p-6 rounded-lg shadow-md border border-border space-y-4">
          <div>
            <h1 className="text-2xl font-bold">{quadra.name}</h1>
            <p className="text-sm text-muted-foreground">{quadra.description || "Nenhuma descrição informada."}</p>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-border">
            <div><p className="text-xs text-muted-foreground">Total</p><p className="font-bold text-lg">{totalCasas}</p></div>
            <div><p className="text-xs text-muted-foreground">Feitas</p><p className="font-bold text-lg text-green-500">{casasFeitas}</p></div>
            <div><p className="text-xs text-muted-foreground">Progresso</p><p className="font-bold text-lg text-blue-500">{progresso}%</p></div>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${progresso}%` }}></div>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar número ou observação da casa..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Casas List */}
        <div className="bg-card rounded-lg shadow-md border border-border divide-y divide-border overflow-hidden">
          {filteredCasas.map((casa) => (
            <div 
              key={casa.id} 
              onClick={() => handleToggleHouse(casa)}
              className={`p-4 flex items-center justify-between cursor-pointer transition-colors hover:bg-muted/50 ${casa.status ? 'bg-green-50/50 dark:bg-green-950/20' : ''}`}
            >
              <div className="flex items-center space-x-4">
                <button 
                  type="button"
                  className="focus:outline-none"
                  aria-label={casa.status ? `Marcar casa ${casa.number} como não feita` : `Marcar casa ${casa.number} como feita`}
                >
                  {casa.status ? (
                    <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
                  ) : (
                    <Circle className="h-6 w-6 text-muted-foreground" />
                  )}
                </button>
                <div>
                  <p className={`font-bold text-lg ${casa.status ? 'line-through text-muted-foreground' : ''}`}>
                    Casa {casa.number}
                  </p>
                  {casa.observations && (
                    <p className="text-xs text-muted-foreground italic">{casa.observations}</p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${casa.status ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300'}`}>
                  {casa.status ? "Feita" : "Pendente"}
                </span>
              </div>
            </div>
          ))}

          {filteredCasas.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
              Nenhuma casa encontrada.
            </div>
          )}
        </div>
      </div>

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
