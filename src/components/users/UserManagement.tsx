
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useUser } from '@/contexts/UserContext';
import { db, auth, rtdb } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { ref, onValue } from 'firebase/database';
import { Loader, Search, SlidersHorizontal, X, Users as UsersIcon, Wifi, Check } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { UserListItem } from './UserListItem';
import { EditUserByAdminModal } from './EditUserByAdminModal';
import { subDays, subMonths, subHours } from 'date-fns';
import type { AppUser } from '@/types/types';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { cn } from '@/lib/utils';

export default function UserManagement() {
  const { user: currentUser, loading: userLoading } = useUser(); 
  const { toast } = useToast();

  const [users, setUsers] = useState<AppUser[]>([]);
  const [presenceData, setPresenceData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [presenceFilter, setPresenceFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [roleFilter, setRoleFilter] = useState<'all' | 'Administrador' | 'Dirigente' | 'Servo de Territórios' | 'Ajudante de Servo de Territórios' | 'Publicador'>('all');
  const [activityFilter, setActivityFilter] = useState<'all' | 'active_hourly' | 'active_daily' | 'active_weekly' | 'inactive_month'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ativo' | 'pendente' | 'inativo' | 'rejeitado' | 'bloqueado'>('all');

  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<{uid: string, name: string} | null>(null);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<AppUser | null>(null);

  useEffect(() => {
    if (currentUser?.congregationId) {
      setLoading(true);
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where("congregationId", "==", currentUser.congregationId));
      const unsubUsers = onSnapshot(q, (snapshot) => {
        const usersData = snapshot.docs.map(docSnap => ({ uid: docSnap.id, ...docSnap.data() } as AppUser));
        setUsers(usersData);
        setLoading(false);
      }, async (error) => {
          if (error.code === 'permission-denied') {
              const permissionError = new FirestorePermissionError({
                  path: usersRef.path,
                  operation: 'list',
              });
              errorEmitter.emit('permission-error', permissionError);
          }
      });

      const statusRef = ref(rtdb, 'status');
      const unsubPresence = onValue(statusRef, (snapshot) => {
        setPresenceData(snapshot.val() || {});
      });

      return () => { unsubUsers(); unsubPresence(); };
    }
  }, [currentUser]);

  const usersWithPresence = useMemo(() => {
    const now = new Date();
    const oneMonthAgo = subMonths(now, 1);
    
    return users.map(u => {
        const presence = presenceData[u.uid];
        const isOnline = presence?.state === 'online';
        
        let effectiveLastSeenDate: Date | null = null;
        if (u.lastSeen && typeof u.lastSeen.toDate === 'function') {
            effectiveLastSeenDate = u.lastSeen.toDate();
        }
        if (presence?.last_changed) {
            const rtdbDate = new Date(presence.last_changed);
            if (!effectiveLastSeenDate || rtdbDate > effectiveLastSeenDate) {
                effectiveLastSeenDate = rtdbDate;
            }
        }
        if (isOnline) {
            effectiveLastSeenDate = now;
        }

        let status = u.status;
        if (status === 'ativo' && effectiveLastSeenDate && effectiveLastSeenDate < oneMonthAgo) {
            status = 'inativo';
        }
        
        return { 
            ...u, 
            isOnline, 
            status,
            effectiveLastSeen: effectiveLastSeenDate 
        };
    });
  }, [users, presenceData]);

  const filterCounts = useMemo(() => {
    const counts = {
      status: { all: 0, ativo: 0, pendente: 0, inativo: 0, rejeitado: 0, bloqueado: 0 },
      presence: { all: 0, online: 0, offline: 0 },
      role: { all: 0, Administrador: 0, Dirigente: 0, 'Servo de Territórios': 0, 'Ajudante de Servo de Territórios': 0, Publicador: 0 },
      activity: { all: 0, active_hourly: 0, active_daily: 0, active_weekly: 0, inactive_month: 0 }
    };
    
    const now = new Date();
    const oneHourAgo = subHours(now, 1);
    const oneDayAgo = subHours(now, 24);
    const oneWeekAgo = subDays(now, 7);

    usersWithPresence.forEach(u => {
      counts.status.all++;
      if (u.status in counts.status) counts.status[u.status as keyof typeof counts.status.ativo]++;
      counts.presence.all++;
      if (u.isOnline) counts.presence.online++; else counts.presence.offline++;
      counts.role.all++;
      if (u.role in counts.role) counts.role[u.role as keyof typeof counts.role.Publicador]++;
      counts.activity.all++;
      const lastSeen = u.effectiveLastSeen;
      if (lastSeen) {
        if (lastSeen > oneHourAgo) counts.activity.active_hourly++;
        if (lastSeen > oneDayAgo) counts.activity.active_daily++;
        if (lastSeen > oneWeekAgo) counts.activity.active_weekly++;
      }
      if (u.status === 'inativo') counts.activity.inactive_month++;
    });
    return counts;
  }, [usersWithPresence]);

  const handleUserUpdate = async (userId: string, dataToUpdate: Partial<AppUser>) => {
    if (!currentUser || (currentUser.role !== 'Administrador' && currentUser.role !== 'Dirigente')) return;
    const userRef = doc(db, 'users', userId);
    updateDoc(userRef, dataToUpdate as any).then(() => {
        toast({ title: "Sucesso", description: "Usuário atualizado." });
    }).catch(async (error) => {
        if (error.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({
                path: userRef.path,
                operation: 'update',
                requestResourceData: dataToUpdate,
            });
            errorEmitter.emit('permission-error', permissionError);
        }
    });
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete || currentUser?.role !== 'Administrador' || !auth.currentUser) return;
    
    const userId = userToDelete.uid;
    setIsConfirmModalOpen(false);
    
    try {
      toast({ title: "Processando Exclusão", description: "Removendo acesso e dados permanentemente..." });
      
      const idToken = await auth.currentUser.getIdToken();
      
      // Chamada direta via HTTPS para máxima compatibilidade com CORS no ambiente Cloud Workstations
      const response = await fetch('https://southamerica-east1-appterritorios-e5bb5.cloudfunctions.net/deleteUserAccountV2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ userIdToDelete: userId })
      });

      const result = await response.json();

      if (response.ok && result.data?.success) {
        toast({ 
            title: "Usuário Excluído", 
            description: result.data.message || "A conta e os dados foram removidos com sucesso." 
        });
      } else {
        const errorMsg = result.error?.message || "Ocorreu um erro ao processar a exclusão no servidor.";
        throw new Error(errorMsg);
      }
    } catch (e: any) {
      console.error("Erro na exclusão remota:", e);
      toast({
        variant: "destructive",
        title: "Falha na Exclusão",
        description: e.message || "Não foi possível completar a exclusão remota. Verifique sua conexão.",
      });
    } finally {
        setUserToDelete(null);
    }
  };

  const filteredAndSortedUsers = useMemo(() => {
    const now = new Date();
    const oneHourAgo = subHours(now, 1);
    const oneDayAgo = subHours(now, 24);
    const oneWeekAgo = subDays(now, 7);

    let filtered = usersWithPresence.filter(u => {
        const matchesPresence = presenceFilter === 'all' || u.isOnline === (presenceFilter === 'online');
        const matchesRole = roleFilter === 'all' || u.role === roleFilter;
        const matchesStatus = statusFilter === 'all' || u.status === statusFilter;
        
        let matchesActivity = true;
        const lastSeen = u.effectiveLastSeen;
        if (activityFilter !== 'all') {
            if (activityFilter === 'active_hourly') matchesActivity = !!lastSeen && lastSeen > oneHourAgo;
            else if (activityFilter === 'active_daily') matchesActivity = !!lastSeen && lastSeen > oneDayAgo;
            else if (activityFilter === 'active_weekly') matchesActivity = !!lastSeen && lastSeen > oneWeekAgo;
            else if (activityFilter === 'inactive_month') matchesActivity = u.status === 'inativo';
        }

        const matchesSearch = !searchTerm || u.name.toLowerCase().includes(searchTerm.toLowerCase()) || u.email?.toLowerCase().includes(searchTerm.toLowerCase());
        
        return matchesPresence && matchesRole && matchesStatus && matchesActivity && matchesSearch;
    });
    
    return filtered.sort((a, b) => {
      if (a.uid === currentUser?.uid) return -1;
      if (b.uid === currentUser?.uid) return 1;
      if (a.status === 'pendente' && b.status !== 'pendente') return -1;
      if (a.status !== 'pendente' && b.status === 'pendente') return 1;
      return a.name.localeCompare(b.name);
    });
  }, [usersWithPresence, presenceFilter, roleFilter, statusFilter, activityFilter, searchTerm, currentUser]);

  const FilterButtonComponent = ({ label, value, currentFilter, setFilter, count }: { label: string, value: string, currentFilter: string, setFilter: (value: any) => void, count?: number}) => {
    const isActive = currentFilter === value;
    return (
      <button 
        onClick={() => setFilter(value)} 
        className={cn(
          "px-4 py-1.5 text-xs rounded-full transition-all flex items-center gap-2 whitespace-nowrap",
          isActive 
            ? "bg-primary text-white font-bold shadow-md" 
            : "bg-[#2f2b3a] text-muted-foreground hover:bg-[#3a354a] border border-border/20"
        )}
      >
        {label} 
        {count !== undefined && (
          <span className={cn(
            "px-2 py-0.5 rounded-full text-[10px] font-bold min-w-[20px] text-center",
            isActive ? "bg-white text-primary" : "bg-[#4a4458] text-white"
          )}>
            {count}
          </span>
        )}
      </button>
    );
  };

  if (userLoading || loading) return <div className="flex justify-center items-center h-full"><Loader className="animate-spin text-purple-500" size={32} /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center px-4 md:px-0">
        <div>
          <h1 className="text-3xl font-bold">Gerenciamento de Usuários</h1>
          <p className="text-muted-foreground">Monitore e gerencie os membros da congregação.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 px-4 md:px-0">
        <div className="bg-card p-6 rounded-lg shadow-md flex items-center gap-4 border border-border/40">
          <div className="bg-blue-500/20 text-blue-400 p-3 rounded-lg"><UsersIcon size={28} /></div>
          <div><p className="text-sm text-muted-foreground">Total</p><p className="text-2xl font-bold">{filterCounts.status.all}</p></div>
        </div>
        <div className="bg-card p-6 rounded-lg shadow-md flex items-center gap-4 border border-border/40">
          <div className="bg-green-500/20 text-green-400 p-3 rounded-lg"><Wifi size={28} /></div>
          <div><p className="text-sm text-muted-foreground">Online</p><p className="text-2xl font-bold">{filterCounts.presence.online}</p></div>
        </div>
        <div className="bg-card p-6 rounded-lg shadow-md flex items-center gap-4 border border-border/40">
          <div className="bg-yellow-500/20 text-yellow-400 p-3 rounded-lg"><Check size={28}/></div>
          <div><p className="text-sm text-muted-foreground">Pendentes</p><p className="text-2xl font-bold">{filterCounts.status.pendente}</p></div>
        </div>
      </div>

      <div className="mx-4 md:mx-0">
        <Accordion type="single" collapsible defaultValue="" className="w-full bg-card rounded-xl border border-border/40 shadow-sm overflow-hidden">
          <AccordionItem value="filters" className="border-b-0">
            <AccordionTrigger className="flex items-center gap-2 px-6 py-4 text-muted-foreground hover:no-underline hover:bg-white/5 transition-all">
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={20} />
                <span className="font-semibold text-foreground">Filtros</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6 pt-0 border-t border-border/10">
              <div className="space-y-6 pt-6">
                <div className="space-y-3">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Status da Conta</p>
                  <div className="flex flex-wrap gap-2">
                    <FilterButtonComponent label="Todos" value="all" currentFilter={statusFilter} setFilter={setStatusFilter} count={filterCounts.status.all} />
                    <FilterButtonComponent label="Ativo" value="ativo" currentFilter={statusFilter} setFilter={setStatusFilter} count={filterCounts.status.ativo} />
                    <FilterButtonComponent label="Pendente" value="pendente" currentFilter={statusFilter} setFilter={setStatusFilter} count={filterCounts.status.pendente} />
                    <FilterButtonComponent label="Inativo" value="inativo" currentFilter={statusFilter} setFilter={setStatusFilter} count={filterCounts.status.inativo} />
                    <FilterButtonComponent label="Rejeitado" value="rejeitado" currentFilter={statusFilter} setFilter={setStatusFilter} count={filterCounts.status.rejeitado} />
                    <FilterButtonComponent label="Bloqueado" value="bloqueado" currentFilter={statusFilter} setFilter={setStatusFilter} count={filterCounts.status.bloqueado} />
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Presença</p>
                  <div className="flex flex-wrap gap-2">
                    <FilterButtonComponent label="Todos" value="all" currentFilter={presenceFilter} setFilter={setPresenceFilter} count={filterCounts.presence.all} />
                    <FilterButtonComponent label="Online" value="online" currentFilter={presenceFilter} setFilter={setPresenceFilter} count={filterCounts.presence.online} />
                    <FilterButtonComponent label="Offline" value="offline" currentFilter={presenceFilter} setFilter={setPresenceFilter} count={filterCounts.presence.offline} />
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Perfil</p>
                  <div className="flex flex-wrap gap-2">
                    <FilterButtonComponent label="Todos" value="all" currentFilter={roleFilter} setFilter={setRoleFilter} count={filterCounts.role.all} />
                    <FilterButtonComponent label="Admin" value="Administrador" currentFilter={roleFilter} setFilter={setRoleFilter} count={filterCounts.role.Administrador} />
                    <FilterButtonComponent label="Dirigente" value="Dirigente" currentFilter={roleFilter} setFilter={setRoleFilter} count={filterCounts.role.Dirigente} />
                    <FilterButtonComponent label="Servo" value="Servo de Territórios" currentFilter={roleFilter} setFilter={setRoleFilter} count={filterCounts.role['Servo de Territórios']} />
                    <FilterButtonComponent label="Ajudante" value="Ajudante de Servo de Territórios" currentFilter={roleFilter} setFilter={setRoleFilter} count={filterCounts.role['Ajudante de Servo de Territórios']} />
                    <FilterButtonComponent label="Publicador" value="Publicador" currentFilter={roleFilter} setFilter={setRoleFilter} count={filterCounts.role.Publicador} />
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Atividade</p>
                  <div className="flex flex-wrap gap-2">
                    <FilterButtonComponent label="Todos" value="all" currentFilter={activityFilter} setFilter={setActivityFilter} count={filterCounts.activity.all} />
                    <FilterButtonComponent label="Última Hora" value="active_hourly" currentFilter={activityFilter} setFilter={setActivityFilter} count={filterCounts.activity.active_hourly} />
                    <FilterButtonComponent label="Hoje" value="active_daily" currentFilter={activityFilter} setFilter={setActivityFilter} count={filterCounts.activity.active_daily} />
                    <FilterButtonComponent label="Semana" value="active_weekly" currentFilter={activityFilter} setFilter={setActivityFilter} count={filterCounts.activity.active_weekly} />
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      <div className="relative px-4 md:px-0">
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={20} />
          <input 
            type="text" 
            placeholder="Buscar por nome ou e-mail..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            className="w-full pl-12 pr-12 py-3 bg-card border border-border/40 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all shadow-sm" 
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')} 
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-muted"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>
      
      <div className="bg-card rounded-xl border border-border/40 shadow-md overflow-hidden mx-4 md:mx-0">
        <ul className="divide-y divide-border/40">
          {filteredAndSortedUsers.length > 0 ? (
            filteredAndSortedUsers.map(u => (
              <UserListItem 
                key={u.uid} 
                user={{
                    ...u,
                    lastSeen: u.effectiveLastSeen ? { toDate: () => u.effectiveLastSeen } : u.lastSeen
                }} 
                currentUser={currentUser!} 
                onUpdate={handleUserUpdate} 
                onEdit={(user) => { setUserToEdit(user); setIsEditModalOpen(true); }} 
                onDelete={(uid, name) => { setUserToDelete({uid, name}); setIsConfirmModalOpen(true); }} 
              />
            ))
          ) : (
            <div className="p-12 text-center text-muted-foreground">
              <UsersIcon className="mx-auto h-12 w-12 opacity-20 mb-4" />
              <p className="text-lg">Nenhum usuário encontrado.</p>
            </div>
          )}
        </ul>
      </div>

      <ConfirmationModal 
        isOpen={isConfirmModalOpen} 
        onClose={() => setIsConfirmModalOpen(false)} 
        onConfirm={confirmDeleteUser} 
        title="Excluir Registro Permanente" 
        message={`Tem certeza que deseja excluir permanentemente o usuário ${userToDelete?.name}? Todos os seus dados e o e-mail de acesso serão removidos.`} 
        confirmText="Sim, Excluir Tudo" 
      />
      {userToEdit && <EditUserByAdminModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} userToEdit={userToEdit} onSave={handleUserUpdate} />}
    </div>
  );
}
