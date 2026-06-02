"use client";

import React, { useEffect, useState, useRef } from "react";
import { useUser } from "@/contexts/UserContext";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { Territory, AssignmentHistoryLog } from "@/types/types";
import {
  Printer,
  Map,
  Trees,
  Loader,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function S13ReportPage() {
  const { user, congregation } = useUser();
  const { toast } = useToast();
  const [allTerritories, setAllTerritories] = useState<Territory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPrinting, setIsPrinting] = useState(false);
  const [serviceYear, setServiceYear] = useState(new Date().getFullYear().toString());
  const [typeFilter, setTypeFilter] = useState<"urban" | "rural">("urban");
  const [scale, setScale] = useState(1);

  // Drag and Pan states
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const positionRef = useRef({ x: 0, y: 0 });

  // Lista de anos para o seletor (2 anos atrás e 2 à frente)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => (currentYear - 2 + i).toString());

  useEffect(() => {
    if (!user?.congregationId) {
      if (user) setLoading(false);
      return;
    }
    const territoriesRef = collection(db,"congregations",user.congregationId,"territories");
    const q = query(territoriesRef, orderBy("number", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAllTerritories(
        snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Territory))
      );
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  const handlePrint = async () => {
    setIsPrinting(true);
    // Resetar o zoom e a posição para a impressão
    const originalScale = scale;
    const originalPosition = position;
    setScale(1);
    setPosition({ x: 0, y: 0 });
    
    // Aguardar o DOM atualizar antes de imprimir
    await new Promise(resolve => setTimeout(resolve, 100));

    const element = document.getElementById("pdf-area-s13");
    if (!element) {
      setIsPrinting(false);
      // Restaurar a escala e posição originais
      setScale(originalScale);
      setPosition(originalPosition);
      return;
    }

    try {
        const html2pdf = (await import("html2pdf.js")).default;
        const worker = html2pdf().from(element).set({
            margin: [15, 10, 15, 10],
            filename: `Relatorio-S13-${typeFilter}-${serviceYear}.pdf`,
            image: { type: "jpeg", quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
            jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        });

        if (Capacitor.isNativePlatform()) {
            const pdfBase64 = await worker.output('datauristring');
            const base64Data = pdfBase64.split(',')[1];
            
            await Filesystem.writeFile({
                path: `Relatorio-S13-${typeFilter}-${serviceYear}.pdf`,
                data: base64Data,
                directory: Directory.Documents,
            });
            
            toast({
                title: 'Relatório Salvo!',
                description: 'O PDF foi salvo na pasta Documentos do seu dispositivo.'
            });

        } else {
            // Comportamento padrão para web
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
      // Restaurar a escala e posição originais após a impressão
      setScale(originalScale);
      setPosition(originalPosition);
    }
  };

  const filteredTerritories = allTerritories.filter(
    (t) => (t.type || "urban") === typeFilter
  );

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    dragStartRef.current = { x: clientX, y: clientY };
    setIsDragging(true);
  };
  
  const handleDragMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
  
    const deltaX = clientX - dragStartRef.current.x;
    const deltaY = clientY - dragStartRef.current.y;
  
    const newX = positionRef.current.x + deltaX;
    const newY = positionRef.current.y + deltaY;
  
    setPosition({ x: newX, y: newY });
  };
  
  const handleDragEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    positionRef.current = position;
  };


  const ReportHeader = () => (
    <>
      <h1 className="text-xl font-bold text-center uppercase mb-4">
        REGISTRO DE DESIGNAÇÃO DE TERRITÓRIO ({typeFilter === "urban" ? "URBANO" : "RURAL"})
      </h1>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center my-4 text-sm gap-2">
        <div className="flex items-center">
          <label className="font-semibold whitespace-nowrap text-black">Ano de Serviço:</label>
          <span className="ml-2 px-4 flex-grow min-w-[60px] text-center text-black">
            <u>{serviceYear}</u>
          </span>
        </div>
        <div className="flex items-center">
          <span className="font-semibold whitespace-nowrap text-black">Congregação:</span>
          <span className="ml-2 px-4 flex-grow min-w-[150px] text-center text-black">
            <u>{congregation?.name || user?.congregationName || "..."}</u>
          </span>
        </div>
      </div>
    </>
  );

  const ReportForPrint = ({ inPdf = false }: { inPdf?: boolean }) => (
    <>
      <ReportHeader />
      <div className="overflow-x-auto text-black">
        <table className="w-full text-xs border-collapse min-w-[700px] text-black">
          <thead>
            <tr className="text-center font-semibold border-black">
              <th rowSpan={2} className="border border-black p-1 text-black" style={{ textAlign: 'center', verticalAlign: 'middle' }}>Terr.</th>
              {Array(4).fill(null).map((_, i) => (
                <th key={i} colSpan={2} className="border border-black p-1 text-black" style={{ textAlign: 'center', verticalAlign: 'middle' }}>Designado a</th>
              ))}
            </tr>
            <tr className="text-center font-semibold border-black">
              {Array(4).fill(null).map((_, i) => (
                <React.Fragment key={i}>
                  <th className="border border-black p-1 text-black" style={{ textAlign: 'center', verticalAlign: 'middle' }}>Designação</th>
                  <th className="border border-black p-1 text-black" style={{ textAlign: 'center', verticalAlign: 'middle' }}>Conclusão</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          {loading ? (
            <tbody>
              <tr>
                <td colSpan={9} className="text-center p-4">Carregando dados...</td>
              </tr>
            </tbody>
          ) : (
            filteredTerritories.map((t, index) => {
              // Filtrar histórico para incluir apenas conclusões (isCompletion !== false)
              const historyCompletions = (t.assignmentHistory || []).filter(h => h.isCompletion !== false);
              
              const allAssignments: Partial<AssignmentHistoryLog>[] = [...historyCompletions];
              
              // Incluir o atual se houver
              if (t.status === "designado" && t.assignment) {
                allAssignments.push({
                  name: t.assignment.name,
                  assignedAt: t.assignment.assignedAt,
                });
              }
              
              // Ordenar cronologicamente para preencher as colunas corretamente
              allAssignments.sort((a, b) => (a.assignedAt?.toMillis() || 0) - (b.assignedAt?.toMillis() || 0));

              // Pegamos as 4 mais recentes para caber nas colunas do formulário S-13
              const recentAssignments = allAssignments.slice(-4);
              const display = Array(4).fill(null).map((_, i) => recentAssignments[i] || null);
              
              const isEven = index % 2 === 0;
              const bgColor = isEven ? '#e5e7eb' : 'transparent';
              
              const cellStyle: React.CSSProperties = {
                  textAlign: 'center',
                  verticalAlign: 'middle',
                  backgroundColor: bgColor,
                  color: 'black',
                  borderColor: 'black'
              };

              return (
                <tbody key={t.id} className="print-avoid-break">
                  <tr>
                    <td rowSpan={2} className="border border-black py-2" style={cellStyle}>{t.number}</td>
                    {display.map((a, i) => (
                      <td key={i} colSpan={2} className="border border-black py-2" style={cellStyle}>
                        {a?.name || ""}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    {display.map((a, i) => (
                      <React.Fragment key={i}>
                        <td className="border border-black py-2" style={cellStyle}>
                          {a?.assignedAt ? format(a.assignedAt.toDate(), "dd/MM/yyyy") : ""}
                        </td>
                        <td className="border border-black py-2" style={cellStyle}>
                          {a?.completedAt ? format(a.completedAt.toDate(), "dd/MM/yyyy") : ""}
                        </td>
                      </React.Fragment>
                    ))}
                  </tr>
                </tbody>
              );
            })
          )}
        </table>
      </div>
    </>
  );

  const ReportForMobile = () => (
    <div className="bg-card p-4 rounded-lg">
      <ReportHeader />
      <div className="space-y-4">
        {loading ? (
          <div className="flex justify-center items-center h-full"><Loader className="animate-spin text-primary" /></div>
        ) : (
          filteredTerritories.map(t => {
            // Filtrar histórico para incluir apenas conclusões
            const historyCompletions = (t.assignmentHistory || []).filter(h => h.isCompletion !== false);
            const allAssignments: Partial<AssignmentHistoryLog>[] = [...historyCompletions];
            
            if (t.status === "designado" && t.assignment) {
              allAssignments.push({
                name: t.assignment.name,
                assignedAt: t.assignment.assignedAt,
              });
            }
            
            allAssignments.sort((a, b) => (a.assignedAt?.toMillis() || 0) - (b.assignedAt?.toMillis() || 0));
            const recentAssignments = allAssignments.slice(-4);

            return (
              <div key={t.id} className="border border-border rounded-lg p-4">
                <h3 className="font-bold text-lg mb-2">Território {t.number}</h3>
                {recentAssignments.length > 0 ? recentAssignments.map((a, i) => (
                  <div key={i} className="text-sm border-t border-border mt-2 pt-2">
                    <p><span className="font-semibold">Designado a:</span> {a.name || "N/A"}</p>
                    <p><span className="font-semibold">Data:</span> {a.assignedAt ? format(a.assignedAt.toDate(), "dd/MM/yyyy") : "N/A"}</p>
                    <p><span className="font-semibold">Conclusão:</span> {a.completedAt ? format(a.completedAt.toDate(), "dd/MM/yyyy") : "..."}</p>
                  </div>
                )) : (
                  <p className="text-sm text-muted-foreground">Nenhuma designação registrada.</p>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  );

  return (
    <>
      <div className="p-4 bg-card print-hidden border-b border-border/50">
        <div className="container mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <div className="flex gap-2">
              <Button onClick={() => setTypeFilter("urban")} variant={typeFilter === 'urban' ? 'default' : 'outline'} size="sm">
                <Map size={14} className="mr-1" /> Urbanos
              </Button>
              <Button onClick={() => setTypeFilter("rural")} variant={typeFilter === 'rural' ? 'default' : 'outline'} size="sm">
                <Trees size={14} className="mr-1" /> Rurais
              </Button>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase text-muted-foreground whitespace-nowrap hidden md:inline">Ano:</span>
              <Select value={serviceYear} onValueChange={setServiceYear}>
                <SelectTrigger className="w-[100px] h-9">
                  <SelectValue placeholder="Ano" />
                </SelectTrigger>
                <SelectContent>
                  {years.map(year => (
                    <SelectItem key={year} value={year}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={handlePrint} disabled={isPrinting} className="w-full sm:w-auto justify-center font-bold">
            {isPrinting ? <Loader className="animate-spin mr-2" /> : <Printer size={16} className="mr-2" />} Salvar PDF
          </Button>
        </div>
      </div>
      
      {/* Visualização para Desktop */}
      <div className="hidden md:block">
        <div 
          className="p-4 flex justify-center bg-muted print-hidden w-full overflow-hidden touch-none"
          onMouseDown={handleDragStart}
          onMouseMove={handleDragMove}
          onMouseUp={handleDragEnd}
          onMouseLeave={handleDragEnd}
          onTouchStart={handleDragStart}
          onTouchMove={handleDragMove}
          onTouchEnd={handleDragEnd}
        >
          <div
            className="bg-white p-10 shadow-lg origin-top"
            style={{ 
              width: "210mm",
              minHeight: "297mm",
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
              cursor: isDragging ? 'grabbing' : 'grab',
              transition: isDragging ? 'none' : 'transform 0.1s ease-out'
            }}
          >
            <div id="pdf-area-s13" className="text-black bg-white">
              <ReportForPrint />
            </div>
          </div>
        </div>
      </div>

      {/* Visualização para Mobile */}
      <div className="md:hidden p-4">
        <ReportForMobile />
      </div>

      {/* Conteúdo otimizado para impressão (usado pelo html2pdf) */}
      <div className="hidden">
        <div className="text-black bg-white p-8">
          <ReportForPrint inPdf={true} />
        </div>
      </div>
    </>
  );
}
