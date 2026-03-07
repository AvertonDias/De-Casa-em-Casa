"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useUser } from '@/contexts/UserContext';
import { db, rtdb } from '@/lib/firebase';
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

export default function UserManagement() {
  const { user: currentUser, loading: userLoading } = useUser(); 
  const { toast } = useToast();

  const [users, setUsers] = useState<AppUser[]>([]);
  const [presenceData, setPresenceData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [presenceFilter, setPresenceFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [roleFilter, setRoleFilter] = useState<'all' | 'Administrador' | 'Dirigente' | 'Servo de Territórios' | 'Ajudante de Servo de Territórios' | 'Publicador'>('all');
  const [activityFilter, setActivityFilter] = useState<'all' | 'active_hourly' | 'active_weekly' | 'inactive_month'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ativo' | 'pendente' | 'inativo' | 'rejeitado' | 'bloqueado'>('all');

  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [userToRemove, setUserToRemove] = useState<{uid: string, name: string} | null>(null);

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
    const oneMonthAgo = subMonths(new Date(), 1);
    return users.map(u => {
        const presence = presenceData[u.uid];
        const isOnline = presence?.state === 'online';
        let status = u.status;
        if (status === 'ativo' && u.lastSeen && u.lastSeen.toDate() < oneMonthAgo) status = 'inativo';
        return { ...u, isOnline, status };
    });
  }, [users, presenceData]);

  const filterCounts = useMemo(() => {
    const counts = {
      status: { all: 0, ativo: 0, pendente: 0, inativo: 0, rejeitado: 0, bloqueado: 0 },
      presence: { all: 0, online: 0, offline: 0 },
      role: { all: 0, Administrador: 0, Dirigente: 0, 'Servo de Territórios': 0, 'Ajudante de Servo de Territórios': 0, Publicador: 0 },
      activity: { all: 0, active_hourly: 0, active_weekly: 0, inactive_month: 0 }
    };
    const now = new Date();
    usersWithPresence.forEach(u => {
      counts.status.all++;
      if (u.status in counts.status) counts.status[u.status as keyof typeof counts.status.all]++;
      counts.presence.all++;
      if (u.isOnline) counts.presence.online++; else counts.presence.offline++;
      counts.role.all++;
      if (u.role in counts.role) counts.role[u.role as keyof typeof counts.role.all]++;
      counts.activity.all++;
      if (u.lastSeen && u.lastSeen.toDate() > subHours(now, 1)) counts.activity.active_hourly++;
      if (u.lastSeen && u.lastSeen.toDate() > subDays(now, 7)) counts.activity.active_weekly++;
      if (u.status === 'ativo' && (!u.lastSeen || u.lastSeen.toDate() < subMonths(now, 1))) counts.activity.inactive_month++;
    });
    return counts;
  }, [usersWithPresence]);

  const handleUserUpdate = async (userId: string, dataToUpdate: Partial<AppUser>) => {
    if (!currentUser || currentUser.role !== 'Administrador' && currentUser.role !== 'Dirigente') return;
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

  const confirmRemoveUser = async () => {
    if (!userToRemove || currentUser?.role !== 'Administrador') return;
    setIsConfirmModalOpen(false);
    
    const userRef = doc(db, 'users', userToRemove.uid);
    const updateData = { 
        status: 'bloqueado' as const, 
        congregationId: null 
    };

    updateDoc(userRef, updateData).then(() => {
        toast({ 
            title: "Acesso Removido", 
            description: "O usuário foi bloqueado e desvinculado da congregação." 
        });
    }).catch(async (error) => {
        if (error.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({
                path: userRef.path,
                operation: 'update',
                requestResourceData: updateData,
            });
            errorEmitter.emit('permission-error', permissionError);
        }
    });
  };

  const filteredAndSortedUsers = useMemo(() => {
    let filtered = usersWithPresence.filter(u => 
        (presenceFilter === 'all' || u.isOnline === (presenceFilter === 'online')) &&
        (roleFilter === 'all' || u.role === roleFilter) &&
        (statusFilter === 'all' || u.status === statusFilter) &&
        (!searchTerm || u.name.toLowerCase().includes(searchTerm.toLowerCase()) || u.email?.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    
    return filtered.sort((a, b) => {
      if (a.status === 'pendente' && b.status !== 'pendente') return -1;
      if (a.status !== 'pendente' && b.status === 'pendente') return 1;
      return a.name.localeCompare(b.name);
    });
  }, [usersWithPresence, presenceFilter, roleFilter, statusFilter, searchTerm]);

  const FilterButton = ({ label, value, currentFilter, setFilter, count }: { label: string, value: string, currentFilter: string, setFilter: (value: any) => void, count?: number}) => (
    <button onClick={() => setFilter(value)} className={`px-3 py-1.5 text-sm rounded-full transition-colors flex items-center gap-2 ${currentFilter === value ? 'bg-primary text-primary-foreground font-semibold shadow-sm' : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'}`}>
        {label} {count !== undefined && <span className="bg-white/20 px-1.5 py-0.5 rounded-md text-[10px] font-bold">{count}</span>}
    </button>
  );

  if (userLoading || loading) return <div className="flex justify-center items-center h-full"><Loader className="animate-spin text-purple-500" size={32} /></div>;

  return (
    <div className="space-y-6 p-4">
      <h1 className="text-3xl font-bold">Gerenciamento de Usuários</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-card p-6 rounded-lg shadow-md flex items-center gap-4"><div className="bg-blue-500/20 text-blue-400 p-3 rounded-lg"><UsersIcon size={28} /></div><div><p className="text-sm">Total</p><p className="text-2xl font-bold">{filterCounts.status.all}</p></div></div>
        <div className="bg-card p-6 rounded-lg shadow-md flex items-center gap-4"><div className="bg-green-500/20 text-green-400 p-3 rounded-lg"><Wifi size={28} /></div><div><p className="text-sm">Online</p><p className="text-2xl font-bold">{filterCounts.presence.online}</p></div></div>
        <div className="bg-card p-6 rounded-lg shadow-md flex items-center gap-4"><div className="bg-yellow-500/20 text-yellow-400 p-3 rounded-lg"><Check size={28}/></div><div><p className="text-sm">Pendentes</p><p className="text-2xl font-bold">{filterCounts.status.pendente}</p></div></div>
      </div>

      <Accordion type="single" collapsible className="bg-card rounded-lg p-2">
        <AccordionItem value="filters" className="border-b-0">
          <AccordionTrigger className="px-4 py-2 hover:no-underline flex gap-3"><SlidersHorizontal size={20} /> Filtros</AccordionTrigger>
          <AccordionContent className="px-4 pb-4 pt-2 border-t mt-2 space-y-4">
            <div><p className="font-semibold mb-2">Status</p><div className="flex flex-wrap gap-2">{Object.entries(filterCounts.status).map(([k, v]) => <FilterButton key={k} label={k} value={k} currentFilter={statusFilter} setFilter={setStatusFilter} count={v} />)}</div></div>
            <div><p className="font-semibold mb-2">Perfil</p><div className="flex flex-wrap gap-2">{Object.entries(filterCounts.role).map(([k, v]) => <FilterButton key={k} label={k} value={k} currentFilter={roleFilter} setFilter={setRoleFilter} count={v} />)}</div></div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} /><input type="text" placeholder="Buscar por nome..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-card border rounded-lg" /></div>
      
      <div className="bg-card rounded-lg shadow-md divide-y">
        {filteredAndSortedUsers.map(u => (
          <UserListItem key={u.uid} user={u} currentUser={currentUser!} onUpdate={handleUserUpdate} onEdit={(user) => { setUserToEdit(user); setIsEditModalOpen(true); }} onDelete={(uid, name) => { setUserToRemove({uid, name}); setIsConfirmModalOpen(true); }} />
        ))}
      </div>

      <ConfirmationModal isOpen={isConfirmModalOpen} onClose={() => setIsConfirmModalOpen(false)} onConfirm={confirmRemoveUser} title="Remover Acesso" message={`Tem certeza que deseja remover o acesso de ${userToRemove?.name}? O usuário será bloqueado e desvinculado da congregação.`} confirmText="Sim, Remover Acesso" />
      {userToEdit && <EditUserByAdminModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} userToEdit={userToEdit} onSave={handleUserUpdate} />}
    </div>
  );
}
