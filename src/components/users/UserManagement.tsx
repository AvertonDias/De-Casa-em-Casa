
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useUser } from '@/contexts/UserContext';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { Loader, Search, SlidersHorizontal, ChevronUp, X, Users as UsersIcon, Wifi, Check } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { UserListItem } from './UserListItem';
import { EditUserByAdminModal } from './EditUserByAdminModal'; // Importar o novo modal
import { subDays, subMonths, subHours } from 'date-fns';
import type { AppUser, Congregation } from '@/types/types';
import { useToast } from '@/hooks/use-toast';
import { getIdToken } from 'firebase/auth';

const functionUrl = (name: string) => `https://southamerica-east1-appterritorios-e5bb5.cloudfunctions.net/${name}`;

export default function UserManagement() {
  const { user: currentUser, loading: userLoading, congregation } = useUser(); 
  const { toast } = useToast();

  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [presenceFilter, setPresenceFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [roleFilter, setRoleFilter] = useState<AppUser['role'] | 'all'>('all');
  const [activityFilter, setActivityFilter] = useState<'all' | 'active_hourly' | 'active_weekly' | 'inactive_month'>('all');
  const [statusFilter, setStatusFilter] = useState<AppUser['status'] | 'all' | 'inativo'>('all');


  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<{uid: string, name: string} | null>(null);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<AppUser | null>(null);

  const handleOpenEditModal = (user: AppUser) => {
    if (currentUser?.role !== 'Administrador') return;
    setUserToEdit(user);
    setIsEditModalOpen(true);
  };
  
  const confirmDeleteUser = useCallback(async () => {
    if (!userToDelete || !currentUser || !auth.currentUser || currentUser.role !== 'Administrador' || currentUser.uid === userToDelete.uid) return;
    
    setIsConfirmModalOpen(false);
    try {
        const token = await auth.currentUser.getIdToken();
        const res = await fetch(functionUrl('deleteUserAccountV2'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ data: { userIdToDelete: userToDelete.uid } })
        });
        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error?.message || 'Falha ao excluir usuário.');
        }

        toast({ title: "Sucesso", description: "Usuário excluído." });
    } catch (error: any) {
        toast({ title: "Erro", description: error.message || "Falha ao excluir usuário.", variant: "destructive"});
    } finally {
        setUserToDelete(null);
    }
  }, [userToDelete, currentUser, toast]);
  
  const openDeleteConfirm = useCallback((userId: string, userName: string) => {
    if (currentUser?.role !== 'Administrador') return;
    setUserToDelete({uid: userId, name: userName});
    setIsConfirmModalOpen(true);
  }, [currentUser?.role]);


  useEffect(() => {
    if (currentUser?.congregationId) {
      setLoading(true);
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where("congregationId", "==", currentUser.congregationId));
      const unsubUsers = onSnapshot(q, (snapshot) => {
        const usersData = snapshot.docs.map(docSnap => ({ uid: docSnap.id, ...docSnap.data() } as AppUser));
        setUsers(usersData);
        setLoading(false);
      }, (error) => {
        console.error("Erro ao buscar usuários:", error);
        setLoading(false);
      });

      return () => { 
        unsubUsers(); 
      };
    } else if (!userLoading) {
      setLoading(false);
    }
  }, [currentUser, userLoading]);
  
  const handleUserUpdate = async (userId: string, dataToUpdate: Partial<AppUser>) => {
    if (!currentUser) return;
    
    if (currentUser.role === 'Dirigente' && dataToUpdate.status && !['ativo', 'rejeitado'].includes(dataToUpdate.status)) {
        toast({ title: "Permissão Negada", description: "Você só pode aprovar ou rejeitar usuários pendentes.", variant: "destructive" });
        return;
    }
    
    if (currentUser.role !== 'Administrador' && (dataToUpdate.role || (dataToUpdate.status && !['ativo', 'rejeitado'].includes(dataToUpdate.status)))) {
      toast({ title: "Permissão Negada", description: "Apenas administradores podem alterar perfis e a maioria dos status.", variant: "destructive" });
      return;
    }

    if (currentUser.uid === userId && dataToUpdate.role && dataToUpdate.role !== currentUser.role) {
        toast({ title: "Ação Inválida", description: "Você não pode alterar seu próprio perfil.", variant: "destructive" });
        return;
    }
    
    const userRef = doc(db, 'users', userId);
    try {
        await updateDoc(userRef, dataToUpdate as any);
        toast({ title: "Sucesso", description: `Dados de ${dataToUpdate.name || 'usuário'} atualizados.`});
    } catch (error: any) {
        console.error("Erro ao atualizar usuário:", error);
        toast({ title: "Erro de Atualização", description: "A atualização falhou. Tente novamente.", variant: "destructive"});
    }
  };

  const stats = useMemo(() => {
    const onlineCount = users.filter(u => u.isOnline === true).length;
    const pendingCount = users.filter(u => u.status === 'pendente').length;
    return {
      total: users.length,
      online: onlineCount,
      offline: users.length - onlineCount,
      pending: pendingCount
    };
  }, [users]);
  
  const filterCounts = useMemo(() => {
    const oneHourAgo = subHours(new Date(), 1);
    const oneWeekAgo = subDays(new Date(), 7);
    const oneMonthAgo = subMonths(new Date(), 1);

    return {
        status: {
            ativo: users.filter(u => u.status === 'ativo').length,
            pendente: users.filter(u => u.status === 'pendente').length,
            inativo: users.filter(u => u.status === 'ativo' && u.lastSeen && u.lastSeen.toDate() < oneMonthAgo).length,
            rejeitado: users.filter(u => u.status === 'rejeitado').length,
            bloqueado: users.filter(u => u.status === 'bloqueado').length,
        },
        presence: {
            online: users.filter(u => u.isOnline === true).length,
            offline: users.filter(u => u.isOnline !== true).length,
        },
        role: {
            'Administrador': users.filter(u => u.role === 'Administrador').length,
            'Dirigente': users.filter(u => u.role === 'Dirigente').length,
            'Servo de Territórios': users.filter(u => u.role === 'Servo de Territórios').length,
            'Ajudante de Servo de Territórios': users.filter(u => u.role === 'Ajudante de Servo de Territórios').length,
            'Publicador': users.filter(u => u.role === 'Publicador').length,
        },
        activity: {
            active_hourly: users.filter(u => u.lastSeen && u.lastSeen.toDate() > oneHourAgo).length,
            active_weekly: users.filter(u => u.lastSeen && u.lastSeen.toDate() > oneWeekAgo).length,
            inactive_month: users.filter(u => u.status === 'ativo' && (!u.lastSeen || u.lastSeen.toDate() < oneMonthAgo)).length,
        }
    };
  }, [users]);


  const filteredAndSortedUsers = useMemo(() => {
    let filtered = [...users];

    if (presenceFilter !== 'all') {
      filtered = filtered.filter(user => (user.isOnline === true) === (presenceFilter === 'online'));
    }
    if (roleFilter !== 'all') {
      filtered = filtered.filter(user => user.role === roleFilter);
    }
     if (statusFilter !== 'all') {
      filtered = filtered.filter(user => {
        if (statusFilter === 'inativo') {
          return user.status === 'ativo' && user.lastSeen && user.lastSeen.toDate() < subMonths(new Date(), 1);
        }
        return user.status === statusFilter;
      });
    }
    
    if (activityFilter !== 'all') {
        const now = new Date();
        if (activityFilter === 'active_hourly') {
            const oneHourAgo = subHours(now, 1);
            filtered = filtered.filter(u => u.lastSeen && u.lastSeen.toDate() > oneHourAgo);
        } else if (activityFilter === 'active_weekly') {
            const oneWeekAgo = subDays(now, 7);
            filtered = filtered.filter(u => u.lastSeen && u.lastSeen.toDate() > oneWeekAgo);
        } else if (activityFilter === 'inactive_month') {
            const oneMonthAgo = subMonths(now, 1);
            filtered = filtered.filter(u => u.status === 'ativo' && (!u.lastSeen || u.lastSeen.toDate() < oneMonthAgo));
        }
    }

    if (searchTerm) {
      const lowerCaseSearch = searchTerm.toLowerCase();
      filtered = filtered.filter(user =>
        user.name.toLowerCase().includes(lowerCaseSearch) ||
        user.email?.toLowerCase().includes(lowerCaseSearch)
      );
    }
    
    const getStatusPriority = (status: AppUser['status']) => {
      if (status === 'pendente') return 1;
      return 2;
    };
    
    return filtered.sort((a, b) => {
      if (a.uid === currentUser?.uid) return -1;
      if (b.uid === currentUser?.uid) return 1;

      const priorityA = getStatusPriority(a.status);
      const priorityB = getStatusPriority(b.status);
      
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      
      return a.name.localeCompare(b.name);
    });

  }, [users, currentUser, searchTerm, presenceFilter, roleFilter, activityFilter, statusFilter]);
  
  if (userLoading || loading) {
    return <div className="flex justify-center items-center h-full"><Loader className="animate-spin text-purple-500" size={32} /></div>;
  }
  
  const canManageUsers = currentUser?.role === 'Administrador' || currentUser?.role === 'Dirigente' || currentUser?.role === 'Servo de Territórios' || currentUser?.role === 'Ajudante de Servo de Territórios';

  if (!currentUser || !canManageUsers) {
    return (
        <div className="text-center p-8">
            <h1 className="text-2xl font-bold">Acesso Negado</h1>
            <p>Você não tem permissão para visualizar esta página.</p>
        </div>
    );
  }

  const FilterButton = ({ label, value, count, currentFilter, setFilter }: { label: string, value: string, count: number, currentFilter: string, setFilter: (value: any) => void}) => (
    <button onClick={() => setFilter(value)} className={`px-3 py-1 text-sm rounded-full transition-colors flex items-center gap-2 ${currentFilter === value ? 'bg-primary text-primary-foreground font-semibold' : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'}`}>
        {label}
        <span className={`px-1.5 py-0.5 text-xs rounded-full ${currentFilter === value ? 'bg-primary-foreground text-primary' : 'bg-gray-400/50 text-foreground'}`}>{count}</span>
    </button>
  );

  return (
    <>
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-3xl font-bold">Gerenciamento de Usuários</h1>
            <p className="text-muted-foreground">Monitore e gerencie os membros da congregação.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-card p-6 rounded-lg shadow-md flex items-center gap-4">
            <div className="bg-blue-500/20 text-blue-400 p-3 rounded-lg">
                <UsersIcon size={28} />
            </div>
            <div>
                <p className="text-muted-foreground text-sm">Total de Usuários</p>
                <p className="text-2xl font-bold">{stats.total}</p>
            </div>
        </div>
        <div className="bg-card p-6 rounded-lg shadow-md flex items-center gap-4">
            <div className="bg-green-500/20 text-green-400 p-3 rounded-lg">
                <Wifi size={28} />
            </div>
            <div>
                <p className="text-muted-foreground text-sm">Online</p>
                <p className="text-2xl font-bold">{stats.online}</p>
            </div>
        </div>
        <div className="bg-card p-6 rounded-lg shadow-md flex items-center gap-4">
            <div className="bg-yellow-500/20 text-yellow-400 p-3 rounded-lg">
                <Check size={28}/>
            </div>
            <div>
                <p className="text-muted-foreground text-sm">Pendentes</p>
                <p className="text-2xl font-bold">{stats.pending}</p>
            </div>
        </div>
      </div>

      <div className="w-full">
        <Accordion type="single" collapsible className="w-full bg-card rounded-lg p-2">
            <AccordionItem value="filters" className="border-b-0">
                <AccordionTrigger className="flex w-full justify-between items-center rounded-lg px-4 py-2 text-left text-lg font-medium hover:bg-white/5 focus:outline-none focus-visible:ring focus-visible:ring-purple-500/75 hover:no-underline">
                    <div className="flex items-center gap-3">
                        <SlidersHorizontal size={20} />
                        <span>Filtros</span>
                    </div>
                </AccordionTrigger>
                <AccordionContent>
                    <div className="px-4 pb-4 pt-4 text-sm text-gray-500 border-t border-border mt-2 space-y-4">
                        <div>
                            <p className="font-semibold mb-2">Status da Conta</p>
                            <div className="flex flex-wrap gap-2">
                                <FilterButton label="Todos" value="all" count={users.length} currentFilter={statusFilter} setFilter={setStatusFilter} />
                                <FilterButton label="Ativo" value="ativo" count={filterCounts.status.ativo} currentFilter={statusFilter} setFilter={setStatusFilter} />
                                <FilterButton label="Pendente" value="pendente" count={filterCounts.status.pendente} currentFilter={statusFilter} setFilter={setStatusFilter} />
                                <FilterButton label="Inativo" value="inativo" count={filterCounts.activity.inactive_month} currentFilter={statusFilter} setFilter={setStatusFilter} />
                                <FilterButton label="Rejeitado" value="rejeitado" count={filterCounts.status.rejeitado} currentFilter={statusFilter} setFilter={setStatusFilter} />
                                <FilterButton label="Bloqueado" value="bloqueado" count={filterCounts.status.bloqueado} currentFilter={statusFilter} setFilter={setStatusFilter} />
                            </div>
                        </div>
                        
                        <div>
                            <p className="font-semibold mb-2">Status de Presença</p>
                            <div className="flex flex-wrap gap-2">
                                <FilterButton label="Todos" value="all" count={users.length} currentFilter={presenceFilter} setFilter={setPresenceFilter} />
                                <FilterButton label="Online" value="online" count={filterCounts.presence.online} currentFilter={presenceFilter} setFilter={setPresenceFilter} />
                                <FilterButton label="Offline" value="offline" count={filterCounts.presence.offline} currentFilter={presenceFilter} setFilter={setPresenceFilter} />
                            </div>
                        </div>

                        <div>
                            <p className="font-semibold mb-2">Perfil de Usuário</p>
                            <div className="flex flex-wrap gap-2">
                                <FilterButton label="Todos" value="all" count={users.length} currentFilter={roleFilter} setFilter={setRoleFilter} />
                                <FilterButton label="Admin" value="Administrador" count={filterCounts.role['Administrador']} currentFilter={roleFilter} setFilter={setRoleFilter} />
                                <FilterButton label="Dirigente" value="Dirigente" count={filterCounts.role['Dirigente']} currentFilter={roleFilter} setFilter={setRoleFilter} />
                                <FilterButton label="S. de Terr." value="Servo de Territórios" count={filterCounts.role['Servo de Territórios']} currentFilter={roleFilter} setFilter={setRoleFilter} />
                                <FilterButton label="Ajudante" value="Ajudante de Servo de Territórios" count={filterCounts.role['Ajudante de Servo de Territórios']} currentFilter={roleFilter} setFilter={setRoleFilter} />
                                <FilterButton label="Publicador" value="Publicador" count={filterCounts.role['Publicador']} currentFilter={roleFilter} setFilter={setRoleFilter} />
                            </div>
                        </div>

                        <div>
                            <p className="font-semibold mb-2">Atividade Recente (Visto por último)</p>
                            <div className="flex flex-wrap gap-2">
                                <FilterButton label="Todos" value="all" count={users.length} currentFilter={activityFilter} setFilter={setActivityFilter} />
                                <FilterButton label="Ativos na Última Hora" value="active_hourly" count={filterCounts.activity.active_hourly} currentFilter={activityFilter} setFilter={setActivityFilter} />
                                <FilterButton label="Ativos na Semana" value="active_weekly" count={filterCounts.activity.active_weekly} currentFilter={activityFilter} setFilter={setActivityFilter} />
                                <FilterButton label="Ausentes há um Mês" value="inactive_month" count={filterCounts.activity.inactive_month} currentFilter={activityFilter} setFilter={setActivityFilter} />
                            </div>
                        </div>
                    </div>
                </AccordionContent>
            </AccordionItem>
        </Accordion>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
        <input 
            type="text" 
            placeholder="Buscar por nome ou e-mail..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            className="w-full pl-10 pr-10 py-2 bg-card border border-input rounded-lg" 
        />
        {searchTerm && (
          <button 
            onClick={() => setSearchTerm('')} 
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X size={20} />
          </button>
        )}
      </div>
      
      <div className="bg-card rounded-lg shadow-md">
        {loading ? (
           <div className="text-center p-8 text-muted-foreground"><Loader className="animate-spin mx-auto" /></div>
        ) : filteredAndSortedUsers.length > 0 ? (
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredAndSortedUsers.map((user) => 
                <UserListItem 
                    key={user.uid} 
                    user={user} 
                    currentUser={currentUser!} 
                    onUpdate={handleUserUpdate}
                    onDelete={openDeleteConfirm}
                    onEdit={handleOpenEditModal}
                />
            )}
          </ul>
        ) : ( 
            <div className="text-center p-8 text-muted-foreground">
                <p>Nenhum usuário corresponde aos filtros selecionados.</p>
            </div>
        )}
      </div>
    </div>
    
      <ConfirmationModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={confirmDeleteUser}
        title="Excluir Usuário"
        message={`Você tem certeza que deseja excluir permanentemente o usuário ${userToDelete?.name}? Todos os seus dados serão perdidos e esta ação não pode ser desfeita.`}
      />
      
      {userToEdit && (
        <EditUserByAdminModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          userToEdit={userToEdit}
          onSave={handleUserUpdate}
        />
      )}
    </>
  );
}
