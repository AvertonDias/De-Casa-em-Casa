
"use client";

import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, orderBy, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useUser } from '@/contexts/UserContext';
import { Territory, Quadra } from '@/types/types';
import Link from 'next/link';
import { Plus, Search, ChevronRight, Loader, UserCheck, CalendarClock, AlertTriangle, Download, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import AddTerritoryModal from '@/components/AddTerritoryModal';
import { RestrictedContent } from '@/components/RestrictedContent';
import withAuth from '@/components/withAuth';
import { useToast } from '@/hooks/use-toast';

const SCROLL_POSITION_KEY = 'territories_scroll_position';

// ========================================================================
//   Componente de Download Offline
// ========================================================================

const OfflineDownloader = ({ territoryId, isManagerView }: { territoryId: string, isManagerView: boolean }) => {
    const { user } = useUser();
    const { toast } = useToast();
    const [downloadState, setDownloadState] = useState<{ downloadedAt: Date | null; isExpired: boolean }>({ downloadedAt: null, isExpired: false });
    const [isDownloading, setIsDownloading] = useState(false);

    const storageKey = `territory_offline_${territoryId}`;
    const EXPIRATION_HOURS = 3;

    useEffect(() => {
        const savedTimestamp = localStorage.getItem(storageKey);
        if (savedTimestamp) {
            const downloadedDate = new Date(savedTimestamp);
            const now = new Date();
            const hoursDiff = (now.getTime() - downloadedDate.getTime()) / (1000 * 60 * 60);

            if (hoursDiff > EXPIRATION_HOURS) {
                setDownloadState({ downloadedAt: downloadedDate, isExpired: true });
                localStorage.removeItem(storageKey); // Limpa o registro expirado
            } else {
                setDownloadState({ downloadedAt: downloadedDate, isExpired: false });
            }
        } else {
            setDownloadState({ downloadedAt: null, isExpired: false });
        }
    }, [storageKey]);

    const handleDownload = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (!user?.congregationId) return;
        setIsDownloading(true);
        toast({ title: 'Baixando Território...', description: 'Aguarde enquanto preparamos os dados para acesso offline.' });

        try {
            const territoryRef = doc(db, 'congregations', user.congregationId, 'territories', territoryId);
            await getDoc(territoryRef); // Pega o documento principal do território

            const quadrasRef = collection(territoryRef, 'quadras');
            const quadrasSnap = await getDocs(quadrasRef);

            for (const quadraDoc of quadrasSnap.docs) {
                const casasRef = collection(quadraDoc.ref, 'casas');
                await getDocs(casasRef); // Pega todas as casas de cada quadra
            }
            
            const now = new Date();
            localStorage.setItem(storageKey, now.toISOString());
            setDownloadState({ downloadedAt: now, isExpired: false });

            toast({ title: 'Download Concluído!', description: 'Este território agora está disponível offline.' });
        } catch (error) {
            console.error("Erro ao baixar território para offline:", error);
            toast({ title: 'Erro no Download', description: 'Não foi possível baixar os dados. Verifique sua conexão.', variant: 'destructive' });
        } finally {
            setIsDownloading(false);
        }
    };

    const isDownloadedAndValid = downloadState.downloadedAt && !downloadState.isExpired;
    
    // Versão para Dirigentes (botão grande)
    if (isManagerView) {
        return (
            <button
                onClick={handleDownload}
                disabled={isDownloading}
                className={`w-full mt-2 text-sm font-semibold p-2 rounded-md flex items-center justify-center transition-colors
                    ${isDownloading ? 'bg-gray-500 text-white cursor-wait' : ''}
                    ${!isDownloading && isDownloadedAndValid ? 'bg-green-600/20 text-green-400 hover:bg-green-600/30' : ''}
                    ${!isDownloading && !isDownloadedAndValid ? 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30' : ''}
                `}
            >
                {isDownloading ? <Loader className="animate-spin mr-2" size={16} /> : (isDownloadedAndValid ? <CheckCircle size={16} className="mr-2"/> : <Download size={16} className="mr-2"/>)}
                {isDownloading ? 'Baixando...' : (isDownloadedAndValid ? `Baixado em ${format(downloadState.downloadedAt!, 'dd/MM HH:mm')}` : 'Baixar para Offline')}
            </button>
        );
    }

    // Versão para Publicadores (ícone discreto)
    const title = isDownloadedAndValid 
        ? `Baixado em ${format(downloadState.downloadedAt!, 'dd/MM HH:mm')}`
        : (downloadState.isExpired ? "Download expirado, baixe novamente" : "Baixar para offline");

    return (
      <button
        onClick={handleDownload}
        disabled={isDownloading}
        className="p-2 rounded-full hover:bg-white/10"
        title={title}
      >
        {isDownloading 
          ? <Loader className="animate-spin" size={18} /> 
          : <Download size={18} className={isDownloadedAndValid ? 'text-green-400' : 'text-muted-foreground'} />
        }
      </button>
    );
};


