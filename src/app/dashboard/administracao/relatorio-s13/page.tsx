
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

/* ---------- helpers de touch sem conflitar com tipos DOM ---------- */
type TouchPoint = { clientX: number; clientY: number };
const touchToPoint = (t: React.Touch): TouchPoint => ({ clientX: t.clientX, clientY: t.clientY });

/* ---------- distância entre 2 toques ---------- */
const getDistanceFromTouches = (t1: TouchPoint, t2: TouchPoint) =>
  Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

/* ========================= COMPONENTE ========================= */
export default function S13ReportPage() {
  const { user } = useUser();

  const [allTerritories, setAllTerritories] = useState<Territory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPrinting, setIsPrinting] = useState(false);
  const [serviceYear, setServiceYear] = useState(new Date().getFullYear().toString());
  const [typeFilter, setTypeFilter] = useState<"urban" | "rural">("urban");

  /* ---------------- zoom / pan ---------------- */
  const [scale, setScale] = useState<number>(1);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const printableAreaRef = useRef<HTMLDivElement | null>(null);

  // refs para touch/mouse state
  const lastPointerRef = useRef<TouchPoint | null>(null); // último ponto durante drag (touch ou mouse)
  const lastPositionRef = useRef({ x: 0, y: 0 }); // posição acumulada (usada para finalizar drag)
  const initialPinchDistanceRef = useRef<number | null>(null); // distância inicial ao começar pinch
  const initialScaleRef = useRef<number>(1); // scale no início do pinch
  const lastTapRef = useRef<number>(0);

  // limites
  const MIN_SCALE = 0.7;
  const MAX_SCALE = 3.0;

  /* ================== Firestore (sem alterações) ================== */
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

  /* ================== impressão (mantém behavior) ================== */
  const handlePrint = async () => {
    setIsPrinting(true);
    const element = document.getElementById("printable-area");
    if (!element) {
      setIsPrinting(false);
      return;
    }

    // força scale 1 visual enquanto gera PDF
    const savedTransform = element.style.transform;
    element.style.transform = "scale(1) translate(0px, 0px)";

    try {
      const html2pdf = (await import("html2pdf.js")).default;
      const opt = {
        margin: 0.2,
        filename: `Relatorio-S13-${typeFilter}-${serviceYear}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 1.8, useCORS: true },
        jsPDF: { unit: "in", format: "a4", orientation: "portrait" },
      };
      await html2pdf().from(element).set(opt).save();
    } catch (err) {
      console.error("Erro ao gerar PDF:", err);
    } finally {
      element.style.transform = savedTransform;
      setIsPrinting(false);
    }
  };

  /* ================== zoom helpers ================== */
  const clampScale = (s: number) => Math.max(MIN_SCALE, Math.min(s, MAX_SCALE));

  const applyZoom = (newScale: number, center?: { x: number; y: number }) => {
    // Se passar centro, podemos ajustar position para dar sensação de zoom no ponto (opcional).
    // Aqui fazemos zoom simples e mantemos a posição, mas preservamos limites.
    const clamped = clampScale(newScale);
    setScale(clamped);
    if (clamped <= 1) {
      setPosition({ x: 0, y: 0 });
      lastPositionRef.current = { x: 0, y: 0 };
    }
  };

  const handleZoomButtons = (delta: number) => {
    applyZoom(clampScale(scale + delta));
  };

  const handleResetZoom = () => {
    applyZoom(1);
  };

  /* ================== mouse events (desktop) ================== */
  const onMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    lastPointerRef.current = { clientX: e.clientX, clientY: e.clientY };
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !lastPointerRef.current) return;
    const dx = e.clientX - lastPointerRef.current.clientX;
    const dy = e.clientY - lastPointerRef.current.clientY;
    lastPointerRef.current = { clientX: e.clientX, clientY: e.clientY };
    setPosition((p) => {
      const next = { x: p.x + dx, y: p.y + dy };
      lastPositionRef.current = next;
      return next;
    });
  };

  const onMouseUp = () => {
    setIsDragging(false);
    lastPointerRef.current = null;
  };

  /* ================== touch events (mobile) ================== */
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // inicia pinch
      e.preventDefault();
      const p1 = touchToPoint(e.touches[0]);
      const p2 = touchToPoint(e.touches[1]);
      initialPinchDistanceRef.current = getDistanceFromTouches(p1, p2);
      initialScaleRef.current = scale;
    } else if (e.touches.length === 1) {
      // duplo toque?
      e.preventDefault();
      const now = Date.now();
      if (now - lastTapRef.current < 300) {
        // double-tap
        setScale((prev) => {
          const next = prev > 1 ? 1 : 2;
          if (next === 1) {
            setPosition({ x: 0, y: 0 });
            lastPositionRef.current = { x: 0, y: 0 };
          }
          return next;
        });
      }
      lastTapRef.current = now;

      // possível drag
      if (scale > 1) {
        setIsDragging(true);
        lastPointerRef.current = touchToPoint(e.touches[0]);
      }
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialPinchDistanceRef.current !== null) {
      e.preventDefault();
      const p1 = touchToPoint(e.touches[0]);
      const p2 = touchToPoint(e.touches[1]);
      const dist = getDistanceFromTouches(p1, p2);
      if (initialPinchDistanceRef.current > 0) {
        const factor = dist / initialPinchDistanceRef.current;
        const newScale = clampScale(initialScaleRef.current * factor);
        setScale(newScale);
        // não mexemos na posição aqui (poderíamos ajustar para zoom no centro)
      }
    } else if (e.touches.length === 1 && isDragging && lastPointerRef.current) {
      e.preventDefault();
      const p = touchToPoint(e.touches[0]);
      const dx = p.clientX - lastPointerRef.current.clientX;
      const dy = p.clientY - lastPointerRef.current.clientY;
      lastPointerRef.current = p;
      setPosition((prev) => {
        const next = { x: prev.x + dx, y: prev.y + dy };
        lastPositionRef.current = next;
        return next;
      });
    }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    // se acabou a interação com dois dedos, reseta o tracking de pinch
    if (e.touches.length < 2) {
      initialPinchDistanceRef.current = null;
      initialScaleRef.current = scale;
    }
    if (e.touches.length === 0) {
      setIsDragging(false);
      lastPointerRef.current = null;
    }
  };

  /* ================== helpers de render ================== */
  const filteredTerritories = allTerritories.filter((t) => (t.type || "urban") === typeFilter);

  const getLastCompletedDate = (territory: Territory) => {
    const history = territory.assignmentHistory || [];
    if (history.length === 0) return "---";
    const sorted = [...history].sort((a, b) => b.completedAt.toMillis() - a.completedAt.toMillis());
    return format(sorted[0].completedAt.toDate(), "dd/MM/yy", { locale: ptBR });
  };

  /* ================== RENDER JSX ================== */
  return (
    <>
      <style jsx global>{`
        @media print {
          body, .print-hidden { visibility: hidden; }
          #printable-area, #printable-area * { visibility: visible; }
          #printable-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            transform: scale(1) !important;
          }
          @page { size: A4 portrait; margin: 1cm; }
        }
      `}</style>

      <div className="p-4 bg-card print-hidden">
        <div className="container mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <Button variant="ghost" asChild className="self-start sm:self-center">
            <Link href="/dashboard/administracao" className="flex items-center text-sm">
              <ArrowLeft size={16} className="mr-2" /> Voltar
            </Link>
          </Button>

          <div className="flex flex-wrap gap-2 justify-center">
            <div className="flex bg-input p-1 rounded-lg">
              <button onClick={() => setTypeFilter("urban")} className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors flex items-center ${typeFilter === "urban" ? "bg-primary text-primary-foreground" : "hover:bg-primary/20"}`}><Map size={14} className="inline mr-2" /> Urbanos</button>
              <button onClick={() => setTypeFilter("rural")} className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors flex items-center ${typeFilter === "rural" ? "bg-primary text-primary-foreground" : "hover:bg-primary/20"}`}><Trees size={14} className="inline mr-2" /> Rurais</button>
            </div>

            <div className="flex bg-input p-1 rounded-lg">
              <Button variant="ghost" size="sm" onClick={() => handleZoomButtons(-0.1)}><ZoomOut size={16} /></Button>
              <Button variant="ghost" size="sm" onClick={handleResetZoom}><RotateCcw size={14} /></Button>
              <Button variant="ghost" size="sm" onClick={() => handleZoomButtons(0.1)}><ZoomIn size={16} /></Button>
            </div>
          </div>

          <Button onClick={handlePrint} className="w-full sm:w-auto justify-center" disabled={isPrinting}>
            {isPrinting ? <Loader className="animate-spin mr-2" /> : <Printer size={16} className="mr-2" />}
            {isPrinting ? "Gerando..." : "Salvar PDF"}
          </Button>
        </div>
      </div>

      <div
        className="overflow-auto p-4 print:p-0 print:overflow-visible cursor-grab"
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        <div
          id="printable-area"
          ref={printableAreaRef}
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transformOrigin: "center center",
            touchAction: "none",
          }}
          onMouseDown={onMouseDown}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          className="bg-white text-black p-8 mx-auto min-w-[1000px] max-w-[1000px] transition-transform duration-100"
        >
          <h1 className="text-xl font-bold text-center uppercase">REGISTRO DE DESIGNAÇÃO DE TERRITÓRIO ({typeFilter === "urban" ? "URBANO" : "RURAL"})</h1>
          <div className="flex justify-between items-end my-4">
            <div>
              <label htmlFor="service-year" className="font-semibold">Ano de Serviço:</label>
              <input id="service-year" type="text" value={serviceYear} onChange={(e) => setServiceYear(e.target.value)} className="border-b-2 border-black focus:outline-none bg-white w-24 ml-2" />
            </div>
            <div className="text-right">
              <span className="font-semibold">Congregação:</span>
              <span className="ml-2 pb-1 border-b-2 border-black px-4">{user?.congregationName || "..."}</span>
            </div>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="text-center text-xs font-semibold">
                <th className="border border-black p-1" rowSpan={2}>Terr. n.º</th>
                <th className="border border-black p-1" rowSpan={2}>Última data concluída*</th>
                <th className="border border-black p-1" colSpan={2}>Designado a</th>
                <th className="border border-black p-1" colSpan={2}>Designado a</th>
                <th className="border border-black p-1" colSpan={2}>Designado a</th>
                <th className="border border-black p-1" colSpan={2}>Designado a</th>
              </tr>
              <tr className="text-center text-xs font-semibold">
                {Array(4).fill(null).map((_, i) => (
                  <React.Fragment key={i}>
                    <th className="border border-black p-1">Data da designação</th>
                    <th className="border border-black p-1">Data da conclusão</th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>

            {loading ? (
              <tbody>
                <tr><td colSpan={10} className="text-center p-4">Carregando dados...</td></tr>
              </tbody>
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
                  <tbody key={t.id} style={{ pageBreakInside: "avoid" }}>
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

    