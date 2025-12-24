
"use client";

import { useUser } from "@/contexts/UserContext";
import { db } from "@/lib/firebase";
import { Territory } from "@/types/types";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { subMonths, differenceInDays } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { Loader, BarChart3, TrendingUp, CalendarCheck, CalendarX, XCircle, Timer, Forward, Printer, Map, Trees, X } from "lucide-react";
import TerritoryListModal from "./TerritoryListModal";
import { Button } from "../ui/button";


interface StatItemProps {
    label: string;
    value: string | number;
    subValue?: string;
    Icon: React.ElementType;
    onClick?: () => void;
    isPrinting?: boolean;
}

const StatItem = ({ label, value, subValue, Icon, onClick, isPrinting }: StatItemProps) => {
    const isClickable = onClick && Number(value) > 0;
    const Wrapper = isClickable ? 'button' : 'div';
    
    return (
        <Wrapper
            onClick={isClickable ? onClick : undefined}
            className={`flex justify-between items-center py-3 border-b border-border/50 w-full text-left ${isClickable ? 'hover:bg-accent/50 transition-colors rounded-md px-2 -mx-2' : ''}`}
        >
            <div className="flex items-center">
                <Icon className={`h-5 w-5 mr-3 ${isPrinting ? 'text-black' : 'text-muted-foreground'}`} />
                <span className={`${isPrinting ? 'text-black' : 'text-foreground/90'}`}>{label}</span>
            </div>
            <div className="text-right">
                <span className={`font-bold text-lg ${isPrinting ? 'text-black' : ''}`}>{value}</span>
                {subValue && <span className={`text-sm  ml-2 ${isPrinting ? 'text-black' : 'text-muted-foreground'}`}>({subValue})</span>}
            </div>
        </Wrapper>
    );
};

