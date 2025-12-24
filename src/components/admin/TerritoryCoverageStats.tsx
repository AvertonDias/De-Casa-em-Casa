
"use client";

import { useUser } from "@/contexts/UserContext";
import { db } from "@/lib/firebase";
import { Territory } from "@/types/types";
import { collection, onSnapshot } from "firebase/firestore";
import { subMonths, differenceInDays } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { Loader, BarChart3, TrendingUp, CalendarCheck, CalendarX, XCircle, Timer, Forward } from "lucide-react";

interface StatItemProps {
    label: string;
    value: string | number;
    subValue?: string;
    Icon: React.ElementType;
}

const StatItem = ({ label, value, subValue, Icon }: StatItemProps) => (
    <div className="flex justify-between items-center py-3 border-b border-border/50">
        <div className="flex items-center">
            <Icon className="h-5 w-5 mr-3 text-muted-foreground" />
            <span className="text-foreground/90">{label}</span>
        </div>
        <div className="text-right">
            <span className="font-bold text-lg text-foreground">{value}</span>
            {subValue && <span className="text-sm text-muted-foreground ml-2">({subValue})</span>}
        </div>
    </div>
);


export default function TerritoryCoverageStats() {
    const { user } = useUser();
    const [territories, setTerritories] = useState<Territory[]>([]);
    const [loading, setLoading] = useState(true);

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
        
        const inProgress = urbanTerritories.filter(t => t.status === 'designado').length;
        
        let completedLast6Months = 0;
        let completedLast12Months = 0;
        let notWorkedLast6Months = 0;
        let notWorkedLast12Months = 0;
        const completionTimes: number[] = [];

        urbanTerritories.forEach(t => {
            const history = t.assignmentHistory || [];
            if (history.length === 0 && !t.assignment) {
                notWorkedLast6Months++;
                notWorkedLast12Months++;
                return;
            }

            const lastEventDate = history.length > 0
                ? history.reduce((latest, entry) => 
                    (entry.completedAt || entry.assignedAt).toDate() > latest ? (entry.completedAt || entry.assignedAt).toDate() : latest,
                    new Date(0)
                  )
                : t.assignment!.assignedAt.toDate();

            const lastCompletion = history
                .filter(h => h.completedAt)
                .sort((a,b) => b.completedAt.toMillis() - a.completedAt.toMillis())[0];

            if(lastCompletion) {
                const completionDate = lastCompletion.completedAt.toDate();
                if (completionDate >= sixMonthsAgo) completedLast6Months++;
                if (completionDate >= twelveMonthsAgo) completedLast12Months++;
                
                const timeDiff = differenceInDays(completionDate, lastCompletion.assignedAt.toDate());
                if(timeDiff > 0) completionTimes.push(timeDiff);
            }
            
            if (lastEventDate < sixMonthsAgo) notWorkedLast6Months++;
            if (lastEventDate < twelveMonthsAgo) notWorkedLast12Months++;
        });

        const notCompletedLast6Months = totalTerritories - completedLast6Months;
        const notCompletedLast12Months = totalTerritories - completedLast12Months;

        const avgCompletionTime = completionTimes.length > 0 
            ? Math.round(completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length)
            : 0;
        
        const estimatedTimeToCompleteAll = avgCompletionTime > 0
            ? Math.round((totalTerritories * avgCompletionTime) / 30) // in months
            : 0;

        return {
            totalTerritories,
            inProgress,
            completedLast6Months,
            completedLast6MonthsPerc: ((completedLast6Months / totalTerritories) * 100).toFixed(0),
            completedLast12Months,
            completedLast12MonthsPerc: ((completedLast12Months / totalTerritories) * 100).toFixed(0),
            notCompletedLast6Months,
            notCompletedLast6MonthsPerc: ((notCompletedLast6Months / totalTerritories) * 100).toFixed(0),
            notCompletedLast12Months,
            notCompletedLast12MonthsPerc: ((notCompletedLast12Months / totalTerritories) * 100).toFixed(0),
            notWorkedLast6Months,
            notWorkedLast6MonthsPerc: ((notWorkedLast6Months / totalTerritories) * 100).toFixed(0),
            notWorkedLast12Months,
            notWorkedLast12MonthsPerc: ((notWorkedLast12Months / totalTerritories) * 100).toFixed(0),
            avgCompletionTime,
            estimatedTimeToCompleteAll
        };

    }, [territories]);

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
        <div className="bg-card p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-bold mb-1">Cobertura do Território</h2>
            <p className="text-sm text-muted-foreground mb-4">Estatísticas referentes apenas aos territórios urbanos.</p>
            
            <div className="space-y-2">
                <StatItem Icon={BarChart3} label="Total de territórios" value={stats.totalTerritories} />
                <StatItem Icon={TrendingUp} label="Em andamento" value={stats.inProgress} />
                <StatItem Icon={CalendarCheck} label="Concluído últimos 6 meses" value={stats.completedLast6Months} subValue={`${stats.completedLast6MonthsPerc}%`} />
                <StatItem Icon={CalendarCheck} label="Concluído últimos 12 meses" value={stats.completedLast12Months} subValue={`${stats.completedLast12MonthsPerc}%`} />
                <StatItem Icon={CalendarX} label="Não concluído nos últimos 6 meses" value={stats.notCompletedLast6Months} subValue={`${stats.notCompletedLast6MonthsPerc}%`} />
                <StatItem Icon={CalendarX} label="Não concluído nos últimos 12 meses" value={stats.notCompletedLast12Months} subValue={`${stats.notCompletedLast12MonthsPerc}%`} />
                <StatItem Icon={XCircle} label="Não trabalhou nos últimos 6 meses" value={stats.notWorkedLast6Months} subValue={`${stats.notWorkedLast6MonthsPerc}%`} />
                <StatItem Icon={XCircle} label="Não trabalhou nos últimos 12 meses" value={stats.notWorkedLast12Months} subValue={`${stats.notWorkedLast12MonthsPerc}%`} />
                <StatItem Icon={Timer} label="Tempo médio para completar um território" value={`${stats.avgCompletionTime} Dias`} />
                <StatItem Icon={Forward} label="Tempo estimado para completar todo o território" value={`${stats.estimatedTimeToCompleteAll} Meses`} />
            </div>
        </div>
    );
}
