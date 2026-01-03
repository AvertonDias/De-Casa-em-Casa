
"use client";

import React, { useEffect, useState, useRef } from "react";
import { useUser } from "@/contexts/UserContext";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { Territory, AssignmentHistoryLog } from "@/types/types";
import {
  Printer,
    ArrowLeft,
      Map,
        Trees,
          ZoomIn,
            ZoomOut,
              Loader,
                RotateCcw,
                } from "lucide-react";
                import { format } from "date-fns";
                import { ptBR } from "date-fns/locale";
                import Link from "next/link";
                import { Button } from "@/components/ui/button";
import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { useToast } from "@/hooks/use-toast";

export default function S13ReportPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const [allTerritories, setAllTerritories] = useState<Territory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPrinting, setIsPrinting] = useState(false);
  const [serviceYear] = useState(new Date().getFullYear().toString());
  const [typeFilter, setTypeFilter] = useState<"urban" | "rural">("urban");
  const [scale, setScale] = useState(1);

  // Drag and Pan states
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const positionRef = useRef({ x: 0, y: 0 });


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

  const resetZoomAndPosition = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    positionRef.current = { x: 0, y: 0 };
  };

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
          <label className="font-semibold whitespace-nowrap">Ano de Serviço:</label>
          <span className="ml-2 px-4 flex-grow min-w-[60px] text-center">
            <u>{serviceYear}</u>
          </span>
        </div>
        <div className="flex items-center">
          <span className="font-semibold whitespace-nowrap">Congregação:</span>
          <span className="ml-2 px-4 flex-grow min-w-[150px] text-center">
            <u>{user?.congregationName || "..."}</u>
          </span>
        </div>
      </div>
    </>
  );

  const ReportForPrint = ({ inPdf = false }: { inPdf?: boolean }) => (
    <>
      <ReportHeader />
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse min-w-[700px]">
          <thead>
            <tr className="text-center font-semibold">
              <th rowSpan={2} className="border border-black p-1" style={{ textAlign: 'center', verticalAlign: 'middle' }}>Terr.</th>
              {Array(4).fill(null).map((_, i) => (
                <th key={i} colSpan={2} className="border border-black p-1" style={{ textAlign: 'center', verticalAlign: 'middle' }}>Designado a</th>
              ))}
            </tr>
            <tr className="text-center font-semibold">
              {Array(4).fill(null).map((_, i) => (
                <React.Fragment key={i}>
                  <th className="border border-black p-1" style={{ textAlign: 'center', verticalAlign: 'middle' }}>Designação</th>
                  <th className="border border-black p-1" style={{ textAlign: 'center', verticalAlign: 'middle' }}>Conclusão</th>
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
              const allAssignments: Partial<AssignmentHistoryLog>[] = [...(t.assignmentHistory || [])];
              if (t.status === "designado" && t.assignment) {
                allAssignments.push({
                  name: t.assignment.name,
                  assignedAt: t.assignment.assignedAt,
                });
              }
              const display = Array(4).fill(null).map((_, i) => allAssignments[i] || null);
              const isEven = index % 2 === 0;
              const bgColor = isEven ? '#e5e7eb' : 'transparent';
              
              const cellStyle: React.CSSProperties = {
                  textAlign: 'center',
                  verticalAlign: 'middle',
                  backgroundColor: bgColor,
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
                          {a?.assignedAt ? format(a.assignedAt.toDate(), "dd/MM/yy") : ""}
                        </td>
                        <td className="border border-black py-2" style={cellStyle}>
                          {a?.completedAt ? format(a.completedAt.toDate(), "dd/MM/yy") : ""}
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
            const allAssignments: Partial<AssignmentHistoryLog>[] = [...(t.assignmentHistory || [])];
            if (t.status === "designado" && t.assignment) {
              allAssignments.push({
                name: t.assignment.name,
                assignedAt: t.assignment.assignedAt,
              });
            }
            return (
              <div key={t.id} className="border border-border rounded-lg p-4">
                <h3 className="font-bold text-lg mb-2">Território {t.number}</h3>
                {allAssignments.length > 0 ? allAssignments.slice(0, 4).map((a, i) => (
                  <div key={i} className="text-sm border-t border-border mt-2 pt-2">
                    <p><span className="font-semibold">Designado a:</span> {a.name || "N/A"}</p>
                    <p><span className="font-semibold">Data:</span> {a.assignedAt ? format(a.assignedAt.toDate(), "dd/MM/yy") : "N/A"}</p>
                    <p><span className="font-semibold">Conclusão:</span> {a.completedAt ? format(a.completedAt.toDate(), "dd/MM/yy") : "..."}</p>
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
      <div className="p-4 bg-card print-hidden">
        <div className="container mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex gap-2">
            <Button onClick={() => setTypeFilter("urban")} variant={typeFilter === 'urban' ? 'default' : 'outline'}>
              <Map size={14} className="mr-1" /> Urbanos
            </Button>
            <Button onClick={() => setTypeFilter("rural")} variant={typeFilter === 'rural' ? 'default' : 'outline'}>
              <Trees size={14} className="mr-1" /> Rurais
            </Button>
          </div>
          <Button onClick={handlePrint} disabled={isPrinting} className="w-full sm:w-auto justify-center">
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
            className="bg-white p-4 shadow-lg origin-top"
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
      <div className="hidden print-block">
        <div className="text-black bg-white">
          <ReportForPrint inPdf={true} />
        </div>
      </div>
    </>
  );
}
