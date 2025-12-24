
"use client";

import { useUser } from "@/contexts/UserContext";
import { db } from "@/lib/firebase";
import { Territory } from "@/types/types";
import { collection, onSnapshot } from "firebase/firestore";
import { subMonths, differenceInDays } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { Loader, BarChart3, TrendingUp, CalendarCheck, CalendarX, XCircle, Timer, Forward } from "lucide-react";
import TerritoryListModal from "./TerritoryListModal";

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
                <Icon className="h-5 w-5 mr-3 text-muted-foreground" />
                <span className="text-foreground/90">{label}</span>
            </div>
            <div className="text-right">
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
        if (territories.length === 0) return null;

        const now = new Date();
        const sixMonthsAgo = subMonths(now, 6);
        const twelveMonthsAgo = subMonths(now, 12);
        
        const urbanTerritories = territories.filter(t => (t.type || 'urban') === 'urban');
        const totalTerritories = urbanTerritories.length;
        if (totalTerritories === 0) return null;
        
        const inProgressTerritories = urbanTerritories.filter(t => t.status === 'designado');
        
        const completedLast6MonthsTerritories: Territory[] = [];
        const completedLast12MonthsTerritories: Territory[] = [];
        const notWorkedLast6MonthsTerritories: Territory[] = [];
        const notWorkedLast12MonthsTerritories: Territory[] = [];
        const completionTimes: number[] = [];
        
        const allCompletedTerritories = new Set<string>();

        urbanTerritories.forEach(t => {
            const history = t.assignmentHistory || [];
            
            const lastEventDate = history.length > 0
                ? history.reduce((latest, entry) => 
                    (entry.completedAt || entry.assignedAt).toDate() > latest ? (entry.completedAt || entry.assignedAt).toDate() : latest,
                    new Date(0)
                  )
                : t.assignment ? t.assignment.assignedAt.toDate() : new Date(0);

            if (lastEventDate < sixMonthsAgo) notWorkedLast6MonthsTerritories.push(t);
            if (lastEventDate < twelveMonthsAgo) notWorkedLast12MonthsTerritories.push(t);
            
            const lastCompletion = history
                .filter(h => h.completedAt)
                .sort((a,b) => b.completedAt.toMillis() - a.completedAt.toMillis())[0];

            if(lastCompletion) {
                const completionDate = lastCompletion.completedAt.toDate();
                allCompletedTerritories.add(t.id);
                if (completionDate >= sixMonthsAgo) completedLast6MonthsTerritories.push(t);
                if (completionDate >= twelveMonthsAgo) completedLast12MonthsTerritories.push(t);
                
                const timeDiff = differenceInDays(completionDate, lastCompletion.assignedAt.toDate());
                if(timeDiff > 0) completionTimes.push(timeDiff);
            }
        });
        
        const notCompletedLast6MonthsTerritories = urbanTerritories.filter(t => 
            !completedLast6MonthsTerritories.find(comp => comp.id === t.id)
        );
        const notCompletedLast12MonthsTerritories = urbanTerritories.filter(t => 
            !completedLast12MonthsTerritories.find(comp => comp.id === t.id)
        );

        const avgCompletionTime = completionTimes.length > 0 
            ? Math.round(completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length)
            : 0;
        
        const estimatedTimeToCompleteAll = avgCompletionTime > 0
            ? Math.round((totalTerritories * avgCompletionTime) / 30) // in months
            : 0;

        return {
            totalTerritories: { count: totalTerritories, territories: urbanTerritories },
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

    if (loading) {
        return <div className="flex justify-center p-8"><Loader className="animate-spin" /></div>;
    }

    if (!stats) {
        return (
            <div className="bg-card p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-bold mb-4 flex items-center"><BarChart3 className="mr-3 text-primary" />Cobertura do Território</h2>
                <p className="text-muted-foreground text-center py-4">Nenhum território urbano encontrado para gerar estatísticas.</p>
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
                <h2 className="text-xl font-bold mb-1">Cobertura do Território</h2>
                <p className="text-sm text-muted-foreground mb-4">Estatísticas referentes apenas aos territórios urbanos.</p>
                
                <div className="space-y-2">
                    <StatItem Icon={BarChart3} label="Total de territórios" value={stats.totalTerritories.count} onClick={() => handleStatClick("Total de Territórios Urbanos", stats.totalTerritories.territories)} />
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
            </div>
        </>
    );
}
