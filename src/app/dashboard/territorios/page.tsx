
"use client";

import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, where, orderBy, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useUser } from '@/contexts/UserContext';
import { Territory, Quadra } from '@/types/types';
import Link from 'next/link';
import { Plus, Search, ChevronRight, Loader, UserCheck, CalendarClock, AlertTriangle, Download, CheckCircle, X, ArrowDownUp, Filter, SlidersHorizontal, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import AddTerritoryModal from '@/components/AddTerritoryModal';
import { RestrictedContent } from '@/components/RestrictedContent';
import withAuth from '@/components/withAuth';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Disclosure, Transition } from '@headlessui/react';
import { useScrollRestoration } from '@/hooks/useScrollRestoration';


// ========================================================================
//   Componentes de Lista
// ========================================================================

const TerritoryRowManager = ({ territory }: { territory: Territory }) => {
  const isDesignado = territory.status === 'designado' && territory.assignment;
  const isOverdue = territory.assignment ? territory.assignment.dueDate.toDate() < new Date() : false;
  const totalCasas = territory.stats?.totalHouses || 0;
  const casasFeitas = territory.stats?.housesDone || 0;
  const progresso = territory.progress ? Math.round(territory.progress * 100) : 0;

  const getStatusInfo = () => {
    if (isDesignado && isOverdue) return { text: 'Atrasado', color: 'bg-red-500 text-white' };
    if (isDesignado) return { text: 'Designado', color: 'bg-yellow-500 text-white' };
    return { text: 'Disponível', color: 'bg-green-500 text-white' };
  };
  const statusInfo = getStatusInfo();

  return (
    <div className="bg-card p-4 rounded-lg shadow-md h-full group-hover:border-primary/50 border border-transparent transition-all flex flex-col space-y-4">
      <Link href={`/dashboard/territorios/${territory.id}`} className="block group flex-grow">
        <div className="flex justify-between items-start">
          <h3 className="font-bold text-xl flex-1 pr-2">{territory.number} - {territory.name}</h3>
          <span className={`px-2 py-1 text-xs font-semibold rounded-full whitespace-nowrap ${statusInfo.color}`}>
            {statusInfo.text}
          </span>
        </div>

        {isDesignado && territory.assignment && (
          <div className={`p-3 rounded-md text-sm space-y-2 mt-4 ${isOverdue ? 'bg-red-500/10' : 'bg-input/50'}`}>
            <div className="flex items-center gap-2">
              <UserCheck size={16} className="text-muted-foreground"/>
              <span className="font-semibold">{territory.assignment?.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <CalendarClock size={16} className="text-muted-foreground"/>
              <span>Devolver até: {format(territory.assignment.dueDate.toDate(), 'dd/MM/yyyy', { locale: ptBR })}</span>
            </div>
             {isOverdue && (
                <div className="flex items-center gap-2 font-bold text-red-500">
                    <AlertTriangle size={16} />
                    <span>Território Atrasado!</span>
                </div>
             )}
          </div>
        )}

        {territory.type !== 'rural' && (
          <div className="pt-2 mt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div><p className="text-sm text-muted-foreground">Total de Casas</p><p className="font-bold text-2xl">{totalCasas}</p></div>
                <div><p className="text-sm text-muted-foreground">Feitas</p><p className="font-bold text-2xl text-green-400">{casasFeitas}</p></div>
                <div><p className="text-sm text-muted-foreground">Pendentes</p><p className="font-bold text-2xl text-yellow-400">{totalCasas - casasFeitas}</p></div>
                <div><p className="text-sm text-muted-foreground">Progresso</p><p className="font-bold text-2xl text-blue-400">{progresso}%</p></div>
            </div>
            <div className="w-full bg-muted rounded-full h-2.5 mt-4"><div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${progresso}%` }}></div></div>
          </div>
        )}
      </Link>
    </div>
  );
};

const TerritoryRowPublicador = ({ territory }: { territory: Territory }) => (
    <div className="flex items-center justify-between py-3 px-4 -mx-4 hover:bg-white/5 transition-colors cursor-pointer">
      <Link href={`/dashboard/territorios/${territory.id}`} className="flex-grow flex items-center space-x-4 min-w-0">
        <span className="font-bold text-lg text-muted-foreground w-8 text-center">{territory.number}</span>
        <h3 className="font-semibold text-lg truncate">{territory.name}</h3>
      </Link>
      <div className="flex items-center">
        <Link href={`/dashboard/territorios/${territory.id}`} className="p-2">
          <ChevronRight className="text-muted-foreground h-5 w-5" />
        </Link>
      </div>
    </div>
);


// ========================================================================
//   PÁGINA PRINCIPAL
// ========================================================================
function TerritoriosPage() {
  useScrollRestoration(); // Hook para restaurar o scroll
  
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { user, loading: userLoading } = useUser();
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // States for filtering and sorting
  const [statusFilter, setStatusFilter] = useState<'all' | 'disponivel' | 'designado' | 'atrasado'>('all');
  const [sortBy, setSortBy] = useState('number');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');


  useEffect(() => {
    if (user?.status === 'ativo' && user.congregationId) {
      const territoriesRef = collection(db, 'congregations', user.congregationId, 'territories');
      const q = query(territoriesRef, where("type", "in", ["urban", null, ""]));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Territory));
        setTerritories(data);
        if (loading) setLoading(false);
      }, (err) => {
        console.error("Error fetching territories:", err);
        if (loading) setLoading(false);
      });
      return () => unsubscribe();
    } else if (!userLoading) {
        setLoading(false);
    }
  }, [user, userLoading, loading]);


  const filteredAndSortedTerritories = useMemo(() => {
    let filtered = territories.filter(t =>
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) || t.number.includes(searchTerm)
    );

    if (statusFilter !== 'all') {
      filtered = filtered.filter(t => {
        if (statusFilter === 'disponivel') {
          return t.status !== 'designado' || !t.assignment;
        }
        
        if (t.status === 'designado' && t.assignment) {
            const isOverdue = t.assignment.dueDate.toDate() < new Date();
            if (statusFilter === 'designado') return !isOverdue;
            if (statusFilter === 'atrasado') return isOverdue;
        }
        
        return false;
      });
    }

    filtered.sort((a, b) => {
      let valA: any, valB: any;

      switch (sortBy) {
        case 'name':
          valA = a.name.toLowerCase();
          valB = b.name.toLowerCase();
          break;
        case 'totalHouses':
          valA = a.stats?.totalHouses || 0;
          valB = b.stats?.totalHouses || 0;
          break;
        case 'housesDone':
          valA = a.stats?.housesDone || 0;
          valB = b.stats?.housesDone || 0;
          break;
        case 'progress':
          valA = a.progress || 0;
          valB = b.progress || 0;
          break;
        default: // 'number'
          valA = a.number;
          valB = b.number;
          break;
      }

      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortDirection === 'asc' ? valA.localeCompare(valB, undefined, { numeric: true }) : valB.localeCompare(valA, undefined, { numeric: true });
      }
      return sortDirection === 'asc' ? valA - valB : valB - valA;
    });

    return filtered;
  }, [territories, searchTerm, statusFilter, sortBy, sortDirection]);

  
  if (loading && territories.length === 0) {
    return <div className="flex items-center justify-center h-full"><Loader className="animate-spin text-primary" size={48} /></div>;
  }

  if (!user) {
    return null;
  }

  if (user.status === 'pendente') {
    return (
      <RestrictedContent
        title="Acesso aos Territórios Restrito"
        message="Seu acesso precisa ser aprovado por um administrador para que você possa ver os territórios da congregação."
      />
    );
  }
  
  const isManagerView = user?.role === 'Administrador' || user?.role === 'Dirigente';
  const isAdmin = user?.role === 'Administrador';

  const FilterButton = ({ label, value }: { label: string; value: typeof statusFilter }) => (
    <button
      onClick={() => setStatusFilter(value)}
      className={`px-3 py-1.5 text-sm rounded-full transition-colors ${statusFilter === value ? 'bg-primary text-primary-foreground font-semibold' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
    >
      {label}
    </button>
  );

  return (
    <>
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold">Territórios</h1>
            <p className="text-muted-foreground">{user.congregationName || 'Sua Congregação'}</p>
          </div>

          {isAdmin && (
            <button 
              onClick={() => setIsAddModalOpen(true)} 
              className="w-full sm:w-auto bg-primary hover:bg-primary/80 text-white font-semibold py-2 px-4 rounded-md flex items-center justify-center">
              <Plus className="mr-2 h-4 w-4" /> Adicionar Território
            </button>
          )}
        </div>

        <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
            <input 
              type="text" 
              placeholder="Buscar por nome ou número..." 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
              className="w-full bg-card border border-border rounded-md pl-10 pr-10 py-2" 
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

        {isManagerView && (
          <div className="w-full mb-6">
            <div className="bg-card rounded-lg p-2">
                <Disclosure as="div">
                    {({ open }) => (
                    <>
                        <Disclosure.Button className="flex w-full justify-between items-center rounded-lg px-4 py-2 text-left text-lg font-medium hover:bg-white/5 focus:outline-none focus-visible:ring focus-visible:ring-primary/75">
                            <div className="flex items-center gap-3">
                              <SlidersHorizontal size={20} />
                              <span>Filtros e Ordenação</span>
                            </div>
                            <ChevronUp className={`${open ? 'rotate-180 transform' : ''} h-5 w-5 transition-transform`} />
                        </Disclosure.Button>
                        <Transition show={open} enter="transition duration-100 ease-out" enterFrom="transform scale-95 opacity-0" enterTo="transform scale-100 opacity-100" leave="transition duration-75 ease-out" leaveFrom="transform scale-100 opacity-100" leaveTo="transform scale-95 opacity-100">
                            <Disclosure.Panel className="px-4 pb-4 pt-4 text-sm text-gray-500 border-t border-border mt-2 space-y-4">
                                <div>
                                    <p className="font-semibold mb-2">Filtrar por Status</p>
                                    <div className="flex flex-wrap gap-2">
                                        <FilterButton label="Todos" value="all" />
                                        <FilterButton label="Disponível" value="disponivel" />
                                        <FilterButton label="Designado" value="designado" />
                                        <FilterButton label="Atrasado" value="atrasado" />
                                    </div>
                                </div>
                                
                                <div>
                                  <p className="font-semibold mb-2">Ordenar por</p>
                                  <div className="flex items-center gap-2">
                                    <Select value={sortBy} onValueChange={setSortBy}>
                                      <SelectTrigger className="w-full sm:w-[180px] bg-muted border-none">
                                        <SelectValue placeholder="Ordenar por..." />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="number">Número</SelectItem>
                                        <SelectItem value="name">Nome</SelectItem>
                                        <SelectItem value="totalHouses">Total de Casas</SelectItem>
                                        <SelectItem value="housesDone">Casas Feitas</SelectItem>
                                        <SelectItem value="progress">Progresso</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <Button variant="outline" size="icon" onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}>
                                      <ArrowDownUp className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                            </Disclosure.Panel>
                        </Transition>
                    </>
                    )}
                </Disclosure>
            </div>
          </div>
        )}

        {isManagerView ? (
            <div className="space-y-4">
            {filteredAndSortedTerritories.length > 0 ? (
                filteredAndSortedTerritories.map(t => <TerritoryRowManager key={t.id} territory={t} />)
            ) : (<p className="text-center text-muted-foreground py-8">Nenhum território encontrado.</p>)}
            </div>
        ) : (
            <div className="bg-card rounded-lg shadow-md px-4 divide-y divide-border">
            {filteredAndSortedTerritories.length > 0 ? (
                filteredAndSortedTerritories.map(t => <TerritoryRowPublicador key={t.id} territory={t} />)
            ) : (<p className="text-center text-muted-foreground py-8">Nenhum território disponível.</p>)}
            </div>
        )}
      </div>

      {user.congregationId && <AddTerritoryModal 
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        congregationId={user.congregationId}
        onTerritoryAdded={() => {}}
      />}
    </>
  );
}

export default withAuth(TerritoriosPage);
