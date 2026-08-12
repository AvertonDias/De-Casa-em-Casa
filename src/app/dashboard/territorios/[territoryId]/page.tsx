
"use client";

import { doc, onSnapshot, collection, updateDoc, serverTimestamp, query, orderBy, Timestamp, runTransaction, getDocs, writeBatch, getDoc, arrayRemove, deleteField } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useEffect, useState } from "react";
import { useRouter, useParams } from 'next/navigation';
import { useUser } from "@/contexts/UserContext"; 
import { Territory, Activity, Quadra, AssignmentHistoryLog, Casa } from "@/types/types"; 
import { ArrowLeft, Edit, Plus, LayoutGrid, Map, FileImage, BarChart, History, Loader, Navigation, Printer, CheckCircle2, Circle, X, QrCode } from "lucide-react";
import Link from 'next/link';

import ActivityHistory from '@/components/ActivityHistory';
import AssignmentHistory from '@/components/AssignmentHistory';
import QuadraCard from '@/components/QuadraCard';
import QuadraListItem from '@/components/QuadraListItem';
import EditTerritoryModal from '@/components/EditTerritoryModal';
import AddQuadraModal from '@/components/AddQuadraModal';
import { EditQuadraModal } from "@/components/EditQuadraModal";
import { ConfirmationModal } from '@/components/ConfirmationModal';
import ImagePreviewModal from "@/components/ImagePreviewModal";
import VisitorQrModal from "@/components/VisitorQrModal";
import withAuth from "@/components/withAuth";
import AddEditAssignmentLogModal from "@/components/admin/AddEditAssignmentLogModal";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { GoogleMapEmbed } from "@/components/GoogleMapEmbed";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { logEvent } from "@/lib/audit";
import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const ProgressSection = ({ territory }: { territory: Territory }) => {
    const totalHouses = territory.stats?.totalHouses || 0;
    const housesDone = territory.stats?.housesDone || 0;
    const progressPercentage = territory.progress ? Math.round(territory.progress * 100) : 0;
    return (
        <div className="bg-card p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-bold mb-4 flex items-center"><BarChart className="mr-3 text-primary" />Progresso Geral</h2>
            <div className="grid grid-cols-4 gap-1 sm:gap-4 text-center">
                <div><p className="text-xs sm:text-sm text-muted-foreground">Total</p><p className="font-bold text-lg sm:text-2xl">{totalHouses}</p></div>
                <div><p className="text-xs sm:text-sm text-muted-foreground">Feitas</p><p className="font-bold text-lg sm:text-2xl text-green-400">{housesDone}</p></div>
                <div><p className="text-xs sm:text-sm text-muted-foreground">Pendentes</p><p className="font-bold text-lg sm:text-2xl text-yellow-400">{totalHouses - housesDone}</p></div>
                <div><p className="text-xs sm:text-sm text-muted-foreground">Progresso</p><p className="font-bold text-lg sm:text-2xl text-blue-400">{progressPercentage}%</p></div>
            </div>
            <div className="w-full bg-muted rounded-full h-2.5 mt-4"><div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${progressPercentage}%` }}></div></div>
        </div>
    );
};

function TerritoryDetailPage({ params: paramsProp }: { params?: any }) {
  const routeParams = useParams();
  const territoryId = (routeParams?.territoryId as string) || paramsProp?.territoryId;
  const [territory, setTerritory] = useState<Territory | null>(null);
  const [activityHistory, setActivityHistory] = useState<Activity[]>([]);
  const [quadras, setQuadras] = useState<Quadra[]>([]);
  const [quadrasWithHouses, setQuadrasWithHouses] = useState<Record<string, Casa[]>>({});
  const [loading, setLoading] = useState(true);
  const { user, loading: userLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const [isEditTerritoryModalOpen, setIsEditTerritoryModalOpen] = useState(false);
  const [isAddQuadraModalOpen, setIsAddQuadraModalOpen] = useState(false);
  const [isEditQuadraModalOpen, setIsEditQuadraModalOpen] = useState(false);
  const [selectedQuadra, setSelectedQuadra] = useState<Quadra | null>(null);

  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ action: () => Promise<void>; title: string; message: string; } | null>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [isEditLogModalOpen, setIsEditLogModalOpen] = useState(false);
  const [historyLogToEdit, setHistoryLogToEdit] = useState<AssignmentHistoryLog | null>(null);
  
  // Opções de impressão
  const [isPrintOptionsModalOpen, setIsPrintOptionsModalOpen] = useState(false);
  const [includeExistingNumbers, setIncludeExistingNumbers] = useState(false);
  const [isPrintingMapping, setIsPrintingMapping] = useState(false);
  const [isVisitorQrModalOpen, setIsVisitorQrModalOpen] = useState(false);
  
  useEffect(() => {
    if (!user?.congregationId || !territoryId) return;
    const territoryRef = doc(db, 'congregations', user.congregationId, 'territories', territoryId);
    
    const unsubTerritory = onSnapshot(territoryRef, (docSnap) => { 
        if (docSnap.exists()) setTerritory({ id: docSnap.id, ...docSnap.data() } as Territory);
        else setTerritory(null);
        setLoading(false);
    });

    const historyQuery = query(collection(territoryRef, 'activityHistory'), orderBy("activityDate", "desc"));
    const unsubHistory = onSnapshot(historyQuery, (snapshot) => setActivityHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity))));
    
    const quadrasQuery = query(collection(territoryRef, 'quadras'), orderBy('name', 'asc'));
    const unsubQuadras = onSnapshot(quadrasQuery, async (snapshot) => {
        const qList = snapshot.docs.map(qDoc => ({...qDoc.data(), id: qDoc.id} as Quadra));
        setQuadras(qList);

        // Carregar casas para o mapeamento
        const housesMap: Record<string, Casa[]> = {};
        for (const q of qList) {
            const hSnap = await getDocs(query(collection(doc(territoryRef, 'quadras', q.id), 'casas'), orderBy('order')));
            housesMap[q.id] = hSnap.docs.map(d => ({ id: d.id, ...d.data() } as Casa));
        }
        setQuadrasWithHouses(housesMap);
    });

    return () => { unsubTerritory(); unsubHistory(); unsubQuadras(); };
  }, [territoryId, user]);

  useEffect(() => {
    if (quadras.length > 0 && territoryId && router && typeof window !== 'undefined' && navigator.onLine) {
      quadras.forEach((q) => {
        try {
          router.prefetch(`/dashboard/territorios/${territoryId}/quadras/${q.id}`);
        } catch (_) {
          // ignore offline prefetch error
        }
      });
    }
  }, [quadras, territoryId, router]);

  const handleSaveTerritory = async (tid: string, data: Partial<Territory>) => {
      if (!user?.congregationId || !territory) return;
      const congregationId = user.congregationId;
      const territoryRef = doc(db, 'congregations', congregationId, 'territories', tid);
      
      const changes: string[] = [];
      if (data.number && data.number !== territory.number) changes.push(`Nº: ${territory.number} -> ${data.number}`);
      if (data.name && data.name !== territory.name) changes.push(`Nome: ${territory.name} -> ${data.name}`);
      if (data.description !== undefined && data.description !== territory.description) changes.push(`Obs: Alterada`);
      if (data.mapLink !== undefined && data.mapLink !== territory.mapLink) changes.push(`Mapa: Alterado`);
      if (data.cardUrl !== undefined && data.cardUrl !== territory.cardUrl) changes.push(`Cartão: Alterado`);

      const detailText = `Editou o território ${territory.number}.${changes.length > 0 ? ` [${changes.join(' | ')}]` : ''}`;

      await updateDoc(territoryRef, { ...data, lastUpdate: serverTimestamp() });
      
      logEvent(
          congregationId,
          user.uid,
          user.name,
          'TERRITORY_EDITED',
          detailText,
          { territoryId: tid }
      );
  };

  const handleAddQuadra = async (data: { name: string, description: string }) => {
    if (!user?.congregationId) return;
    const territoryRef = doc(db, 'congregations', user.congregationId, 'territories', territoryId);
    await runTransaction(db, async (transaction) => {
        const terrDoc = await transaction.get(territoryRef);
        const newQuadraRef = doc(collection(territoryRef, 'quadras'));
        transaction.set(newQuadraRef, { ...data, totalHouses: 0, housesDone: 0, createdAt: serverTimestamp() });
        transaction.update(territoryRef, { quadraCount: (terrDoc.data()?.quadraCount || 0) + 1 });
    });
    logEvent(user.congregationId, user.uid, user.name, 'QUADRA_CREATED', `Adicionou a quadra "${data.name}" ao território ${territory?.number}.`, { territoryId, territoryNumber: territory?.number });
  };

  const handleEditQuadraClick = (e: React.MouseEvent, q: Quadra) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedQuadra(q);
    setIsEditQuadraModalOpen(true);
  };

  const handleSaveQuadra = async (qid: string, data: { name: string; description: string }) => {
    if (!user?.congregationId || !territory) return;
    const qRef = doc(db, 'congregations', user.congregationId, 'territories', territoryId, 'quadras', qid);
    
    const oldQuadra = quadras.find(q => q.id === qid);
    const changes: string[] = [];
    if (data.name !== oldQuadra?.name) changes.push(`Nome: ${oldQuadra?.name} -> ${data.name}`);
    if (data.description !== oldQuadra?.description) changes.push(`Obs: Alterada`);

    const detailText = `Editou a quadra "${data.name}" no território ${territory.number}.${changes.length > 0 ? ` [${changes.join(' | ')}]` : ''}`;

    await updateDoc(qRef, data);
    logEvent(user.congregationId, user.uid, user.name, 'QUADRA_EDITED', detailText, { territoryId, quadraId: qid });
    toast({ title: "Sucesso!", description: "Dados da quadra atualizados." });
  };

  const handleDeleteQuadra = (qid: string) => {
    const qToRemove = quadras.find(q => q.id === qid);
    if (!qToRemove || !territory) return;

    setConfirmAction({
      title: "Excluir Quadra",
      message: `Isso apagará permanentemente a quadra "${qToRemove.name}" e todas as casas nela. Esta ação não pode ser desfeita.`,
      action: async () => {
        setIsProcessingAction(true);
        try {
          const congregationId = user!.congregationId!;
          const qRef = doc(db, 'congregations', congregationId, 'territories', territoryId, 'quadras', qid);
          const housesSnap = await getDocs(collection(qRef, 'casas'));
          const backupCasas = housesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

          const batch = writeBatch(db);
          housesSnap.forEach(h => batch.delete(h.ref));
          batch.delete(qRef);
          
          const territoryRef = doc(db, 'congregations', congregationId, 'territories', territoryId);
          const tSnap = await getDoc(territoryRef);
          const tData = tSnap.data() as Territory;
          
          const qHouses = qToRemove.totalHouses || 0;
          const qDone = qToRemove.housesDone || 0;
          
          batch.update(territoryRef, {
            quadraCount: (tData.quadraCount || 0) - 1,
            "stats.totalHouses": (tData.stats?.totalHouses || 0) - qHouses,
            "stats.housesDone": (tData.stats?.housesDone || 0) - qDone,
            progress: (tData.stats?.totalHouses || 0) - qHouses > 0 
                ? ((tData.stats?.housesDone || 0) - qDone) / ((tData.stats?.totalHouses || 0) - qHouses)
                : 0
          });

          const congRef = doc(db, 'congregations', congregationId);
          const congSnap = await getDoc(congRef);
          if (congSnap.exists()) {
              batch.update(congRef, {
                  totalHouses: (congSnap.data().totalHouses || 0) - qHouses,
                  totalHousesDone: (congSnap.data().totalHousesDone || 0) - qDone
              });
          }
          
          await batch.commit();

          logEvent(congregationId, user!.uid, user!.name, 'QUADRA_DELETED', 
            `Excluiu a quadra "${qToRemove.name}" do território ${territory.number}.`, 
            { territoryId, quadraId: qid, territoryNumber: territory.number, revertData: { quadra: qToRemove, casas: backupCasas } }
          );

          toast({ title: "Sucesso!", description: "Quadra removida permanentemente." });
        } catch (error) {
          toast({ title: "Erro ao deletar quadra", variant: "destructive" });
        } finally {
          setIsProcessingAction(false);
          setIsConfirmModalOpen(false);
        }
      }
    });
    setIsEditQuadraModalOpen(false);
    setIsConfirmModalOpen(true);
  };

  const handleSaveHistoryLog = async (originalLog: AssignmentHistoryLog, updatedData: { name: string; assignedAt: Date; completedAt: Date; }) => {
    if (!user?.congregationId || !territory) return;
    const territoryRef = doc(db, 'congregations', user.congregationId, 'territories', territory.id);

    try {
        await runTransaction(db, async (transaction) => {
            const territoryDoc = await transaction.get(territoryRef);
            if (!territoryDoc.exists()) throw new Error("Território não encontrado.");
            
            const currentHistory: AssignmentHistoryLog[] = territoryDoc.data().assignmentHistory || [];
            
            const newHistory = currentHistory.map(log => {
                if (log.uid === originalLog.uid && log.assignedAt.isEqual(originalLog.assignedAt)) {
                    return {
                        ...log,
                        name: updatedData.name,
                        assignedAt: Timestamp.fromDate(updatedData.assignedAt),
                        completedAt: Timestamp.fromDate(updatedData.completedAt),
                    };
                }
                return log;
            });
            transaction.update(territoryRef, { assignmentHistory: newHistory });
        });
        logEvent(user.congregationId, user.uid, user.name, 'HISTORY_EDITED', `Editou um registro de histórico do território ${territory.number}.`, { territoryId });
        toast({ title: "Sucesso!", description: "Histórico atualizado." });
    } catch (e: any) {
        toast({ title: "Erro", description: "Falha ao salvar histórico.", variant: "destructive" });
    }
  };

  const handleDeleteHistoryLog = async (logToDelete: AssignmentHistoryLog) => {
    if (!user?.congregationId || !territory) return;
    const territoryRef = doc(db, 'congregations', user.congregationId, 'territories', territory.id);
    
    try {
        await updateDoc(territoryRef, {
            assignmentHistory: arrayRemove(logToDelete)
        });
        logEvent(user.congregationId, user.uid, user.name, 'HISTORY_DELETED', `Excluiu um registro de histórico de ${logToDelete.name} do território ${territory.number}.`, { territoryId });
        toast({ title: "Sucesso!", description: "Registro removido." });
    } catch (e: any) {
        toast({ title: "Erro", description: "Falha ao remover registro.", variant: "destructive" });
    }
  };

  const handleDeleteTerritory = (tid: string) => {
    if (!territory) return;
    setConfirmAction({
      title: "Excluir Território",
      message: "Isso apagará todas as quadras e casas deste território. Esta ação é lenta e irreversível.",
      action: async () => {
        setIsProcessingAction(true);
        try {
          const congregationId = user!.congregationId!;
          const territoryRef = doc(db, 'congregations', congregationId, 'territories', tid);
          const quadrasSnap = await getDocs(collection(territoryRef, 'quadras'));
          const backupQuadras: any[] = [];

          const batch = writeBatch(db);
          
          for (const qDoc of quadrasSnap.docs) {
              const housesSnap = await getDocs(collection(qDoc.ref, 'casas'));
              const backupCasas = housesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
              backupQuadras.push({ ...qDoc.data(), id: qDoc.id, casas: backupCasas });
              
              housesSnap.forEach(h => batch.delete(h.ref));
              batch.delete(qDoc.ref);
          }
          const histSnap = await getDocs(collection(territoryRef, 'activityHistory'));
          histSnap.forEach(h => batch.delete(h.ref));
          batch.delete(territoryRef);
          
          const congRef = doc(db, 'congregations', congregationId);
          const congSnap = await getDoc(congRef);
          if (congSnap.exists()) {
              batch.update(congRef, {
                  territoryCount: Math.max(0, (congSnap.data().territoryCount || 0) - 1),
                  totalHouses: Math.max(0, (congSnap.data().totalHouses || 0) - (territory.stats?.totalHouses || 0)),
                  totalHousesDone: Math.max(0, (congSnap.data().totalHousesDone || 0) - (territory.stats?.housesDone || 0))
              });
          }

          await batch.commit();

          logEvent(congregationId, user!.uid, user!.name, 'TERRITORY_DELETED', 
            `Excluiu permanentemente o território ${territory.number} - ${territory.name}.`, 
            { territoryId: tid, territoryNumber: territory.number, revertData: { territory: { ...territory, id: tid }, quadras: backupQuadras } }
          );

          router.push('/dashboard/territorios');
        } catch (error: any) {
          toast({ title: "Erro ao deletar", description: "Não foi possível excluir o território.", variant: "destructive" });
        } finally {
          setIsProcessingAction(false);
          setIsConfirmModalOpen(false);
        }
      }
    });
    setIsEditTerritoryModalOpen(false);
    setIsConfirmModalOpen(true);
  };

  const handleResetTerritory = async (tid: string) => {
    if (!territory) return;
    setConfirmAction({
      title: "Limpar Tudo (Progresso e Histórico)",
      message: "Esta ação irá marcar todas as casas como 'não trabalhadas', zerar o progresso e APAGAR PERMANENTEMENTE todo o histórico de trabalho deste território. Deseja continuar?",
      action: async () => {
        setIsProcessingAction(true);
        try {
          if (!user?.congregationId) return;
          
          const congregationId = user.congregationId;
          const territoryRef = doc(db, 'congregations', congregationId, 'territories', tid);
          const quadrasSnap = await getDocs(collection(territoryRef, 'quadras'));
          const historySnap = await getDocs(collection(territoryRef, 'activityHistory'));
          
          const backupResetData: any = { quadras: [], history: historySnap.docs.map(d => ({ id: d.id, ...d.data() })) };
          const batch = writeBatch(db);
          let totalDecrement = 0;

          for (const qDoc of quadrasSnap.docs) {
            const housesSnap = await getDocs(collection(qDoc.ref, 'casas'));
            let quadraDecrement = 0;
            const backupHouses: any[] = [];
            
            housesSnap.forEach(hDoc => {
              if (hDoc.data().status === true) {
                backupHouses.push({ id: hDoc.id, ...hDoc.data() });
                batch.update(hDoc.ref, { 
                  status: false, 
                  lastWorkedBy: deleteField(), 
                  activityLogId: deleteField() 
                });
                quadraDecrement++;
              }
            });
            
            if (quadraDecrement > 0) {
              backupResetData.quadras.push({ id: qDoc.id, houses: backupHouses });
              batch.update(qDoc.ref, { housesDone: 0 });
              totalDecrement += quadraDecrement;
            }
          }

          historySnap.forEach(hDoc => {
            batch.delete(hDoc.ref);
          });

          batch.update(territoryRef, {
            "stats.housesDone": 0,
            progress: 0,
            lastUpdate: serverTimestamp()
          });

          if (totalDecrement > 0) {
            const congRef = doc(db, 'congregations', congregationId);
            const congSnap = await getDoc(congRef);
            if (congSnap.exists()) {
              const currentCongDone = congSnap.data().totalHousesDone || 0;
              batch.update(congRef, { totalHousesDone: Math.max(0, currentCongDone - totalDecrement) });
            }
          }

          await batch.commit();

          logEvent(congregationId, user!.uid, user!.name, 'TERRITORY_RESET', 
            `Limpou o progresso do território ${territory.number}.`, 
            { territoryId: tid, territoryNumber: territory.number, revertData: backupResetData }
          );

          toast({ title: "Território Resetado", description: "O progresso e o histórico foram limpos com sucesso." });
        } catch (error: any) {
          toast({ title: "Erro ao resetar", description: "Falha na operação.", variant: "destructive" });
        } finally {
          setIsProcessingAction(false);
          setIsConfirmModalOpen(false);
        }
      }
    });
    setIsEditTerritoryModalOpen(false);
    setIsConfirmModalOpen(true);
  };

  const handleGenerateMappingPDF = async () => {
    if (!territory || quadras.length === 0) return;
    setIsPrintingMapping(true);
    setIsPrintOptionsModalOpen(false);
    
    const filename = `Ficha-Mapeamento-${territory.number}.pdf`;

    const element = document.getElementById("mapping-pdf-area");
    if (!element) {
        setIsPrintingMapping(false);
        return;
    }

    try {
        const html2pdf = (await import("html2pdf.js")).default;
        const worker = html2pdf().from(element).set({
            margin: 0,
            filename: filename,
            image: { type: "jpeg", quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
            jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
            pagebreak: { mode: ['css', 'legacy'] },
        });

        if (Capacitor.isNativePlatform()) {
            try {
                // Solicitar permissões explicitamente antes de gravar
                await Filesystem.requestPermissions();

                // Obter PDF como base64
                const pdfBase64 = await worker.output('datauristring');
                const base64Data = pdfBase64.split(',')[1];
                
                // Salvar em um local temporário/cache para compartilhamento
                const filePath = `Ficha-${Date.now()}-${territory.number}.pdf`;
                const saveResult = await Filesystem.writeFile({
                    path: filePath,
                    data: base64Data,
                    directory: Directory.Cache,
                });

                // Solicitar ao sistema que abra ou compartilhe o arquivo
                await Share.share({
                    title: `Ficha - Território ${territory.number}`,
                    url: saveResult.uri,
                });
                
                toast({
                    title: 'Relatório Gerado!',
                    description: 'O PDF foi aberto para visualização ou compartilhamento.'
                });
            } catch (nativeErr: any) {
                console.warn("Falha ao salvar/compartilhar via Capacitor, tentando download via web:", nativeErr);
                await worker.save();
            }
        } else {
            await worker.save();
        }
    } catch (err: any) {
      console.error("Erro ao gerar ou salvar PDF:", err);
      toast({
          title: "Erro ao gerar PDF",
          description: err.message || "Não foi possível gerar a ficha de mapeamento.",
          variant: "destructive"
      });
    } finally {
      setIsPrintingMapping(false);
    }
  };

  if (loading || userLoading || !territory) return <div className="p-8 text-center"><Loader className="animate-spin mx-auto" /></div>;
  
  const isManagerView = ['Administrador', 'Dirigente', 'Servo de Territórios', 'Ajudante de Servo de Territórios'].includes(user!.role);
  const isPublicador = user!.role === 'Publicador';
  const isAdmin = user?.role === 'Administrador';

  // Componente interno para a visualização do PDF de mapeamento (A4 dividido em 4)
  const MappingSheet = () => {
    const chunks = [];
    for (let i = 0; i < quadras.length; i += 4) {
        chunks.push(quadras.slice(i, i + 4));
    }

    return (
        <div id="mapping-pdf-area" className="text-black bg-white">
            {chunks.map((chunk, pageIdx) => (
                <div key={pageIdx} className="w-[210mm] h-[295mm] grid grid-cols-2 grid-rows-2 overflow-hidden" style={{ pageBreakAfter: pageIdx < chunks.length - 1 ? 'always' : 'auto', border: 'none' }}>
                    {chunk.map((q) => {
                        const existingHouses = quadrasWithHouses[q.id] || [];
                        const shouldShowNumbers = includeExistingNumbers && existingHouses.length > 0;
                        
                        const totalRowsPerColumn = 18;
                        const leftColumnItems = shouldShowNumbers ? existingHouses.slice(0, totalRowsPerColumn) : [];
                        const rightColumnItems = shouldShowNumbers ? existingHouses.slice(totalRowsPerColumn, totalRowsPerColumn * 2) : [];

                        return (
                          <div key={q.id} className="border border-gray-900 pl-[10px] pr-[10px] pt-[14px] pb-[8px] flex flex-col h-[147mm] w-[105mm] overflow-hidden bg-white text-black">
                              <div className="border-b-2 border-black pb-1.5 mb-2 shrink-0 pt-0.5">
                                  <p className="text-[11px] font-extrabold uppercase tracking-wide truncate text-center mb-0.5 text-black">
                                    Território {territory.number} - {territory.name}
                                  </p>
                                  <div className="text-[12px] font-black text-center bg-gray-200 py-1 border border-gray-900 rounded uppercase text-black">
                                      {q.name}
                                  </div>
                              </div>
                              
                              <div className="flex-1 flex flex-col min-h-0">
                                  <p className="text-[9.5px] font-black text-black mb-1.5 uppercase flex items-center gap-1.5 shrink-0">
                                      <span className="w-1.5 h-1.5 rounded-full bg-black"></span>
                                      {shouldShowNumbers ? "Lista de Números Cadastrados" : "Anotar números das casas abaixo:"}
                                  </p>
                                  
                                  <div className="flex-1 grid grid-cols-2 gap-x-2 border border-solid border-gray-400 rounded-lg p-1 bg-white overflow-hidden">
                                      <div className="flex flex-col">
                                          {Array(totalRowsPerColumn).fill(0).map((_, i) => {
                                              const house = leftColumnItems[i];
                                              return (
                                                  <div key={`L-${i}`} className="border-b border-gray-300 h-[5.5mm] flex items-center px-0.5">
                                                      <span className="text-[9px] text-black font-extrabold font-mono w-4 shrink-0 text-right pr-1 leading-none">{i + 1}.</span>
                                                      <span className="text-[11px] font-black text-black shrink-0 ml-0.5 leading-none">{house?.number || ""}</span>
                                                      {house?.observations && <span className="text-[7.5px] text-gray-800 font-semibold ml-1 truncate flex-1 min-w-0 leading-none">({house.observations})</span>}
                                                  </div>
                                              );
                                          })}
                                      </div>
                                      <div className="flex flex-col">
                                          {Array(totalRowsPerColumn).fill(0).map((_, i) => {
                                              const house = rightColumnItems[i];
                                              return (
                                                  <div key={`R-${i}`} className="border-b border-gray-300 h-[5.5mm] flex items-center px-0.5">
                                                      <span className="text-[9px] text-black font-extrabold font-mono w-4 shrink-0 text-right pr-1 leading-none">{i + 1 + totalRowsPerColumn}.</span>
                                                      <span className="text-[11px] font-black text-black shrink-0 ml-0.5 leading-none">{house?.number || ""}</span>
                                                      {house?.observations && <span className="text-[7.5px] text-gray-800 font-semibold ml-1 truncate flex-1 min-w-0 leading-none">({house.observations})</span>}
                                                  </div>
                                              );
                                          })}
                                      </div>
                                  </div>
                              </div>
                              
                              <div className="mt-2 pt-1 border-t border-gray-400 flex justify-between items-end shrink-0 pb-0.5">
                                  <div className="space-y-0.5">
                                      <p className="text-[7px] text-black uppercase font-black">Instruções:</p>
                                      <p className="text-[7px] text-gray-800 font-semibold leading-tight">
                                        {shouldShowNumbers 
                                          ? "Use para conferência em campo. Risque casas demolidas ou adicione novas observações."
                                          : "Anote o número de cada casa e observações (esquina, cachorro). Entregue ao responsável."}
                                      </p>
                                  </div>
                                  <div className="text-[7.5px] text-black font-black whitespace-nowrap ml-2">
                                      DE CASA EM CASA
                                  </div>
                              </div>
                          </div>
                        );
                    })}
                    {chunk.length < 4 && Array(4 - chunk.length).fill(0).map((_, i) => (
                         <div key={`empty-${i}`} className="border border-gray-200 bg-white h-[147mm] w-[105mm]"></div>
                    ))}
                </div>
            ))}
        </div>
    );
  };

  const quadrasSection = (
    <div className="bg-card p-6 rounded-lg shadow-md">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <h2 className="text-2xl font-bold flex items-center"><LayoutGrid className="mr-3 text-primary" />Quadras</h2>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                {isManagerView && (
                    <>
                        {isAdmin && (
                            <Button variant="outline" size="sm" onClick={() => setIsPrintOptionsModalOpen(true)} className="w-full sm:w-auto">
                                <Printer className="mr-2 h-4 w-4" />
                                Imprimir Fichas
                            </Button>
                        )}
                        <Button size="sm" onClick={() => setIsAddQuadraModalOpen(true)} className="w-full sm:w-auto">
                            <Plus className="mr-2 h-4 w-4" /> Nova Quadra
                        </Button>
                    </>
                )}
            </div>
        </div>
        {isPublicador ? (
            <div className="divide-y divide-border -mx-6 px-6">
                {quadras.map(q => (
                    <Link key={q.id} href={`/dashboard/territorios/${territoryId}/quadras/${q.id}`} className="block">
                        <QuadraListItem quadra={q} />
                    </Link>
                ))}
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {quadras.map(q => (
                    <Link key={q.id} href={`/dashboard/territorios/${territoryId}/quadras/${q.id}`} className="block">
                        <QuadraCard 
                          quadra={q} 
                          isManagerView={isManagerView} 
                          onEdit={(e) => handleEditQuadraClick(e, q)} 
                          hideStats={isPublicador} 
                        />
                    </Link>
                ))}
            </div>
        )}
    </div>
  );

  const cardSection = territory.cardUrl && (
    <div className="bg-card p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-3">
            <FileImage className="text-primary" />
            Cartão do Território
        </h2>
        <div 
            className="cursor-pointer overflow-hidden rounded-lg border border-border/50 hover:opacity-90 transition-opacity"
            onClick={() => { setSelectedImageUrl(territory.cardUrl!); setIsPreviewModalOpen(true); }}
        >
            <img 
                src={territory.cardUrl} 
                alt="Cartão do Mapa" 
                className="w-full h-auto max-h-[400px] object-contain mx-auto"
            />
        </div>
    </div>
  );

  const mapSection = territory.mapLink && (
    <div className="bg-card p-6 rounded-lg shadow-md">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
            <h2 className="text-xl font-bold flex items-center gap-3">
                <Map className="text-primary" />
                Mapa do Território
            </h2>
            <Button variant="outline" size="sm" asChild className="w-full sm:w-auto">
                <a href={territory.mapLink} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2">
                    <Navigation size={14} className="text-blue-500" />
                    <span>Usar GPS (Abrir App)</span>
                </a>
            </Button>
        </div>
        <div className="aspect-video w-full overflow-hidden rounded-lg border border-border/50 bg-muted">
            <GoogleMapEmbed mapLink={territory.mapLink} />
        </div>
        <p className="text-[10px] text-muted-foreground mt-2 text-center">
            Dica: Para ver sua localização em tempo real sobre o mapa, clique no botão acima e use o app oficial do Google Maps.
        </p>
    </div>
  );

  const assignmentHistorySection = (
    <div className="w-full">
        <Accordion type="single" collapsible className="w-full bg-card rounded-lg shadow-md overflow-hidden">
            <AccordionItem value="assignment-history" className="border-b-0">
                <AccordionTrigger className="px-6 hover:no-underline font-semibold text-lg">
                    <div className="flex items-center gap-3">
                        <History className="text-primary" />
                        <span>Histórico e Designação Atual</span>
                    </div>
                </AccordionTrigger>
                <AccordionContent>
                    <AssignmentHistory 
                        currentAssignment={territory.assignment}
                        pastAssignments={territory.assignmentHistory || []}
                        onEdit={(log) => { setHistoryLogToEdit(log); setIsEditLogModalOpen(true); }}
                        onDelete={(log) => {
                            setConfirmAction({
                                title: "Excluir Registro",
                                message: `Tem certeza que deseja excluir o registro de ${log.name}?`,
                                action: async () => handleDeleteHistoryLog(log)
                            });
                            setIsConfirmModalOpen(true);
                        }}
                    />
                </AccordionContent>
            </AccordionItem>
        </Accordion>
    </div>
  );

  const headerSection = (
    <div className="space-y-6">
        <Link href="/dashboard/territorios" className="text-sm flex items-center"><ArrowLeft className="mr-2 h-4" /> Voltar</Link>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div><h1 className="text-3xl font-bold">{territory.number} - {territory.name}</h1><p className="text-muted-foreground">{territory.description}</p></div>
            <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setIsVisitorQrModalOpen(true)} className="gap-2">
                    <QrCode className="h-4 w-4" />
                    <span>QR Code Visitante</span>
                </Button>
                {isManagerView && <Button size="sm" onClick={() => setIsEditTerritoryModalOpen(true)}><Edit className="mr-2 h-4" /> Editar</Button>}
            </div>
        </div>
    </div>
  );

  return (
    <div className="p-4 space-y-6">
        {headerSection}
        
        {isPublicador ? (
            <>
                {quadrasSection}
                {cardSection}
                {mapSection}
                <ActivityHistory territoryId={territory.id} history={activityHistory} />
                {assignmentHistorySection}
                <ProgressSection territory={territory} />
            </>
        ) : (
            <>
                <ProgressSection territory={territory} />
                <ActivityHistory territoryId={territory.id} history={activityHistory} />
                {assignmentHistorySection}
                {cardSection}
                {mapSection}
                {quadrasSection}
            </>
        )}

        <EditTerritoryModal 
          isOpen={isEditTerritoryModalOpen} 
          onClose={() => setIsEditTerritoryModalOpen(false)} 
          territory={territory} 
          onSave={handleSaveTerritory} 
          onDelete={handleDeleteTerritory} 
          onReset={handleResetTerritory} 
        />
        
        <AddQuadraModal 
            isOpen={isAddQuadraModalOpen} 
            onClose={() => setIsAddQuadraModalOpen(false)} 
            onSave={handleAddQuadra} 
            existingQuadrasCount={quadras.length} 
        />

        {selectedQuadra && (
          <EditQuadraModal
            isOpen={isEditQuadraModalOpen}
            onClose={() => setIsEditQuadraModalOpen(false)}
            quadra={selectedQuadra}
            onSave={handleSaveHistoryLog as any}
            onDelete={handleDeleteQuadra}
          />
        )}

        <AddEditAssignmentLogModal
            isOpen={isEditLogModalOpen}
            onClose={() => setIsEditLogModalOpen(false)}
            onSave={handleSaveHistoryLog}
            logToEdit={historyLogToEdit}
        />

        <ImagePreviewModal 
            isOpen={isPreviewModalOpen} 
            onClose={() => setIsPreviewModalOpen(false)} 
            imageUrl={selectedImageUrl} 
        />

        {confirmAction && (
            <ConfirmationModal 
                isOpen={isConfirmModalOpen} 
                onClose={() => setIsConfirmModalOpen(false)} 
                onConfirm={confirmAction.action} 
                title={confirmAction.title} 
                message={confirmAction.message} 
                isLoading={isProcessingAction} 
            />
        )}

        <Dialog open={isPrintOptionsModalOpen} onOpenChange={setIsPrintOptionsModalOpen}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Gerar Fichas de Mapeamento</DialogTitle>
                    <DialogDescription>Escolha como deseja que as fichas sejam geradas.</DialogDescription>
                </DialogHeader>
                <div className="py-6 space-y-4">
                    <button 
                        onClick={() => setIncludeExistingNumbers(false)}
                        className={cn(
                            "w-full flex items-center justify-between p-4 rounded-lg border-2 transition-all text-left",
                            !includeExistingNumbers ? "border-primary bg-primary/5 shadow-md" : "border-border hover:border-primary/50"
                        )}
                    >
                        <div className="flex gap-3">
                            <Circle className={cn("h-5 w-5 mt-0.5", !includeExistingNumbers ? "text-primary" : "text-muted-foreground")} />
                            <div>
                                <p className="font-bold">Fichas em Branco</p>
                                <p className="text-xs text-muted-foreground">Espaços vazios para anotar números do zero.</p>
                            </div>
                        </div>
                    </button>

                    <button 
                        onClick={() => setIncludeExistingNumbers(true)}
                        className={cn(
                            "w-full flex items-center justify-between p-4 rounded-lg border-2 transition-all text-left",
                            includeExistingNumbers ? "border-primary bg-primary/5 shadow-md" : "border-border hover:border-primary/50"
                        )}
                    >
                        <div className="flex gap-3">
                            <CheckCircle2 className={cn("h-5 w-5 mt-0.5", includeExistingNumbers ? "text-primary" : "text-muted-foreground")} />
                            <div>
                                <p className="font-bold">Incluir Números Cadastrados</p>
                                <p className="text-xs text-muted-foreground">Imprime os números que já existem no sistema.</p>
                            </div>
                        </div>
                    </button>
                </div>
                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={() => setIsPrintOptionsModalOpen(false)}>Cancelar</Button>
                    <Button onClick={handleGenerateMappingPDF} disabled={isPrintingMapping}>
                        {isPrintingMapping ? <><Loader className="animate-spin mr-2 h-4 w-4" /> Gerando...</> : "Gerar PDF"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <div className="hidden">
            <MappingSheet />
        </div>

        <VisitorQrModal
          isOpen={isVisitorQrModalOpen}
          onClose={() => setIsVisitorQrModalOpen(false)}
          territoryNumber={territory.number}
          territoryName={territory.name}
          congregationId={user?.congregationId || ''}
          territoryId={territory.id}
        />
    </div>
  );
}

export default withAuth(TerritoryDetailPage);