export default function TerritoryCoverageStats() {
    const { user } = useUser();
    const [territories, setTerritories] = useState<Territory[]>([]);
    const [loading, setLoading] = useState(true);
    const [typeFilter, setTypeFilter] = useState<'urban' | 'rural'>('urban');
    const [isPrinting, setIsPrinting] = useState(false);
    
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
        const filteredTerritories = territories.filter(t => (t.type || 'urban') === typeFilter);
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
        
        const completionsInLast12Months = filteredTerritories.reduce((acc, t) => {
            const history = t.assignmentHistory || [];
            const completions = history
                .filter(h => h.completedAt && h.completedAt.toDate() >= twelveMonthsAgo)
                .map(h => h.completedAt.toDate());
            return acc.concat(completions);
        }, [] as Date[]);

        filteredTerritories.forEach(t => {
            const history = t.assignmentHistory || [];
            
            const allEvents = history.map(h => (h.completedAt || h.assignedAt).toDate());
            if (t.assignment?.assignedAt) {
                allEvents.push(t.assignment.assignedAt.toDate());
            }

            if (allEvents.length > 0) {
                const lastEventDate = new Date(Math.max(...allEvents.map(d => d.getTime())));
                if (lastEventDate < sixMonthsAgo) notWorkedLast6MonthsTerritories.push(t);
                if (lastEventDate < twelveMonthsAgo) notWorkedLast12MonthsTerritories.push(t);
            } else {
                notWorkedLast6MonthsTerritories.push(t);
                notWorkedLast12MonthsTerritories.push(t);
            }
            
            const completions = history.filter(h => h.completedAt);

            completions.forEach(comp => {
                const assignment = history.find(h => h.completedAt && h.completedAt.isEqual(comp.completedAt));
                if (assignment) {
                     const timeDiff = differenceInDays(comp.completedAt.toDate(), assignment.assignedAt.toDate());
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

    }, [territories, typeFilter]);

    const handleStatClick = (title: string, territories: Territory[]) => {
        setModalTitle(title);
        setTerritoriesToShow(territories);
        setIsModalOpen(true);
    };

    const handlePrint = async () => {
        if (!stats) return;
        setIsPrinting(true);

        const printArea = document.createElement("div");
        printArea.id = "pdf-content";
        printArea.className = "bg-white p-8";
        printArea.style.width = "210mm";
        
        const statsData = {
            "Total de territórios": { value: stats.totalTerritories.count },
            "Em andamento": { value: stats.inProgress.count },
            "Concluído últimos 6 meses": { value: stats.completedLast6Months.count, subValue: `${((stats.completedLast6Months.count / stats.totalTerritories.count) * 100).toFixed(0)}%` },
            "Concluído últimos 12 meses": { value: stats.completedLast12Months.count, subValue: `${((stats.completedLast12Months.count / stats.totalTerritories.count) * 100).toFixed(0)}%` },
            "Não concluído nos últimos 6 meses": { value: stats.notCompletedLast6Months.count, subValue: `${((stats.notCompletedLast6Months.count / stats.totalTerritories.count) * 100).toFixed(0)}%` },
            "Não concluído nos últimos 12 meses": { value: stats.notCompletedLast12Months.count, subValue: `${((stats.notCompletedLast12Months.count / stats.totalTerritories.count) * 100).toFixed(0)}%` },
            "Não trabalhado nos últimos 6 meses": { value: stats.notWorkedLast6Months.count, subValue: `${((stats.notWorkedLast6Months.count / stats.totalTerritories.count) * 100).toFixed(0)}%` },
            "Não trabalhado nos últimos 12 meses": { value: stats.notWorkedLast12Months.count, subValue: `${((stats.notWorkedLast12Months.count / stats.totalTerritories.count) * 100).toFixed(0)}%` },
            "Tempo médio para completar um território": { value: `${stats.avgCompletionTime} Dias` },
            "Estimativa para cobrir tudo": { value: `${stats.estimatedTimeToCompleteAll} Meses` },
        };

        printArea.innerHTML = `
            <div style="color: black; font-family: sans-serif;"> 
                <div style="text-align: center; margin-bottom: 24px;">
                    <h1 style="font-size: 1.25rem; font-weight: bold; color: black;">Relatório de Cobertura - ${typeFilter === 'urban' ? 'Urbanos' : 'Rurais'}</h1>
                    <p style="font-size: 0.875rem; color: #555;">${user?.congregationName}</p>
                </div>
                <div style="font-size: 0.875rem;">
                    ${stats ? Object.entries(statsData).map(([key, item]) => `
                        <div style="display: flex; align-items: center; padding-top: 12px; padding-bottom: 12px; border-bottom: 1px solid #eee;">
                            <span style="color: black; flex-grow: 1;">${key}</span>
                            <div style="text-align: left;">
                                <span style="font-weight: bold; font-size: 1.125rem; color: black;">${item.value}</span>
                                ${item.subValue ? `<span style="font-size: 0.875rem; margin-left: 8px; color: #555;">(${item.subValue})</span>` : ''}
                            </div>
                        </div>
                    `).join('') : ''}
                </div>
            </div>
        `;

        document.body.appendChild(printArea);

        try {
            const html2pdf = (await import("html2pdf.js")).default;
            await html2pdf()
                .from(printArea)
                .set({
                    margin: [15, 10, 15, 10],
                    filename: `Relatorio-de-Cobertura-${typeFilter}.pdf`,
                    image: { type: "jpeg", quality: 0.98 },
                    html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
                    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
                })
                .save();
        } catch (err) {
            console.error("Erro ao gerar PDF:", err);
        } finally {
            document.body.removeChild(printArea);
            setIsPrinting(false);
        }
    };


    if (loading) {
        return <div className="flex justify-center p-8"><Loader className="animate-spin" /></div>;
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
                     <div className="flex items-center gap-2">
                        <Button onClick={() => setTypeFilter("urban")} variant={typeFilter === 'urban' ? 'default' : 'outline'}>
                            <Map size={16} className="mr-2"/>Urbanos
                        </Button>
                        <Button onClick={() => setTypeFilter("rural")} variant={typeFilter === 'rural' ? 'default' : 'outline'}>
                             <Trees size={16} className="mr-2"/>Rurais
                        </Button>
                    </div>
                    <Button onClick={handlePrint} disabled={isPrinting}>
                        <Printer size={16} className="mr-2" />
                        {isPrinting ? "Gerando..." : "Salvar PDF"}
                    </Button>
                </div>

                {!stats ? (
                     <p className="text-muted-foreground text-center py-4">Nenhum território do tipo '{typeFilter === 'urban' ? 'Urbano' : 'Rural'}' encontrado para gerar estatísticas.</p>
                ) : (
                    <div className="space-y-2">
                        <StatItem Icon={BarChart3} label="Total de territórios" value={stats.totalTerritories.count} onClick={() => handleStatClick(`Total de Territórios (${typeFilter})`, stats.totalTerritories.territories)} />
                        <StatItem Icon={TrendingUp} label="Em andamento" value={stats.inProgress.count} onClick={() => handleStatClick("Territórios em Andamento", stats.inProgress.territories)} />
                        <StatItem Icon={CalendarCheck} label="Concluído últimos 6 meses" value={stats.completedLast6Months.count} subValue={`${((stats.completedLast6Months.count / stats.totalTerritories.count) * 100).toFixed(0)}%`} onClick={() => handleStatClick("Concluídos nos Últimos 6 Meses", stats.completedLast6Months.territories)} />
                        <StatItem Icon={CalendarCheck} label="Concluído últimos 12 meses" value={stats.completedLast12Months.count} subValue={`${((stats.completedLast12Months.count / stats.totalTerritories.count) * 100).toFixed(0)}%`} onClick={() => handleStatClick("Concluídos nos Últimos 12 Meses", stats.completedLast12Months.territories)} />
                        <StatItem Icon={CalendarX} label="Não concluído nos últimos 6 meses" value={stats.notCompletedLast6Months.count} subValue={`${((stats.notCompletedLast6Months.count / stats.totalTerritories.count) * 100).toFixed(0)}%`} onClick={() => handleStatClick("Não Concluídos nos Últimos 6 Meses", stats.notCompletedLast6Months.territories)} />
                        <StatItem Icon={CalendarX} label="Não concluído nos últimos 12 meses" value={stats.notCompletedLast12Months.count} subValue={`${((stats.notCompletedLast12Months.count / stats.totalTerritories.count) * 100).toFixed(0)}%`} onClick={() => handleStatClick("Não Concluídos nos Últimos 12 Meses", stats.notCompletedLast12Months.territories)} />
                        <StatItem Icon={XCircle} label="Não trabalhado nos últimos 6 meses" value={stats.notWorkedLast6Months.count} subValue={`${((stats.notWorkedLast6Months.count / stats.totalTerritories.count) * 100).toFixed(0)}%`} onClick={() => handleStatClick("Não Trabalhados nos Últimos 6 Meses", stats.notWorkedLast6Months.territories)} />
                        <StatItem Icon={XCircle} label="Não trabalhado nos últimos 12 meses" value={stats.notWorkedLast12Months.count} subValue={`${((stats.notWorkedLast12Months.count / stats.totalTerritories.count) * 100).toFixed(0)}%`} onClick={() => handleStatClick("Não Trabalhados nos Últimos 12 Meses", stats.notWorkedLast12Months.territories)} />
                        <StatItem Icon={Timer} label="Tempo médio para completar um território" value={`${stats.avgCompletionTime} Dias`} />
                        <StatItem Icon={Forward} label="Estimativa para cobrir tudo" value={`${stats.estimatedTimeToCompleteAll} Meses`} />
                    </div>
                )}
            </div>
        </>
    );
}
