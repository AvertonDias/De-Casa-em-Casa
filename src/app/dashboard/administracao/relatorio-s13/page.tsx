"use client";

import React, { useState, useEffect } from 'react';
import { useUser } from '@/contexts/UserContext';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { Territory, AssignmentHistoryLog } from '@/types/types';
import { Printer, ArrowLeft, Map, Trees } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Link from 'next/link';

export default function S13ReportPage() {
  const { user } = useUser();
  const [allTerritories, setAllTerritories] = useState<Territory[]>([]);
  const [loading, setLoading] = useState(true);
  const [serviceYear, setServiceYear] = useState(new Date().getFullYear().toString());
  const [typeFilter, setTypeFilter] = useState<'urban' | 'rural'>('urban');

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

  const filteredTerritories = allTerritories.filter(t => (t.type || 'urban') === typeFilter);
  
  const getLastCompletedDate = (territory: Territory) => {
    const history = territory.assignmentHistory || [];
    if (history.length === 0) return '---';
    const sortedHistory = [...history].sort((a, b) => b.completedAt.toMillis() - a.completedAt.toMillis());
    return format(sortedHistory[0].completedAt.toDate(), "dd/MM/yy", { locale: ptBR });
  };
  
  return (
    <>
      <div className="p-4 bg-card print:hidden">
        <div className="container mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
            <Link href="/dashboard/administracao" className="flex items-center text-sm hover:text-primary"><ArrowLeft size={16} className="mr-2"/> Voltar para Administração</Link>
            <div className="flex bg-input p-1 rounded-lg">
                <button onClick={() => setTypeFilter('urban')} className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${typeFilter === 'urban' ? 'bg-primary text-primary-foreground' : 'hover:bg-primary/20'}`}><Map size={14} className="inline mr-2"/> Urbanos</button>
                <button onClick={() => setTypeFilter('rural')} className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${typeFilter === 'rural' ? 'bg-primary text-primary-foreground' : 'hover:bg-primary/20'}`}><Trees size={14} className="inline mr-2"/> Rurais</button>
            </div>
            <button onClick={() => window.print()} className="flex items-center px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90"><Printer size={16} className="mr-2"/> Imprimir / Salvar PDF</button>
        </div>
      </div>

      <div id="printable-area" className="bg-white text-black p-8 mx-auto max-w-4xl">
        <h1 className="text-xl font-bold text-center uppercase">REGISTRO DE DESIGNAÇÃO DE TERRITÓRIO ({typeFilter === 'urban' ? 'URBANO' : 'RURAL'})</h1>
        <div className="text-center my-4">
            <label htmlFor="service-year" className="font-semibold">Ano de Serviço:</label>
            <input id="service-year" type="text" value={serviceYear} onChange={(e) => setServiceYear(e.target.value)} className="border-b-2 border-black focus:outline-none text-center bg-white"/>
        </div>
        <table className="w-full border-collapse border border-black text-sm">
            <thead>
                <tr className="text-center text-xs font-semibold">
                    <th className="border border-black p-1 w-[8%]">Terr. n.º</th>
                    <th className="border border-black p-1 w-[12%]">Última data concluída*</th>
                    <th className="border border-black p-1" colSpan={2}>Designado para</th>
                    <th className="border border-black p-1" colSpan={2}>Designado para</th>
                    <th className="border border-black p-1" colSpan={2}>Designado para</th>
                    <th className="border border-black p-1" colSpan={2}>Designado para</th>
                </tr>
            </thead>
            <tbody>
                {loading ? (
                    <tr><td colSpan={10} className="text-center p-4">Carregando dados...</td></tr>
                ) : (
                    filteredTerritories.map(t => {
                        let allAssignments: Partial<AssignmentHistoryLog>[] = [...(t.assignmentHistory || [])];
                        if (t.status === 'designado' && t.assignment) {
                            allAssignments.push({
                                name: t.assignment.name,
                                assignedAt: t.assignment.assignedAt,
                            });
                        }
                        const sortedHistory = allAssignments.sort((a, b) => b.assignedAt!.toMillis() - a.assignedAt!.toMillis());
                        return (
                            <tr key={t.id} className="h-10">
                                <td className="border border-black text-center font-semibold">{t.number}</td>
                                <td className="border border-black text-center">{getLastCompletedDate(t)}</td>
                                {Array(4).fill(null).map((_, i) => {
                                    const assignment = sortedHistory[i];
                                    return (
                                      <td key={`${t.id}-d-${i}`} className="border border-black text-center px-1" colSpan={2}>
                                        <div className="flex flex-col justify-between items-center h-full">
                                          <span className="text-xs pt-1">{assignment?.name || ''}</span>
                                          <div className="w-full mt-auto grid grid-cols-2 divide-x divide-black border-t border-black">
                                            <span className="text-xs">{assignment ? format(assignment.assignedAt!.toDate(), "dd/MM/yy") : ''}</span>
                                            <span className="text-xs">{assignment && assignment.completedAt ? format(assignment.completedAt.toDate(), "dd/MM/yy") : ''}</span>
                                          </div>
                                        </div>
                                      </td>
                                    );
                                })}
                            </tr>
                        );
                    })
                )}
            </tbody>
        </table>
        <p className="text-xs mt-2">*Ao iniciar uma nova folha, use esta coluna para registrar a data em que cada território foi concluído pela última vez.</p>
        <p className="text-xs text-right">S-13-T 01/22</p>
      </div>

      <style jsx global>{`
        @media print {
          body > * { display: none !important; }
          #printable-area, #printable-area * { display: block !important; visibility: visible !important; }
          #printable-area { position: absolute; left: 0; top: 0; width: 100%; }
          @page { size: A4 landscape; margin: 1cm; }
        }
      `}</style>
    </>
  );
}
