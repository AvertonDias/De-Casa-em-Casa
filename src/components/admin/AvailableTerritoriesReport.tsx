
"use client";

import React, { useEffect, useState, useRef } from "react";
import { useUser } from "@/contexts/UserContext";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, onSnapshot, Timestamp } from "firebase/firestore";
import { Territory } from "@/types/types";
import { Printer, ArrowLeft, Loader, Map, Trees } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Capacitor } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { useToast } from "@/hooks/use-toast";

interface AvailableTerritory extends Territory {
  lastCompletionDate?: Date | null;
}

const ReportContent = ({ territories, congregationName, type }: { territories: AvailableTerritory[], congregationName?: string | null, type: 'urban' | 'rural' }) => (
    <>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold uppercase">Territórios {type === 'urban' ? 'Urbanos' : 'Rurais'} Disponíveis</h1>
        <p className="text-sm font-semibold">{congregationName || "..."}</p>
      </div>
      <table className="w-full text-left border-collapse">
        <thead>
          <tr>
            <th className="border-b-2 border-black p-2 font-bold">Número</th>
            <th className="border-b-2 border-black p-2 font-bold">Data da conclusão</th>
            <th className="border-b-2 border-black p-2"></th>
          </tr>
        </thead>
        <tbody>
          {territories.map((t) => (
            <tr key={t.id} className="border-b border-gray-400">
              <td className="p-2">{t.number}-{t.name}</td>
              <td className="p-2">{t.lastCompletionDate ? format(t.lastCompletionDate, "dd/MM/yyyy") : 'Nunca trabalhado'}</td>
              <td className="p-2"></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );


export default function AvailableTerritoriesReport() {
  const { user } = useUser();
  const { toast } = useToast();
  const [allTerritories, setAllTerritories] = useState<AvailableTerritory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPrinting, setIsPrinting] = useState(false);
  const [typeFilter, setTypeFilter] = useState<'urban' | 'rural'>('urban');

  useEffect(() => {
    if (!user?.congregationId) {
      if (user) setLoading(false);
      return;
    }
    const territoriesRef = collection(db,"congregations",user.congregationId,"territories");
    const q = query(territoriesRef, where("status", "==", "disponivel"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const territoriesData = snapshot.docs.map((doc) => {
        const data = { id: doc.id, ...doc.data() } as Territory;
        const history = data.assignmentHistory || [];
        const lastCompletion = history
          .filter(h => h.completedAt)
          .sort((a, b) => b.completedAt.toMillis() - a.completedAt.toMillis())[0];

        return { 
            ...data,
            lastCompletionDate: lastCompletion ? lastCompletion.completedAt.toDate() : null 
        } as AvailableTerritory;
      });
      
      territoriesData.sort((a, b) => {
        const dateA = a.lastCompletionDate?.getTime() || 0;
        const dateB = b.lastCompletionDate?.getTime() || 0;
        if (dateA === 0 && dateB === 0) return a.number.localeCompare(b.number, undefined, { numeric: true });
        if (dateA === 0) return -1;
        if (dateB === 0) return 1;
        return dateA - dateB;
      });

      setAllTerritories(territoriesData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);
  
  const filteredTerritories = allTerritories.filter(t => (t.type || 'urban') === typeFilter);

  const handlePrint = async () => {
    setIsPrinting(true);
    await new Promise(resolve => setTimeout(resolve, 100)); // Aguarda DOM atualizar

    const printContentEl = document.getElementById("print-version-available");
    if (!printContentEl) {
      setIsPrinting(false);
      return;
    }
    
    const element = printContentEl.querySelector("#pdf-content-available");
    if (!element) {
        setIsPrinting(false);
        return;
    }

    try {
        const html2pdf = (await import("html2pdf.js")).default;
        const worker = html2pdf().from(element).set({
            margin: [15, 10, 15, 10],
            filename: `Territorios-Disponiveis-${typeFilter}.pdf`,
            image: { type: "jpeg", quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
            jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        });

        if (Capacitor.isNativePlatform()) {
            const pdfBase64 = await worker.output('datauristring');
            const base64Data = pdfBase64.split(',')[1];
            
            await Filesystem.writeFile({
                path: `Territorios-Disponiveis-${typeFilter}.pdf`,
                data: base64Data,
                directory: Directory.Documents,
                encoding: Encoding.UTF8,
            });
            
            toast({
                title: 'Relatório Salvo!',
                description: 'O PDF foi salvo na pasta Documentos do seu dispositivo.'
            });

        } else {
            await worker.save();
        }

    } catch (err: any) {
      console.error("Erro ao gerar ou salvar PDF:", err);
      toast({
          title: "Erro ao gerar PDF",
          description: err.message || "Não foi possível salvar o relatório.",
          variant: "destructive"
      });
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div id="print-version-available">
      <div className="flex justify-between items-center mb-4 print-hidden">
        <div className="flex gap-2">
            <Button onClick={() => setTypeFilter("urban")} variant={typeFilter === 'urban' ? 'default' : 'outline'}>
              <Map size={14} className="mr-1" /> Urbanos
            </Button>
            <Button onClick={() => setTypeFilter("rural")} variant={typeFilter === 'rural' ? 'default' : 'outline'}>
              <Trees size={14} className="mr-1" /> Rurais
            </Button>
        </div>
        <Button onClick={handlePrint} disabled={isPrinting || loading} className="w-full sm:w-auto justify-center">
            {isPrinting ? <Loader className="animate-spin mr-2" /> : <Printer size={16} className="mr-2" />} Salvar PDF
        </Button>
      </div>

      <div className="p-4 flex justify-center bg-muted print-hidden w-full overflow-auto">
        <div className="bg-white p-8 shadow-lg" style={{ width: "210mm", minHeight: "297mm" }}>
          {loading ? (
             <div className="flex items-center justify-center h-full"><Loader className="animate-spin" /></div>
          ) : (
            <div id="pdf-content-available" className="text-black">
              <ReportContent territories={filteredTerritories} congregationName={user?.congregationName} type={typeFilter} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

    