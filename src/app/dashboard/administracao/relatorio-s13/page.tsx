
"use client";

import React, { useEffect, useRef, useState } from "react";
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

export default function S13ReportPage() {
  const { user } = useUser();

  const [allTerritories, setAllTerritories] = useState<Territory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPrinting, setIsPrinting] = useState(false);
  const [serviceYear, setServiceYear] = useState(new Date().getFullYear().toString());
  const [typeFilter, setTypeFilter] = useState<"urban" | "rural">("urban");
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (!user?.congregationId) {
      if (user) setLoading(false);
      return;
    }
    const territoriesRef = collection(db, "congregations", user.congregationId, "territories");
    const q = query(territoriesRef, orderBy("number", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAllTerritories(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Territory)));
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  const handlePrint = async () => {
    setIsPrinting(true);
    const element = document.getElementById("printable-area");
    if (!element) {
      setIsPrinting(false);
      return;
    }

    try {
      const html2pdf = (await import("html2pdf.js")).default;
      const opt = {
        margin: [5, 5, 5, 5], // margens em mm (top, right, bottom, left)
        filename: `Relatorio-S13-${typeFilter}-${serviceYear}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, dpi: 192, letterRendering: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      };
      await html2pdf().from(element).set(opt).save();
    } catch (err) {
      console.error("Erro ao gerar PDF:", err);
    } finally {
      setIsPrinting(false);
    }
  };

  const filteredTerritories = allTerritories.filter((t) => (t.type || "urban") === typeFilter);

  const getLastCompletedDate = (territory: Territory) => {
    const history = territory.assignmentHistory || [];
    if (history.length === 0) return "---";
    const sorted = [...history].sort((a, b) => b.completedAt.toMillis() - a.completedAt.toMillis());
    return format(sorted[0].completedAt.toDate(), "dd/MM/yy", { locale: ptBR });
  };

  return (
    <>
      <div className="p-4 bg-card print-hidden">
        <div className="container mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <Button variant="ghost" asChild className="self-start sm:self-center">
            <Link href="/dashboard/administracao" className="flex items-center text-sm">
              <ArrowLeft size={16} className="mr-2" /> Voltar
            </Link>
          </Button>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex bg-input p-1 rounded-lg">
              <button onClick={() => setTypeFilter("urban")} className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors flex items-center ${typeFilter === "urban" ? "bg-primary text-primary-foreground" : "hover:bg-primary/20"}`}><Map size={14} className="inline mr-2" /> Urbanos</button>
              <button onClick={() => setTypeFilter("rural")} className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors flex items-center ${typeFilter === "rural" ? "bg-primary text-primary-foreground" : "hover:bg-primary/20"}`}><Trees size={14} className="inline mr-2" /> Rurais</button>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setScale(s => s + 0.1)}><ZoomIn size={16} /></Button>
              <Button variant="outline" size="icon" onClick={() => setScale(s => Math.max(0.5, s - 0.1))}><ZoomOut size={16} /></Button>
              <Button variant="outline" size="icon" onClick={() => setScale(1)}><RotateCcw size={16} /></Button>
            </div>
          </div>

          <Button onClick={handlePrint} className="w-full sm:w-auto justify-center" disabled={isPrinting}>
            {isPrinting ? <Loader className="animate-spin mr-2" /> : <Printer size={16} className="mr-2" />}
            {isPrinting ? "Gerando..." : "Salvar PDF"}
          </Button>
        </div>
      </div>

      <div className="p-4 print:p-0 flex justify-center bg-muted">
        <div
          id="printable-area"
          className="bg-white text-black p-4 shadow-lg origin-top transition-transform"
          style={{ width: '200mm', transform: `scale(${scale})` }} 
        >
          <h1 className="text-xl font-bold text-center uppercase">REGISTRO DE DESIGNAÇÃO DE TERRITÓRIO ({typeFilter === "urban" ? "URBANO" : "RURAL"})</h1>
          <div className="flex justify-between items-end my-4">
            <div>
              <label htmlFor="service-year" className="font-semibold text-sm">Ano de Serviço:</label>
              <input id="service-year" type="text" value={serviceYear} onChange={(e) => setServiceYear(e.target.value)} className="border-b-2 border-black focus:outline-none bg-white w-24 ml-2 text-sm" />
            </div>
            <div className="text-right">
              <span className="font-semibold text-sm">Congregação:</span>
              <span className="ml-2 pb-1 border-b-2 border-black px-4 text-sm">{user?.congregationName || "..."}</span>
            </div>
          </div>

          <table className="w-full text-xs">
            <thead>
              <tr className="text-center font-semibold">
                <th className="border border-black p-1" rowSpan={2}>Terr. n.º</th>
                <th className="border border-black p-1" rowSpan={2}>Última data concluída*</th>
                <th className="border border-black p-1" colSpan={2}>Designado a</th>
                <th className="border border-black p-1" colSpan={2}>Designado a</th>
                <th className="border border-black p-1" colSpan={2}>Designado a</th>
                <th className="border border-black p-1" colSpan={2}>Designado a</th>
              </tr>
              <tr className="text-center font-semibold">
                {Array(4).fill(null).map((_, i) => (
                  <React.Fragment key={i}>
                    <th className="border border-black p-1">Data da designação</th>
                    <th className="border border-black p-1">Data da conclusão</th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            {loading ? (
                <tbody><tr><td colSpan={10} className="text-center p-4">Carregando dados...</td></tr></tbody>
            ) : (
              filteredTerritories.map((t) => {
                const allAssignments: Partial<AssignmentHistoryLog>[] = [...(t.assignmentHistory || [])];
                if (t.status === "designado" && t.assignment) {
                  allAssignments.push({
                    name: t.assignment.name,
                    assignedAt: t.assignment.assignedAt,
                    completedAt: undefined,
                  });
                }
                const sortedHistory = allAssignments.sort((a, b) => (a.assignedAt?.toMillis() || 0) - (b.assignedAt?.toMillis() || 0));
                const displayAssignments = Array(4).fill(null).map((_, i) => sortedHistory[i] || null);

                return (
                  <tbody key={t.id} className="print-avoid-break">
                    <tr className="text-center align-top h-8">
                      <td className="border border-black font-semibold align-middle" rowSpan={2}>{t.number}</td>
                      <td className="border border-black align-middle" rowSpan={2}>{getLastCompletedDate(t)}</td>
                      {displayAssignments.map((assignment, i) => (
                        <td key={`${t.id}-name-${i}`} className="border-t border-b-0 border-l border-r border-black p-1 font-semibold" colSpan={2}>{assignment?.name || ""}</td>
                      ))}
                    </tr>
                    <tr className="text-center text-xs h-8">
                      {displayAssignments.map((assignment, i) => (
                        <React.Fragment key={`${t.id}-dates-${i}`}>
                          <td className="border-t-0 border-b border-l border-r border-black p-1">{assignment?.assignedAt ? format(assignment.assignedAt.toDate(), "dd/MM/yy") : ""}</td>
                          <td className="border-t-0 border-b border-l border-r border-black p-1">{assignment?.completedAt ? format(assignment.completedAt.toDate(), "dd/MM/yy") : ""}</td>
                        </React.Fragment>
                      ))}
                    </tr>
                  </tbody>
                );
              })
            )}
          </table>

          <p className="text-xs mt-2">*Ao iniciar uma nova folha, use esta coluna para registrar a data em que cada território foi concluído pela última vez.</p>
          <p className="text-xs text-right">S-13-T 01/22</p>
        </div>
      </div>
    </>
  );
}
