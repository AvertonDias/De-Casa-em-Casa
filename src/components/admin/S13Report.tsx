
"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useUser } from "@/contexts/UserContext";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { Territory, AssignmentHistoryLog } from "@/types/types";
import { Printer, Loader, Map, Trees, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function S13Report() {
  const { user, congregation } = useUser();
  const { toast } = useToast();
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPrinting, setIsPrinting] = useState(false);
  const [typeFilter, setTypeFilter] = useState<'urban' | 'rural'>('urban');
  
  // Ano de Serviço (O ano de serviço das Testemunhas de Jeová começa em Setembro do ano anterior)
  const currentYear = new Date().getFullYear();
  const [serviceYear, setServiceYear] = useState(new Date().getMonth() >= 8 ? currentYear + 1 : currentYear);

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

  const filteredTerritories = useMemo(() => {
    return territories.filter(t => (t.type || 'urban') === typeFilter);
  }, [territories, typeFilter]);

  const handlePrint = async () => {
    if (loading || filteredTerritories.length === 0) return;
    setIsPrinting(true);

    const printElement = document.getElementById('s13-printable-area');
    if (!printElement) {
      setIsPrinting(false);
      return;
    }

    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const worker = html2pdf().from(printElement).set({
        margin: [10, 5, 10, 5],
        filename: `S13-${typeFilter}-${serviceYear}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } 
      });

      if (Capacitor.isNativePlatform()) {
        const pdfBase64 = await worker.output('datauristring');
        const base64Data = pdfBase64.split(',')[1];
        await Filesystem.writeFile({
          path: `S13-${typeFilter}-${serviceYear}.pdf`,
          data: base64Data,
          directory: Directory.Documents,
        });
        toast({ title: 'Relatório Salvo!', description: 'O PDF está na pasta Documentos.' });
      } else {
        await worker.save();
      }
    } catch (err: any) {
      toast({ title: "Erro ao gerar PDF", description: err.message, variant: "destructive" });
    } finally {
      setIsPrinting(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader className="animate-spin text-primary" size={40} /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Controles de Filtro */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-card p-4 rounded-xl border border-border/40 print-hidden">
        <div className="flex items-center gap-2">
          <Button 
            onClick={() => setTypeFilter("urban")} 
            variant={typeFilter === 'urban' ? 'default' : 'outline'} 
            size="sm"
          >
            <Map size={14} className="mr-2" /> Urbano
          </Button>
          <Button 
            onClick={() => setTypeFilter("rural")} 
            variant={typeFilter === 'rural' ? 'default' : 'outline'} 
            size="sm"
          >
            <Trees size={14} className="mr-2" /> Rural
          </Button>
        </div>

        <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Ano de Serviço:</span>
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setServiceYear(prev => prev - 1)}><ChevronLeft size={16}/></Button>
                <span className="px-3 font-black text-lg w-16 text-center">{serviceYear}</span>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setServiceYear(prev => prev + 1)}><ChevronRight size={16}/></Button>
            </div>
        </div>

        <Button onClick={handlePrint} disabled={isPrinting} className="font-bold">
          {isPrinting ? <Loader className="animate-spin mr-2" /> : <Printer size={16} className="mr-2" />} 
          Salvar PDF
        </Button>
      </div>

      {/* Área do Relatório (Simulando Papel) */}
      <div className="bg-white text-black p-4 md:p-10 shadow-2xl rounded-sm border border-gray-300 overflow-x-auto">
        <div id="s13-printable-area" className="min-w-[800px] max-w-[900px] mx-auto bg-white p-4">
          
          {/* Cabeçalho Oficial */}
          <div className="text-center mb-8 border-b-4 border-black pb-4">
            <h1 className="text-2xl font-black uppercase tracking-widest mb-4 text-black">Registro de Designação de Território ({typeFilter === 'urban' ? 'Urbano' : 'Rural'})</h1>
            <div className="flex justify-between items-end px-2 text-black">
                <div className="text-left">
                    <p className="text-sm font-bold">Ano de Serviço: <span className="ml-2 font-normal text-lg border-b border-black px-4">{serviceYear}</span></p>
                </div>
                <div className="text-right">
                    <p className="text-sm font-bold">Congregação: <span className="ml-2 font-normal text-lg border-b border-black px-4">{congregation?.name || "...................................................."}</span></p>
                </div>
            </div>
          </div>

          {/* Tabela em Grade */}
          <table className="w-full border-collapse border-2 border-black text-[10px] text-black">
            <thead>
              <tr className="bg-gray-100">
                <th className="border-2 border-black p-2 w-12 text-center font-black" rowSpan={2}>Terr.</th>
                <th className="border-2 border-black p-1 text-center font-black uppercase tracking-tighter" colSpan={2}>Designado a</th>
                <th className="border-2 border-black p-1 text-center font-black uppercase tracking-tighter" colSpan={2}>Designado a</th>
                <th className="border-2 border-black p-1 text-center font-black uppercase tracking-tighter" colSpan={2}>Designado a</th>
              </tr>
              <tr className="bg-gray-50">
                <th className="border border-black p-1 w-24 text-center font-bold">Designação</th>
                <th className="border border-black p-1 w-24 text-center font-bold">Conclusão</th>
                <th className="border border-black p-1 w-24 text-center font-bold">Designação</th>
                <th className="border border-black p-1 w-24 text-center font-bold">Conclusão</th>
                <th className="border border-black p-1 w-24 text-center font-bold">Designação</th>
                <th className="border border-black p-1 w-24 text-center font-bold">Conclusão</th>
              </tr>
            </thead>
            <tbody>
              {filteredTerritories.map((t) => {
                // Pega o histórico e inverte para os mais recentes (limitado a 3 para caber melhor em Portrait)
                const history = [...(t.assignmentHistory || [])]
                    .filter(h => h.isCompletion !== false) 
                    .sort((a, b) => b.completedAt.toMillis() - a.completedAt.toMillis())
                    .slice(0, 3);

                return (
                  <React.Fragment key={t.id}>
                    {/* Linha de Nomes dos Publicadores */}
                    <tr className="h-10">
                      <td className="border-2 border-black p-1 text-center font-black text-sm bg-gray-50" rowSpan={2}>
                        {t.number}
                      </td>
                      {[0, 1, 2].map(i => (
                        <td key={`name-${i}`} className="border-x border-t border-black p-1 text-center font-semibold bg-gray-100/50" colSpan={2}>
                          {history[i]?.name || ""}
                        </td>
                      ))}
                    </tr>
                    {/* Linha de Datas */}
                    <tr className="h-8">
                      {[0, 1, 2].map(i => (
                        <React.Fragment key={`dates-${i}`}>
                           <td className="border border-black p-1 text-center">
                             {history[i] ? format(history[i].assignedAt.toDate(), "dd/MM/yyyy") : ""}
                           </td>
                           <td className="border border-black p-1 text-center font-bold">
                             {history[i] ? format(history[i].completedAt.toDate(), "dd/MM/yyyy") : ""}
                           </td>
                        </React.Fragment>
                      ))}
                    </tr>
                  </React.Fragment>
                );
              })}

              {/* Linhas Vazias para Preencher a Folha se houver poucos territórios */}
              {filteredTerritories.length < 10 && Array.from({ length: 10 - filteredTerritories.length }).map((_, idx) => (
                  <React.Fragment key={`empty-${idx}`}>
                    <tr className="h-10"><td className="border-2 border-black" rowSpan={2}></td><td className="border-x border-t border-black bg-gray-50" colSpan={2}></td><td className="border-x border-t border-black bg-gray-50" colSpan={2}></td><td className="border-x border-t border-black bg-gray-50" colSpan={2}></td></tr>
                    <tr className="h-8"><td className="border border-black"></td><td className="border border-black"></td><td className="border border-black"></td><td className="border border-black"></td><td className="border border-black"></td><td className="border border-black"></td></tr>
                  </React.Fragment>
              ))}
            </tbody>
          </table>

          <div className="mt-6 flex justify-between text-[8px] text-gray-500 italic uppercase font-bold">
            <span>* Documento gerado eletronicamente pelo app De Casa em Casa</span>
            <span>S-13-P</span>
          </div>
        </div>
      </div>
    </div>
  );
}
