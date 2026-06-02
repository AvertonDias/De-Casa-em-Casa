"use client";

import React, { useEffect, useState } from "react";
import { useUser } from "@/contexts/UserContext";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { Territory, AssignmentHistoryLog } from "@/types/types";
import { Printer, Loader, FileText, Map, Trees } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { useToast } from "@/hooks/use-toast";

export default function S13Report() {
  const { user, congregation } = useUser();
  const { toast } = useToast();
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPrinting, setIsPrinting] = useState(false);
  const [typeFilter, setTypeFilter] = useState<'urban' | 'rural'>('urban');

  useEffect(() => {
    if (!user?.congregationId) return;

    const territoriesRef = collection(db, "congregations", user.congregationId, "territories");
    const q = query(territoriesRef, orderBy("number", "asc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Territory));
      setTerritories(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const filteredTerritories = territories.filter(t => (t.type || 'urban') === typeFilter);

  const handlePrint = async () => {
    if (loading || filteredTerritories.length === 0) return;
    setIsPrinting(true);

    const printElement = document.getElementById('s13-pdf-content');
    if (!printElement) {
      setIsPrinting(false);
      return;
    }

    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const worker = html2pdf().from(printElement).set({
        margin: [15, 10, 15, 10],
        filename: `Relatorio-S13-${typeFilter}-${format(new Date(), 'yyyy-MM-dd')}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      });

      if (Capacitor.isNativePlatform()) {
        const pdfBase64 = await worker.output('datauristring');
        const base64Data = pdfBase64.split(',')[1];
        await Filesystem.writeFile({
          path: `Relatorio-S13-${typeFilter}.pdf`,
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

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader className="animate-spin text-primary" size={40} /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center print-hidden gap-4">
        <div className="flex items-center gap-2 bg-muted/30 p-1 rounded-lg border border-border/40">
          <Button 
            onClick={() => setTypeFilter("urban")} 
            variant={typeFilter === 'urban' ? 'default' : 'ghost'} 
            size="sm"
            className="h-8"
          >
            <Map size={14} className="mr-2" /> Urbanos
          </Button>
          <Button 
            onClick={() => setTypeFilter("rural")} 
            variant={typeFilter === 'rural' ? 'default' : 'ghost'} 
            size="sm"
            className="h-8"
          >
            <Trees size={14} className="mr-2" /> Rurais
          </Button>
        </div>
        <Button onClick={handlePrint} disabled={isPrinting} className="w-full sm:w-auto">
          {isPrinting ? <Loader className="animate-spin mr-2" /> : <Printer size={16} className="mr-2" />} Salvar S-13 (PDF)
        </Button>
      </div>

      <div className="bg-white text-black p-8 shadow-xl rounded-xl border border-gray-200 overflow-x-auto min-h-[800px]">
        <div id="s13-pdf-content">
          <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-6">
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tighter">S-13</h1>
              <p className="text-[10px] font-bold uppercase">Registro de Território da Congregação</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold uppercase">{congregation?.name || "..."}</p>
              <p className="text-[10px] text-gray-600">Gerado em: {format(new Date(), "dd/MM/yyyy HH:mm")}</p>
            </div>
          </div>

          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-black p-2 text-[10px] uppercase font-black text-left w-16">Nº</th>
                <th className="border border-black p-2 text-[10px] uppercase font-black text-left">Território / Publicador</th>
                <th className="border border-black p-2 text-[10px] uppercase font-black text-center w-28">Designado</th>
                <th className="border border-black p-2 text-[10px] uppercase font-black text-center w-28">Concluído</th>
              </tr>
            </thead>
            <tbody>
              {filteredTerritories.map((t) => {
                // Pega o histórico e inverte para mostrar os mais recentes primeiro
                const history = [...(t.assignmentHistory || [])].sort((a, b) => b.completedAt.toMillis() - a.completedAt.toMillis());
                
                // Primeira linha com os dados atuais ou o último concluído
                const current = t.assignment;
                
                return (
                  <React.Fragment key={t.id}>
                    {/* Linha Principal do Território */}
                    <tr className="bg-gray-50">
                      <td className="border border-black p-2 font-black text-center" rowSpan={Math.max(1, history.length + (current ? 1 : 0))}>
                        {t.number}
                      </td>
                      <td className="border border-black p-2 font-bold text-sm bg-gray-100" colSpan={3}>
                        {t.name}
                      </td>
                    </tr>
                    
                    {/* Designação Atual */}
                    {current && (
                      <tr>
                        <td className="border border-black p-2 text-sm italic">
                          {current.name} (Atual)
                        </td>
                        <td className="border border-black p-2 text-center text-sm">
                          {format(current.assignedAt.toDate(), "dd/MM/yy")}
                        </td>
                        <td className="border border-black p-2 text-center text-sm text-gray-400">
                          -
                        </td>
                      </tr>
                    )}

                    {/* Histórico Passado */}
                    {history.length > 0 ? history.slice(0, 5).map((log, idx) => (
                      <tr key={`${t.id}-log-${idx}`}>
                        <td className="border border-black p-2 text-sm">
                          {log.name}
                        </td>
                        <td className="border border-black p-2 text-center text-sm">
                          {format(log.assignedAt.toDate(), "dd/MM/yy")}
                        </td>
                        <td className="border border-black p-2 text-center text-sm font-bold">
                          {format(log.completedAt.toDate(), "dd/MM/yy")}
                        </td>
                      </tr>
                    )) : !current && (
                      <tr>
                        <td className="border border-black p-2 text-sm text-gray-400 italic" colSpan={3}>
                          Nenhum registro disponível
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
          
          <div className="mt-8 text-[9px] text-gray-500 italic">
            * Este relatório exibe as 5 designações mais recentes de cada território para fins de controle de rotatividade.
          </div>
        </div>
      </div>
    </div>
  );
}