// ========================================================================
//   Componentes de Lista
// ========================================================================

const TerritoryRowManager = ({ territory }: { territory: Territory }) => {
  const isDesignado = territory.status === 'designado' && territory.assignment;
  const isOverdue = isDesignado && territory.assignment && territory.assignment.dueDate.toDate() < new Date();
  const totalCasas = territory.stats?.totalHouses || 0;
  const casasFeitas = territory.stats?.housesDone || 0;
  const progresso = territory.progress ? Math.round(territory.progress * 100) : 0;

  const getStatusInfo = () => {
    if (isOverdue) return { text: 'Atrasado', color: 'bg-red-500 text-white' };
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

        {isDesignado && (
          <div className={`p-3 rounded-md text-sm space-y-2 mt-4 ${isOverdue ? 'bg-red-500/10' : 'bg-input/50'}`}>
            <div className="flex items-center gap-2">
              <UserCheck size={16} className="text-muted-foreground"/>
              <span className="font-semibold">{territory.assignment?.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <CalendarClock size={16} className="text-muted-foreground"/>
              <span>Devolver até: {format(territory.assignment!.dueDate.toDate(), 'dd/MM/yyyy', { locale: ptBR })}</span>
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
            <div className="w-full bg-gray-700 rounded-full h-2.5 mt-4"><div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${progresso}%` }}></div></div>
          </div>
        )}
      </Link>
      <OfflineDownloader territoryId={territory.id} isManagerView={true} />
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
        <OfflineDownloader territoryId={territory.id} isManagerView={false} />
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
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { user, loading: userLoading } = useUser();
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  useEffect(() => {
    const scrollPosition = sessionStorage.getItem(SCROLL_POSITION_KEY);
    if (scrollPosition && !loading) {
      setTimeout(() => {
        window.scrollTo(0, parseInt(scrollPosition, 10));
        sessionStorage.removeItem(SCROLL_POSITION_KEY);
      }, 100);
    }
  
    const handleBeforeUnload = () => {
      sessionStorage.setItem(SCROLL_POSITION_KEY, window.scrollY.toString());
    };
  
    window.addEventListener('beforeunload', handleBeforeUnload);
  
    return () => {
      handleBeforeUnload();
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [loading]);

  useEffect(() => {
    if (user?.status === 'ativo' && user.congregationId) {
      const territoriesRef = collection(db, 'congregations', user.congregationId, 'territories');
      const q = query(territoriesRef, where("type", "in", ["urban", null, ""]), orderBy("number"));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Territory));
        setTerritories(data);
        if (loading) setLoading(false);
      });
      return () => unsubscribe();
    } else if (!userLoading) {
        setLoading(false);
    }
  }, [user, userLoading, loading]);

  const handleAddTerritory = async () => {
    console.log("Territory will be added via modal.");
  };

  const filteredTerritories = territories.filter(t =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) || t.number.includes(searchTerm)
  );
  
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

        <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
            <input type="text" placeholder="Buscar por nome ou número..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-card border border-border rounded-md pl-10 pr-4 py-2" />
        </div>

        {isManagerView ? (
            <div className="space-y-4">
            {filteredTerritories.length > 0 ? (
                filteredTerritories.map(t => <TerritoryRowManager key={t.id} territory={t} />)
            ) : (<p className="text-center text-muted-foreground py-8">Nenhum território encontrado.</p>)}
            </div>
        ) : (
            <div className="bg-card rounded-lg shadow-md px-4 divide-y divide-border">
            {filteredTerritories.length > 0 ? (
                filteredTerritories.map(t => <TerritoryRowPublicador key={t.id} territory={t} />)
            ) : (<p className="text-center text-muted-foreground py-8">Nenhum território disponível.</p>)}
            </div>
        )}
      </div>

      {user.congregationId && <AddTerritoryModal 
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        congregationId={user.congregationId}
        onTerritoryAdded={handleAddTerritory}
      />}
    </>
  );
}

export default withAuth(TerritoriosPage);
