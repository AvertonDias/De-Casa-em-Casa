
"use client";

import React, { useEffect, useState } from "react";
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

/* =========================================================
   COMPONENTE PRINCIPAL
========================================================= */
export default function S13ReportPage() {
  const { user } = useUser();

  const [allTerritories, setAllTerritories] = useState<Territory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPrinting, setIsPrinting] = useState(false);
  const [serviceYear, setServiceYear] = useState(
    new Date().getFullYear().toString()
  );
  const [typeFilter, setTypeFilter] = useState<"urban" | "rural">("urban");
  const [scale, setScale] = useState(1);

  /* ================= FIRESTORE ================= */
  useEffect(() => {
    if (!user?.congregationId) {
      if (user) setLoading(false);
      return;
    }

    const territoriesRef = collection(
      db,
      "congregations",
      user.congregationId,
      "territories"
    );

    const q = query(territoriesRef, orderBy("number", "asc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAllTerritories(
        snapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() } as Territory)
        )
      );
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  /* ================= PDF ================= */
  const handlePrint = async () => {
    setIsPrinting(true);

    const element = document.getElementById("pdf-area");
    if (!element) {
      setIsPrinting(false);
      return;
    }

    try {
      const html2pdf = (await import("html2pdf.js")).default;

      await html2pdf()
        .from(element)
        .set({
          margin: [15, 10, 15, 10], // Margens: topo, direita, baixo, esquerda em mm
          filename: `Relatorio-S13-${typeFilter}-${serviceYear}.pdf`,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            backgroundColor: "#ffffff",
          },
          jsPDF: {
            unit: "mm",
            format: "a4",
            orientation: "portrait",
          },
        })
        .save();
    } catch (err) {
      console.error("Erro ao gerar PDF:", err);
    } finally {
      setIsPrinting(false);
    }
  };

  /* ================= HELPERS ================= */
  const filteredTerritories = allTerritories.filter(
    (t) => (t.type || "urban") === typeFilter
  );

  const getLastCompletedDate = (territory: Territory) => {
    const history = territory.assignmentHistory || [];
    if (history.length === 0) return "---";

    const sorted = [...history].sort(
      (a, b) => b.completedAt.toMillis() - a.completedAt.toMillis()
    );

    return format(sorted[0].completedAt.toDate(), "dd/MM/yy", {
      locale: ptBR,
    });
  };

  /* ================= CONTEÚDO REUTILIZÁVEL ================= */
  const ReportContent = () => (
    <>
      <h1 className="text-xl font-bold text-center uppercase mb-4">
        REGISTRO DE DESIGNAÇÃO DE TERRITÓRIO (
        {typeFilter === "urban" ? "URBANO" : "RURAL"})
      </h1>

      <div className="flex justify-between items-end my-4 text-sm">
        <div className="flex items-baseline">
          <label className="font-semibold">Ano de Serviço:</label>
          <input
            type="number"
            value={serviceYear}
            onChange={(e) => setServiceYear(e.target.value)}
            className="ml-2 border-b-2 border-black px-2 w-20 bg-transparent text-center"
            aria-label="Ano de Serviço"
          />
        </div>
        <div className="flex items-baseline">
          <span className="font-semibold">Congregação:</span>
          <span className="ml-2 border-b-2 border-black px-4 flex-grow min-w-[150px] text-center">
            {user?.congregationName || "..."}
          </span>
        </div>
      </div>

      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="text-center font-semibold">
            <th rowSpan={2} className="border border-black p-1">Terr.</th>
            <th rowSpan={2} className="border border-black p-1">Última*</th>
            {Array(4).fill(null).map((_, i) => (
              <th key={i} colSpan={2} className="border border-black p-1">
                Designado a
              </th>
            ))}
          </tr>
          <tr className="text-center font-semibold">
            {Array(4).fill(null).map((_, i) => (
              <React.Fragment key={i}>
                <th className="border border-black p-1">Designação</th>
                <th className="border border-black p-1">Conclusão</th>
              </React.Fragment>
            ))}
          </tr>
        </thead>

        {loading ? (
          <tbody>
            <tr>
              <td colSpan={10} className="text-center p-4">
                Carregando dados...
              </td>
            </tr>
          </tbody>
        ) : (
          filteredTerritories.map((t) => {
            const allAssignments: Partial<AssignmentHistoryLog>[] = [
              ...(t.assignmentHistory || []),
            ];

            if (t.status === "designado" && t.assignment) {
              allAssignments.push({
                name: t.assignment.name,
                assignedAt: t.assignment.assignedAt,
              });
            }

            const display = Array(4)
              .fill(null)
              .map((_, i) => allAssignments[i] || null);

            return (
              <tbody key={t.id} className="print-avoid-break">
                <tr className="text-center">
                  <td rowSpan={2} className="border border-black">
                    {t.number}
                  </td>
                  <td rowSpan={2} className="border border-black">
                    {getLastCompletedDate(t)}
                  </td>
                  {display.map((a, i) => (
                    <td key={i} colSpan={2} className="border border-black">
                      {a?.name || ""}
                    </td>
                  ))}
                </tr>
                <tr className="text-center">
                  {display.map((a, i) => (
                    <React.Fragment key={i}>
                      <td className="border border-black">
                        {a?.assignedAt
                          ? format(a.assignedAt.toDate(), "dd/MM/yy")
                          : ""}
                      </td>
                      <td className="border border-black">
                        {a?.completedAt
                          ? format(a.completedAt.toDate(), "dd/MM/yy")
                          : ""}
                      </td>
                    </React.Fragment>
                  ))}
                </tr>
              </tbody>
            );
          })
        )}
      </table>

      <p className="text-xs mt-2">
        * Data da última conclusão registrada.
      </p>
    </>
  );

  /* ================= RENDER ================= */
  return (
    <>
      {/* BARRA SUPERIOR */}
      <div className="p-4 bg-card print-hidden">
        <div className="container mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <Button variant="ghost" asChild>
            <Link href="/dashboard/administracao">
              <ArrowLeft size={16} className="mr-2" />
              Voltar
            </Link>
          </Button>

          <div className="flex gap-2">
            <Button onClick={() => setTypeFilter("urban")} variant={typeFilter === 'urban' ? 'default' : 'outline'}>
              <Map size={14} className="mr-1" /> Urbanos
            </Button>
            <Button onClick={() => setTypeFilter("rural")} variant={typeFilter === 'rural' ? 'default' : 'outline'}>
              <Trees size={14} className="mr-1" /> Rurais
            </Button>
          </div>

          <div className="flex gap-2 items-center">
             <Button variant="outline" size="icon" onClick={() => setScale(s => Math.min(s + 0.1, 2))}><ZoomIn size={16}/></Button>
             <Button variant="outline" size="icon" onClick={() => setScale(s => Math.max(s - 0.1, 0.5))}><ZoomOut size={16}/></Button>
             <Button variant="outline" size="icon" onClick={() => setScale(1)}><RotateCcw size={16}/></Button>
          </div>

          <Button onClick={handlePrint} disabled={isPrinting} className="w-full sm:w-auto justify-center">
            {isPrinting ? (
              <Loader className="animate-spin mr-2" />
            ) : (
              <Printer size={16} className="mr-2" />
            )}
            Salvar PDF
          </Button>
        </div>
      </div>

      {/* VISUAL */}
      <div className="p-4 flex justify-center bg-muted print-hidden">
        <div
          className="bg-white p-4 shadow-lg"
          style={{ width: "200mm", transform: `scale(${scale})`, transformOrigin: 'top center' }}
        >
          <div style={{ color: 'black' }}>
             <ReportContent />
          </div>
        </div>
      </div>

      {/* PDF (FORA DA TELA, MAS VISÍVEL AO DOM) */}
      <div
        className="bg-white"
        style={{
          position: "absolute",
          left: "-10000px",
          top: 0,
          width: "210mm",
          padding: "10mm",
        }}
      >
        <div id="pdf-area" style={{ color: 'black' }}>
          <ReportContent />
        </div>
      </div>
    </>
  );
}
