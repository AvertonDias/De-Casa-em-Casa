"use client";

import React, { useState, useEffect } from 'react';
import { useUser } from '@/contexts/UserContext';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { Territory, AssignmentHistoryLog } from '@/types/types';
import { Printer, ArrowLeft, Map, Trees, ZoomIn, ZoomOut, Loader } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import html2pdf from 'html2pdf.js';

export default function S13ReportPage() {
  const { user } = useUser();
  const [allTerritories, setAllTerritories] = useState<Territory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPrinting, setIsPrinting] = useState(false);
  const [serviceYear, setServiceYear] = useState(new Date().getFullYear().toString());
  const [typeFilter, setTypeFilter] = useState<'urban' | 'rural'>('urban');
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (!user?.congregationId) {
      if(user) setLoading(false);
      return;
    }
    const territoriesRef = collection(db, 'congregations', user.congregationId, 'territories');
    const q = query(territoriesRef, orderBy("number", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAllTerritories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Territory)));
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  const handlePrint = () => {
    setIsPrinting(true);
    const element = document.getElementById('printable-area');
    if (!element) {
        setIsPrinting(false);
        return;
    }
    
    const originalZoom = zoom;
    setZoom(1);

    setTimeout(() => {
        const opt = {
          margin: 0.2,
          filename: `Relatorio-S13-${typeFilter}-${serviceYear}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 1.8, useCORS: true },
          jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
        };
    
        html2pdf().from(element).set(opt).save().then(() => {
            setIsPrinting(false);
            setZoom(originalZoom);
        }).catch(() => {
            setIsPrinting(false);
            setZoom(originalZoom);
        });
    }, 100);
  };

  const filteredTerritories = allTerritories.filter(t => (t.type || 'urban') === typeFilter);
  
  const getLastCompletedDate = (territory: Territory) => {
    const history = territory.assignmentHistory || [];
    if (history.length === 0) return '---';
    const sortedHistory = [...history].sort((a, b) => b.completedAt.toMillis() - a.completedAt.toMillis());
    return format(sortedHistory[0].completedAt.toDate(), "dd/MM/yy", { locale: ptBR });
  };
  
  return (
    <>
      <style jsx global>{`
        @media print {
          body, .print-hidden {
            visibility: hidden;
          }
          #printable-area, #printable-area * {
            visibility: visible;
          }
          #printable-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            transform: scale(1) !important;
          }
          @page {
            size: A4 portrait;
            margin: 1cm;
          }
        }
      `}</style>

      <div className="p-4 bg-card print-hidden">
        <div className="container mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
            <Button variant="ghost" asChild className="self-start sm:self-center">
              <Link href="/dashboard/administracao" className="flex items-center text-sm"><ArrowLeft size={16} className="mr-2"/> Voltar</Link>
            </Button>
            
            <div className="flex flex-wrap gap-2 justify-center">
              <div className="flex bg-input p-1 rounded-lg">
                  <button onClick={() => setTypeFilter('urban')} className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors flex items-center ${typeFilter === 'urban' ? 'bg-primary text-primary-foreground' : 'hover:bg-primary/20'}`}><Map size={14} className="inline mr-2"/> Urbanos</button>
                  <button onClick={() => setTypeFilter('rural')} className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors flex items-center ${typeFilter === 'rural' ? 'bg-primary text-primary-foreground' : 'hover:bg-primary/20'}`}><Trees size={14} className="inline mr-2"/> Rurais</button>
              </div>
               <div className="flex bg-input p-1 rounded-lg">
                <Button variant="ghost" size="sm" onClick={() => setZoom(z => Math.max(0.5, z - 0.1))}><ZoomOut size={16}/></Button>
                <Button variant="ghost" size="sm" onClick={() => setZoom(1)}>100%</Button>
                <Button variant="ghost" size="sm" onClick={() => setZoom(z => Math.min(1.5, z + 0.1))}><ZoomIn size={16}/></Button>
              </div>
            </div>

            <Button onClick={handlePrint} className="w-full sm:w-auto justify-center" disabled={isPrinting}>
                {isPrinting ? <Loader className="animate-spin mr-2"/> : <Printer size={16} className="mr-2"/>}
                {isPrinting ? 'Gerando...' : 'Salvar PDF'}
            </Button>
        </div>
      </div>

      <div className="overflow-x-auto p-4 print:p-0 print:overflow-visible">
        <div 
          id="printable-area" 
          style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
          className="bg-white text-black p-8 mx-auto min-w-[1000px] max-w-[1000px] transition-transform duration-300"
        >
          <h1 className="text-xl font-bold text-center uppercase">REGISTRO DE DESIGNAÇÃO DE TERRITÓRIO ({typeFilter === 'urban' ? 'URBANO' : 'RURAL'})</h1>
          <div className="flex justify-between items-end my-4">
            <div>
                <label htmlFor="service-year" className="font-semibold">Ano de Serviço:</label>
                <input id="service-year" type="text" value={serviceYear} onChange={(e) => setServiceYear(e.target.value)} className="border-b-2 border-black focus:outline-none bg-white w-24 ml-2"/>
            </div>
            <div className="text-right">
                <span className="font-semibold">Congregação:</span>
                <span className="ml-2 pb-1 border-b-2 border-black px-4">{user?.congregationName || '...'}</span>
            </div>
          </div>
          <table className="w-full border-collapse border border-black text-sm">
            <thead>
              <tr className="text-center text-xs font-semibold">
                <th className="border border-black p-1 w-[8%]" rowSpan={2}>Terr. n.º</th>
                <th className="border border-black p-1 w-[12%]" rowSpan={2}>Última data concluída*</th>
                <th className="border border-black p-1 w-[20%]" colSpan={2}>Designado a</th>
                <th className="border border-black p-1 w-[20%]" colSpan={2}>Designado a</th>
                <th className="border border-black p-1 w-[20%]" colSpan={2}>Designado a</th>
                <th className="border border-black p-1 w-[20%]" colSpan={2}>Designado a</th>
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
                filteredTerritories.map(t => {
                    const allAssignments: Partial<AssignmentHistoryLog>[] = [...(t.assignmentHistory || [])];
                    if (t.status === 'designado' && t.assignment) {
                        allAssignments.push({
                            name: t.assignment.name,
                            assignedAt: t.assignment.assignedAt,
                            completedAt: undefined,
                        });
                    }
                    const sortedHistory = allAssignments.sort((a, b) => (a.assignedAt?.toMillis() || 0) - (b.assignedAt?.toMillis() || 0));
                    
                    const displayAssignments = Array(4).fill(null).map((_, i) => sortedHistory[i] || null);

                    return (
                        <tbody key={t.id} style={{ pageBreakInside: 'avoid' }}>
                            <tr className="text-center align-top h-8">
                                <td className="border border-black font-semibold align-middle" rowSpan={2}>{t.number}</td>
                                <td className="border border-black align-middle" rowSpan={2}>{getLastCompletedDate(t)}</td>
                                {displayAssignments.map((assignment, i) => (
                                    <td key={`${t.id}-name-${i}`} className="border-t border-b-0 border-l border-r border-black p-1 font-semibold" colSpan={2}>{assignment?.name || ''}</td>
                                ))}
                            </tr>
                            <tr className="text-center text-xs h-8">
                                {displayAssignments.map((assignment, i) => (
                                    <React.Fragment key={`${t.id}-dates-${i}`}>
                                        <td className="border-t-0 border-b border-l border-r border-black p-1">{assignment?.assignedAt ? format(assignment.assignedAt.toDate(), "dd/MM/yy") : ''}</td>
                                        <td className="border-t-0 border-b border-l border-r border-black p-1">{assignment?.completedAt ? format(assignment.completedAt.toDate(), "dd/MM/yy") : ''}</td>
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
