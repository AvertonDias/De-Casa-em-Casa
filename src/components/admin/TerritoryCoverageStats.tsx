
"use client";

import { useUser } from "@/contexts/UserContext";
import { db } from "@/lib/firebase";
import { Territory } from "@/types/types";
import { collection, onSnapshot } from "firebase/firestore";
import { subMonths, differenceInDays } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { Loader, BarChart3, TrendingUp, CalendarCheck, CalendarX, XCircle, Timer, Forward, Printer, X } from "lucide-react";
import TerritoryListModal from "./TerritoryListModal";
import { Button } from "../ui/button";


interface StatItemProps {
    label: string;
    value: string | number;
    subValue?: string;
    Icon: React.ElementType;
    onClick?: () => void;
}

const StatItem = ({ label, value, subValue, Icon, onClick }: StatItemProps) => {
    const isClickable = onClick && Number(value) > 0;
    const Wrapper = isClickable ? 'button' : 'div';
    
    return (
        <Wrapper
            onClick={isClickable ? onClick : undefined}
            className={`flex justify-between items-center py-3 border-b border-border/50 w-full text-left ${isClickable ? 'hover:bg-accent/50 transition-colors rounded-md px-2 -mx-2' : ''}`}
        >
            <div className="flex items-center">
                <Icon className="h-5 w-5 mr-3 text-muted-foreground print-hidden" />
                <span className="text-foreground/90">{label}</span>
            </div>
            <div className="text-center w-24">
                <span className="font-bold text-lg text-foreground">{value}</span>
                {subValue && <span className="text-sm text-muted-foreground ml-2">({subValue})</span>}
            </div>
        </Wrapper>
    );
};

