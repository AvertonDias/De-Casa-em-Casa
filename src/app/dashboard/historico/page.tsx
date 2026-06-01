"use client";

import { useState, useEffect, useMemo } from 'react';
import { useUser } from '@/contexts/UserContext';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, limit, Timestamp } from 'firebase/firestore';
import { AuditLog } from '@/types/types';
import { Loader, History, Search, Filter, X, Clock, User, Info, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import withAuth from '@/components/withAuth';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

function HistoricoPage() {
  const { user } = useUser();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('all');

  const canViewHistory = user?.role === 'Administrador';

  useEffect(() => {
    if (!user?.congregationId || !canViewHistory) {
      if (user) setLoading(false);
      return;
    }

    setLoading(true);
    const logsPath = `congregations/${user.congregationId}/auditLogs`;
    const logsRef = collection(db, logsPath);
    const q = query(logsRef, orderBy('timestamp', 'desc'), limit(150));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as AuditLog));
      setLogs(logsData);
      setLoading(false);
    }, async (error) => {
        if (error.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({
                path: logsPath,
                operation: 'list',
            } satisfies SecurityRuleContext);
            errorEmitter.emit('permission-error', permissionError);
        }
        setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.congregationId, canViewHistory]);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchesSearch = 
        log.userName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        log.details?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesAction = actionFilter === 'all' || log.action === actionFilter;

      return matchesSearch && matchesAction;
    });
  }, [logs, searchTerm, actionFilter]);

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'HOUSE_COMPLETED': return <Badge className="bg-green-500">Conclusão</Badge>;
      case 'HOUSE_UNMARKED': return <Badge variant="outline" className="text-yellow-500 border-yellow-500">Desmarcado</Badge>;
      case 'TERRITORY_DELETED': return <Badge variant="destructive">Exclusão Terr.</Badge>;
      case 'TERRITORY_RESET': return <Badge className="bg-orange-500">Limpeza</Badge>;
      case 'TERRITORY_ASSIGNED': return <Badge className="bg-blue-500">Designação</Badge>;
      case 'TERRITORY_RETURNED': return <Badge className="bg-teal-500">Devolução</Badge>;
      case 'USER_DELETED': return <Badge variant="destructive">Exclusão Usuário</Badge>;
      case 'USER_APPROVED': return <Badge className="bg-green-600">Aprovação</Badge>;
      case 'USER_EDITED': return <Badge variant="secondary">Edição Perfil</Badge>;
      default: return <Badge variant="outline">{action.replace(/_/g, ' ')}</Badge>;
    }
  };

  if (!canViewHistory) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <X className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-2xl font-bold">Acesso Negado</h1>
        <p className="text-muted-foreground">Apenas administradores podem visualizar o histórico de auditoria.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <History className="text-primary" />
            Histórico de Alterações
          </h1>
          <p className="text-muted-foreground">Rastreador de todas as atividades realizadas no aplicativo.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <Input 
            placeholder="Buscar por nome ou ação..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger>
            <div className="flex items-center gap-2">
              <Filter size={16} />
              <SelectValue placeholder="Filtrar tipo" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as ações</SelectItem>
            <SelectItem value="HOUSE_COMPLETED">Conclusão de Casa</SelectItem>
            <SelectItem value="HOUSE_UNMARKED">Desmarcação de Casa</SelectItem>
            <SelectItem value="TERRITORY_ASSIGNED">Designações</SelectItem>
            <SelectItem value="TERRITORY_RETURNED">Devoluções</SelectItem>
            <SelectItem value="TERRITORY_RESET">Limpeza de Território</SelectItem>
            <SelectItem value="TERRITORY_DELETED">Exclusão de Território</SelectItem>
            <SelectItem value="USER_APPROVED">Aprovação de Usuário</SelectItem>
            <SelectItem value="USER_EDITED">Edição de Perfil</SelectItem>
            <SelectItem value="USER_DELETED">Exclusão de Usuário</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card rounded-xl border border-border/40 shadow-md overflow-hidden">
        {loading ? (
           <div className="p-12 text-center">
              <Loader className="animate-spin text-primary mx-auto" size={32} />
              <p className="text-muted-foreground mt-4">Sincronizando logs...</p>
           </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground font-semibold uppercase text-xs">
                <tr>
                  <th className="px-6 py-4">Data e Hora</th>
                  <th className="px-6 py-4">Usuário</th>
                  <th className="px-6 py-4">Ação</th>
                  <th className="px-6 py-4">Detalhes da Alteração</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {filteredLogs.length > 0 ? (
                  filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Clock size={14} />
                          {log.timestamp ? format(log.timestamp.toDate(), "dd/MM/yy HH:mm", { locale: ptBR }) : 'Processando...'}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-bold text-foreground">
                        <div className="flex items-center gap-2">
                          <User size={14} className="text-primary" />
                          {log.userName}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {getActionBadge(log.action)}
                      </td>
                      <td className="px-6 py-4 max-w-xs sm:max-w-md">
                        <div className="flex items-start gap-2">
                          <Info size={14} className="mt-0.5 shrink-0 text-muted-foreground" />
                          <span className="leading-relaxed text-muted-foreground">{log.details}</span>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground italic">
                      <FileText className="mx-auto h-12 w-12 opacity-10 mb-4" />
                      Nenhum registro encontrado com os filtros atuais.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default withAuth(HistoricoPage);