"use client";

import React, { useEffect, useState } from "react";
import { useUser } from "@/contexts/UserContext";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { Territory } from "@/types/types";
import { Printer, Loader, Map, Trees } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface AvailableTerritory extends Territory {
  lastCompletionDate?: Date | null;
}

const ReportContent = ({ territories, congregationName, type }: { territories: AvailableTerritory[], congregationName?: string | null, type: 'urban' | 'rural' }) => (
    <>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-2">
        <h1 className="text-lg md:text-xl font-bold uppercase">Territórios {type === 'urban' ? 'Urbanos' : 'Rurais'} Disponíveis</h1>
        <p className="text-sm font-semibold whitespace-nowrap">{congregationName || "..."}</p>
      </div>
      {/* --- MELHORIA: Tabela envolvida em div para rolagem horizontal em telas pequenas --- */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[500px]">
          <thead>
            <tr className="text-sm">
              <th className="border-b-2 border-black p-2 font-bold">Número</th>
              <th className="border-b-2 border-black p-2 font-bold">Última conclusão</th>
              <th className="border-b-2 border-black p-2"></th>
            </tr>
          </thead>
          <tbody>
            {territories.map((t) => (
              <tr key={t.id} className="border-b border-gray-300 text-sm">
                <td className="p-2">{t.number}-{t.name}</td>
                <td className="p-2 whitespace-nowrap">{t.lastCompletionDate ? format(t.lastCompletionDate, "dd/MM/yyyy") : 'Nunca trabalhado'}</td>
                <td className="p-2"></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
    const q = query(territoriesRef, where("status", "!=", "designado"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const availableTerritories = snapshot.docs.map(doc => {
        const data = doc.data() as Territory;
        const history = data.assignmentHistory || [];
        const lastCompletion = history.sort((a, b) => b.completedAt.toMillis() - a.completedAt.toMillis())[0];
        
        return {
          id: doc.id,
          ...data,
          lastCompletionDate: lastCompletion ? lastCompletion.completedAt.toDate() : null
        } as AvailableTerritory;
      });

      setAllTerritories(availableTerritories.sort((a,b) => (a.lastCompletionDate?.getTime() || 0) - (b.lastCompletionDate?.getTime() || 0)));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);
  
  const filteredTerritories = allTerritories.filter(t => (t.type || 'urban') === typeFilter);

  const handlePrint = async () => {
    if (loading || filteredTerritories.length === 0) return;
    setIsPrinting(true);

    const printElement = document.getElementById('pdf-content-available');
    if (!printElement) {
        setIsPrinting(false);
        return;
    }

    try {
        const html2pdf = (await import('html2pdf.js')).default;
        const worker = html2pdf().from(printElement).set({
            margin: [15, 10, 15, 10],
            filename: `Relatorio-Disponiveis-${typeFilter}.pdf`,
            image: { type: "jpeg", quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        });

        if (Capacitor.isNativePlatform()) {
            const pdfBase64 = await worker.output('datauristring');
            const base64Data = pdfBase64.split(',')[1];
            await Filesystem.writeFile({
                path: `Relatorio-Disponiveis-${typeFilter}.pdf`,
                data: base64Data,
                directory: Directory.Documents,
            });
            toast({
                title: 'Relatório Salvo!',
                description: 'O PDF foi salvo na pasta Documentos do seu dispositivo.'
            });
        } else {
            await worker.save();
        }
    } catch (err: any) {
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
    <div>
      {/* --- CORREÇÃO: Cabeçalho responsivo --- */}
      <div className="flex flex-col sm:flex-row justify-between items-center mb-4 print-hidden gap-4">
        <div className="w-full sm:w-auto flex justify-center gap-2">
            <Button onClick={() => setTypeFilter("urban")} variant={typeFilter === 'urban' ? 'default' : 'outline'} className="flex-1 sm:flex-none">
              <Map size={14} className="mr-2" /> Urbanos
            </Button>
            <Button onClick={() => setTypeFilter("rural")} variant={typeFilter === 'rural' ? 'default' : 'outline'} className="flex-1 sm:flex-none">
              <Trees size={14} className="mr-2" /> Rurais
            </Button>
        </div>
        <Button onClick={handlePrint} disabled={isPrinting || loading} className="w-full sm:w-auto justify-center">
            {isPrinting ? <Loader className="animate-spin mr-2" /> : <Printer size={16} className="mr-2" />} Salvar PDF
        </Button>
      </div>

      {/* --- CORREÇÃO PRINCIPAL: Container responsivo --- */}
      <div className={cn(
          "bg-white p-4 sm:p-6 shadow-lg rounded-lg",
          "w-full max-w-full" // Garante que em telas de celular ele ocupe 100% da largura
      )}>
        {loading ? (
           <div className="flex items-center justify-center h-48"><Loader className="animate-spin" /></div>
        ) : (
          <div id="pdf-content-available" className="text-black">
            <ReportContent territories={filteredTerritories} congregationName={user?.congregationName} type={typeFilter} />
          </div>
        )}
      </div>
    </div>
  );
}