export default function TerritoryCoverageStats() {
    const { user } = useUser();
    const [territories, setTerritories] = useState<Territory[]>([]);
    const [loading, setLoading] = useState(true);
    const [isPreviewing, setIsPreviewing] = useState(false);
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalTitle, setModalTitle] = useState('');
    const [territoriesToShow, setTerritoriesToShow] = useState<Territory[]>([]);

    useEffect(() => {
        if (!user?.congregationId) return;

        const terRef = collection(db, 'congregations', user.congregationId, 'territories');
        const unsubscribe = onSnapshot(terRef, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Territory);
            setTerritories(data);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user?.congregationId]);

    const stats = useMemo(() => {
        const filteredTerritories = territories.filter(t => (t.type || 'urban') === 'urban');
        if (filteredTerritories.length === 0) return null;

        const now = new Date();
        const sixMonthsAgo = subMonths(now, 6);
        const twelveMonthsAgo = subMonths(now, 12);
        
        const totalTerritories = filteredTerritories.length;
        
        const inProgressTerritories = filteredTerritories.filter(t => t.status === 'designado');
        
        const completedLast6MonthsTerritories: Territory[] = [];
        const completedLast12MonthsTerritories: Territory[] = [];
        
        const notWorkedLast6MonthsTerritories: Territory[] = [];
        const notWorkedLast12MonthsTerritories: Territory[] = [];
        
        const completionTimes: number[] = [];
        const completionsInLast12Months: Date[] = [];

        filteredTerritories.forEach(t => {
            const history = t.assignmentHistory || [];
            
            const allEvents = [...history];
            if (t.assignment) {
                allEvents.push({
                    uid: t.assignment.uid,
                    name: t.assignment.name,
                    assignedAt: t.assignment.assignedAt,
                    completedAt: null as any,
                });
            }

            if (allEvents.length > 0) {
                const lastEventDate = allEvents.reduce((latest, entry) => {
                    const eventDate = (entry.completedAt || entry.assignedAt).toDate();
                    return eventDate > latest ? eventDate : latest;
                }, new Date(0));

                if (lastEventDate < sixMonthsAgo) notWorkedLast6MonthsTerritories.push(t);
                if (lastEventDate < twelveMonthsAgo) notWorkedLast12MonthsTerritories.push(t);
            } else {
                notWorkedLast6MonthsTerritories.push(t);
                notWorkedLast12MonthsTerritories.push(t);
            }
            
            const completions = history.filter(h => h.completedAt);

            completions.forEach(comp => {
                const completionDate = comp.completedAt.toDate();
                if (completionDate >= twelveMonthsAgo) {
                    completionsInLast12Months.push(completionDate);
                }

                const assignment = history.find(h => h.completedAt && h.completedAt.isEqual(comp.completedAt));
                if (assignment) {
                     const timeDiff = differenceInDays(completionDate, assignment.assignedAt.toDate());
                     if (timeDiff > 0) completionTimes.push(timeDiff);
                }
            });

            const lastCompletion = completions.sort((a,b) => b.completedAt.toMillis() - a.completedAt.toMillis())[0];
            if(lastCompletion) {
                const completionDate = lastCompletion.completedAt.toDate();
                if (completionDate >= sixMonthsAgo) completedLast6MonthsTerritories.push(t);
                if (completionDate >= twelveMonthsAgo) completedLast12MonthsTerritories.push(t);
            }
        });
        
        const notCompletedLast6MonthsTerritories = filteredTerritories.filter(t => 
            !completedLast6MonthsTerritories.find(comp => comp.id === t.id)
        );
        const notCompletedLast12MonthsTerritories = filteredTerritories.filter(t => 
            !completedLast12MonthsTerritories.find(comp => comp.id === t.id)
        );

        const avgCompletionTime = completionTimes.length > 0 
            ? Math.round(completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length)
            : 0;
        
        const monthlyCompletionRate = completionsInLast12Months.length / 12;
        const estimatedTimeToCompleteAll = monthlyCompletionRate > 0
            ? Math.round(totalTerritories / monthlyCompletionRate)
            : 0;

        return {
            totalTerritories: { count: totalTerritories, territories: filteredTerritories },
            inProgress: { count: inProgressTerritories.length, territories: inProgressTerritories },
            completedLast6Months: { count: completedLast6MonthsTerritories.length, territories: completedLast6MonthsTerritories },
            completedLast12Months: { count: completedLast12MonthsTerritories.length, territories: completedLast12MonthsTerritories },
            notCompletedLast6Months: { count: notCompletedLast6MonthsTerritories.length, territories: notCompletedLast6MonthsTerritories },
            notCompletedLast12Months: { count: notCompletedLast12MonthsTerritories.length, territories: notCompletedLast12MonthsTerritories },
            notWorkedLast6Months: { count: notWorkedLast6MonthsTerritories.length, territories: notWorkedLast6MonthsTerritories },
            notWorkedLast12Months: { count: notWorkedLast12MonthsTerritories.length, territories: notWorkedLast12MonthsTerritories },
            avgCompletionTime,
            estimatedTimeToCompleteAll,
        };

    }, [territories]);

    const handleStatClick = (title: string, territories: Territory[]) => {
        setModalTitle(title);
        setTerritoriesToShow(territories);
        setIsModalOpen(true);
    };

    const handlePrint = () => {
        window.print();
    };

    if (loading) {
        return <div className="flex justify-center p-8"><Loader className="animate-spin" /></div>;
    }

    if (isPreviewing) {
        return (
            <div className="fixed inset-0 bg-muted z-50 p-8 overflow-y-auto">
                <div className="flex justify-end gap-4 mb-8">
                    <Button variant="outline" onClick={() => setIsPreviewing(false)}>
                        <X className="mr-2"/> Sair da Visualização
                    </Button>
                    <Button onClick={handlePrint}>
                        <Printer className="mr-2"/> Imprimir
                    </Button>
                </div>
                <div id="stats-print-area" className="bg-white mx-auto" style={{width: '210mm'}}>
                    <div className="p-8 text-black">
                        <div className="print-header text-center mb-6">
                            <h1 className="text-xl font-bold text-black">Relatório de Cobertura - Urbanos</h1>
                            <p className="text-sm text-gray-600">{user?.congregationName}</p>
                        </div>
                        <div className="space-y-2">
                          {stats && (
                            <>
                              <StatItem Icon={BarChart3} label="Total de territórios" value={stats.totalTerritories.count} />
                              <StatItem Icon={TrendingUp} label="Em andamento" value={stats.inProgress.count} />
                              <StatItem Icon={CalendarCheck} label="Concluído últimos 6 meses" value={stats.completedLast6Months.count} subValue={`${((stats.completedLast6Months.count / stats.totalTerritories.count) * 100).toFixed(0)}%`} />
                              <StatItem Icon={CalendarCheck} label="Concluído últimos 12 meses" value={stats.completedLast12Months.count} subValue={`${((stats.completedLast12Months.count / stats.totalTerritories.count) * 100).toFixed(0)}%`} />
                              <StatItem Icon={CalendarX} label="Não concluído nos últimos 6 meses" value={stats.notCompletedLast6Months.count} subValue={`${((stats.notCompletedLast6Months.count / stats.totalTerritories.count) * 100).toFixed(0)}%`} />
                              <StatItem Icon={CalendarX} label="Não concluído nos últimos 12 meses" value={stats.notCompletedLast12Months.count} subValue={`${((stats.notCompletedLast12Months.count / stats.totalTerritories.count) * 100).toFixed(0)}%`} />
                              <StatItem Icon={XCircle} label="Não trabalhado nos últimos 6 meses" value={stats.notWorkedLast6Months.count} subValue={`${((stats.notWorkedLast6Months.count / stats.totalTerritories.count) * 100).toFixed(0)}%`} />
                              <StatItem Icon={XCircle} label="Não trabalhado nos últimos 12 meses" value={stats.notWorkedLast12Months.count} subValue={`${((stats.notWorkedLast12Months.count / stats.totalTerritories.count) * 100).toFixed(0)}%`} />
                              <StatItem Icon={Timer} label="Tempo médio para completar um território" value={`${stats.avgCompletionTime} Dias`} />
                              <StatItem Icon={Forward} label="Tempo estimado para completar todo o território" value={`${stats.estimatedTimeToCompleteAll} Meses`} />
                            </>
                          )}
                        </div>
                    </div>
                </div>
                 <style jsx global>{`
                    @media print {
                        body {
                            background-color: white !important;
                        }
                        .fixed.inset-0 {
                            position: static;
                            overflow: visible;
                            padding: 0;
                        }
                        .flex.justify-end {
                            display: none;
                        }
                        #stats-print-area {
                            box-shadow: none;
                            border: none;
                            width: 100%;
                        }
                    }
                `}</style>
            </div>
        );
    }


    return (
        <>
            <TerritoryListModal 
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={modalTitle}
                territories={territoriesToShow}
            />
            <div className="bg-card p-6 rounded-lg shadow-md">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4 gap-4">
                    <h2 className="text-xl font-bold">Cobertura (Territórios Urbanos)</h2>
                    <Button onClick={() => setIsPreviewing(true)}>
                        <Printer size={16} className="mr-2" />
                        Visualizar Impressão
                    </Button>
                </div>

                {!stats ? (
                     <p className="text-muted-foreground text-center py-4">Nenhum território do tipo 'Urbano' encontrado para gerar estatísticas.</p>
                ) : (
                    <div className="space-y-2">
                        <StatItem Icon={BarChart3} label="Total de territórios" value={stats.totalTerritories.count} onClick={() => handleStatClick(`Total de Territórios (urbanos)`, stats.totalTerritories.territories)} />
                        <StatItem Icon={TrendingUp} label="Em andamento" value={stats.inProgress.count} onClick={() => handleStatClick("Territórios em Andamento", stats.inProgress.territories)} />
                        <StatItem Icon={CalendarCheck} label="Concluído últimos 6 meses" value={stats.completedLast6Months.count} subValue={`${((stats.completedLast6Months.count / stats.totalTerritories.count) * 100).toFixed(0)}%`} onClick={() => handleStatClick("Concluídos nos Últimos 6 Meses", stats.completedLast6Months.territories)} />
                        <StatItem Icon={CalendarCheck} label="Concluído últimos 12 meses" value={stats.completedLast12Months.count} subValue={`${((stats.completedLast12Months.count / stats.totalTerritories.count) * 100).toFixed(0)}%`} onClick={() => handleStatClick("Concluídos nos Últimos 12 Meses", stats.completedLast12Months.territories)} />
                        <StatItem Icon={CalendarX} label="Não concluído nos últimos 6 meses" value={stats.notCompletedLast6Months.count} subValue={`${((stats.notCompletedLast6Months.count / stats.totalTerritories.count) * 100).toFixed(0)}%`} onClick={() => handleStatClick("Não Concluídos nos Últimos 6 Meses", stats.notCompletedLast6Months.territories)} />
                        <StatItem Icon={CalendarX} label="Não concluído nos últimos 12 meses" value={stats.notCompletedLast12Months.count} subValue={`${((stats.notCompletedLast12Months.count / stats.totalTerritories.count) * 100).toFixed(0)}%`} onClick={() => handleStatClick("Não Concluídos nos Últimos 12 Meses", stats.notCompletedLast12Months.territories)} />
                        <StatItem Icon={XCircle} label="Não trabalhado nos últimos 6 meses" value={stats.notWorkedLast6Months.count} subValue={`${((stats.notWorkedLast6Months.count / stats.totalTerritories.count) * 100).toFixed(0)}%`} onClick={() => handleStatClick("Não Trabalhados nos Últimos 6 Meses", stats.notWorkedLast6Months.territories)} />
                        <StatItem Icon={XCircle} label="Não trabalhado nos últimos 12 meses" value={stats.notWorkedLast12Months.count} subValue={`${((stats.notWorkedLast12Months.count / stats.totalTerritories.count) * 100).toFixed(0)}%`} onClick={() => handleStatClick("Não Trabalhados nos Últimos 12 Meses", stats.notWorkedLast12Months.territories)} />
                        <StatItem Icon={Timer} label="Tempo médio para completar um território" value={`${stats.avgCompletionTime} Dias`} />
                        <StatItem Icon={Forward} label="Tempo estimado para completar todo o território" value={`${stats.estimatedTimeToCompleteAll} Meses`} />
                    </div>
                )}
            </div>
        </>
    );
}
