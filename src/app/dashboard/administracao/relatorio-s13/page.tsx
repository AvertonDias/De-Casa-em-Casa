"use client";

import { useState, useEffect } from 'react';
import { useUser } from '@/contexts/UserContext';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { Territory } from '@/types/types';
import { Printer, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Link from 'next/link';

export default function S13ReportPage() {
  const { user } = useUser();
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [loading, setLoading] = useState(true);
  const [serviceYear, setServiceYear] = useState(new Date().getFullYear().toString());

  useEffect(() => {
    if (!user?.congregationId) return;
    const territoriesRef = collection(db, 'congregations', user.congregationId, 'territories');
    const q = query(territoriesRef, orderBy("number", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const territoriesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Territory));
      setTerritories(territoriesData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  // Função para encontrar a última data concluída de um território
  const getLastCompletedDate = (territory: Territory) => {
    if (!territory.assignmentHistory || territory.assignmentHistory.length === 0) {
      return '---';
    }
    const sortedHistory = [...territory.assignmentHistory].sort((a, b) => b.completedAt.toMillis() - a.completedAt.toMillis());
    return format(sortedHistory[0].completedAt.toDate(), "dd/MM/yy", { locale: ptBR });
  };
  
  return (
    <>
      {/* Botões de Ação - Estes serão escondidos na impressão */}
      <div className="p-4 bg-card print:hidden">
        <div className="container mx-auto flex justify-between items-center">
            <Link href="/dashboard/administracao" className="flex items-center text-sm hover:text-primary"><ArrowLeft size={16} className="mr-2"/> Voltar</Link>
            <button onClick={() => window.print()} className="flex items-center px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90">
                <Printer size={16} className="mr-2"/> Imprimir / Salvar PDF
            </button>
        </div>
      </div>

      {/* Conteúdo da Página / Relatório */}
      <div className="bg-white text-black p-8 mx-auto max-w-4xl">
        <h1 className="text-xl font-bold text-center uppercase">REGISTRO DE DESIGNAÇÃO DE TERRITÓRIO</h1>
        <div className="text-center my-4">
            <label htmlFor="service-year" className="font-semibold">Ano de Serviço:</label>
            <input 
              id="service-year"
              type="text" 
              value={serviceYear} 
              onChange={(e) => setServiceYear(e.target.value)} 
              className="border-b-2 border-black focus:outline-none text-center"
            />
        </div>

        <table className="w-full border-collapse border border-black">
          <thead>
            <tr className="text-center text-xs font-semibold">
              <th className="border border-black p-1 w-[8%]">Terr. n.º</th>
              <th className="border border-black p-1 w-[12%]">Última data concluída*</th>
              <th className="border border-black p-1" colSpan={2}>Designado para</th>
              <th className="border border-black p-1" colSpan={2}>Designado para</th>
              <th className="border border-black p-1" colSpan={2}>Designado para</th>
              <th className="border border-black p-1" colSpan={2}>Designado para</th>
            </tr>
            <tr className="text-center text-xs">
              <td className="border border-black"></td>
              <td className="border border-black"></td>
              {Array(4).fill(0).map((_, i) => (
                <>
                  <td className="border border-black p-1">Data da designação</td>
                  <td className="border border-black p-1">Data da conclusão</td>
                </>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
                <tr><td colSpan={10} className="text-center p-4">Carregando dados...</td></tr>
            ) : (
                territories.map(t => (
                    <tr key={t.id} className="h-10 text-sm">
                        <td className="border border-black text-center font-semibold">{t.number}</td>
                        <td className="border border-black text-center">{getLastCompletedDate(t)}</td>
                        {/* Pega as últimas 4 designações do histórico */}
                        {Array(4).fill(null).map((_, i) => {
                            const assignment = (t.assignmentHistory || []).slice(-4)[i];
                            return (
                                <>
                                    <td className="border-t border-b border-black text-center px-1">
                                        <div className="border-r border-black h-full flex flex-col justify-between">
                                            <span>{assignment?.name || ''}</span>
                                            <span className="border-t border-black mt-auto">{assignment ? format(assignment.assignedAt.toDate(), "dd/MM/yy") : ''}</span>
                                        </div>
                                    </td>
                                    <td className="border-t border-b border-black text-center">
                                        <div className="border-r border-black h-full flex items-end justify-center">
                                          <span>{assignment ? format(assignment.completedAt.toDate(), "dd/MM/yy") : ''}</span>
                                        </div>
                                    </td>
                                </>
                            );
                        })}
                    </tr>
                ))
            )}
          </tbody>
        </table>
        <p className="text-xs mt-2">*Ao iniciar uma nova folha, use esta coluna para registrar a data em que cada território foi concluído pela última vez.</p>
        <p className="text-xs text-right">S-13-T 01/22</p>
      </div>

      {/* Estilos específicos para impressão */}
      <style jsx global>{`
        @media print {
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .print-hidden {
            display: none;
          }
        }
      `}</style>
    </>
  );
}
