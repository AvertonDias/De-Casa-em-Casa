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
    if (!user?.congregationId) return;

    const ref = collection(
      db,
      "congregations",
      user.congregationId,
      "territories"
    );

    const q = query(ref, orderBy("number", "asc"));

    return onSnapshot(q, (snap) => {
      setAllTerritories(
        snap.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() } as Territory)
        )
      );
      setLoading(false);
    });
  }, [user]);

  /* ================= PDF ================= */
  const handlePrint = async () => {
    setIsPrinting(true);

    const element = document.getElementById("pdf-area");
    if (!element) return;

    const html2pdf = (await import("html2pdf.js")).default;

    await html2pdf()
      .from(element)
      .set({
        margin: [15, 10, 15, 10],
        filename: `Relatorio-S13-${typeFilter}-${serviceYear}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: {
          scale: 2,
          backgroundColor: "#ffffff",
        },
        jsPDF: {
          unit: "mm",
          format: "a4",
          orientation: "portrait",
        },
      })
      .save();

    setIsPrinting(false);
  };

  const filteredTerritories = allTerritories.filter(
    (t) => (t.type || "urban") === typeFilter
  );

  /* ================= CONTEÚDO ================= */
  const ReportContent = ({ inPdf = false }: { inPdf?: boolean }) => (
    <>
      <h1 className="text-xl font-bold text-center mb-4">
        REGISTRO DE DESIGNAÇÃO DE TERRITÓRIO (
        {typeFilter === "urban" ? "URBANO" : "RURAL"})
      </h1>

      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>
            <th rowSpan={2} className="border border-black p-1">Terr.</th>
            {Array(4).fill(null).map((_, i) => (
              <th key={i} colSpan={2} className="border border-black p-1">
                Designado a
              </th>
            ))}
          </tr>
          <tr>
            {Array(4).fill(null).map((_, i) => (
              <React.Fragment key={i}>
                <th className="border border-black p-1">Designação</th>
                <th className="border border-black p-1">Conclusão</th>
              </React.Fragment>
            ))}
          </tr>
        </thead>

        {filteredTerritories.map((t, index) => {
          const bg =
            index % 2 === 0
              ? inPdf
                ? "#e5e7eb" // cinza PDF
                : "bg-gray-300"
              : "";

          return (
            <tbody
              key={t.id}
              className="pdf-block"
              style={inPdf ? { backgroundColor: bg as string } : {}}
            >
              <tr className={!inPdf ? bg : ""}>
                <td rowSpan={2} className="border border-black text-center">
                  {t.number}
                </td>
                {Array(4).fill(null).map((_, i) => (
                  <td key={i} colSpan={2} className="border border-black h-6" />
                ))}
              </tr>
              <tr className={!inPdf ? bg : ""}>
                {Array(8).fill(null).map((_, i) => (
                  <td key={i} className="border border-black h-6" />
                ))}
              </tr>
            </tbody>
          );
        })}
      </table>
    </>
  );

  return (
    <>
      {/* CSS DE IMPRESSÃO */}
      <style jsx global>{`
        .pdf-block {
          page-break-inside: avoid;
          break-inside: avoid;
        }
      `}</style>

      {/* BARRA */}
      <div className="p-4 bg-card print-hidden flex justify-between">
        <Button variant="ghost" asChild>
          <Link href="/dashboard/administracao">
            <ArrowLeft size={16} className="mr-2" /> Voltar
          </Link>
        </Button>

        <Button onClick={handlePrint} disabled={isPrinting}>
          {isPrinting ? <Loader className="animate-spin mr-2" /> : <Printer size={16} className="mr-2" />}
          Salvar PDF
        </Button>
      </div>

      {/* VISUAL */}
      <div className="p-4 flex justify-center bg-muted print-hidden">
        <div
          className="bg-white p-4 shadow"
          style={{ width: "200mm", transform: `scale(${scale})` }}
        >
          <ReportContent />
        </div>
      </div>

      {/* PDF */}
      <div
        style={{
          position: "absolute",
          left: "-10000px",
          width: "210mm",
          padding: "10mm",
          background: "white",
          color: "black",
        }}
      >
        <div id="pdf-area">
          <ReportContent inPdf />
        </div>
      </div>
    </>
  );
}
