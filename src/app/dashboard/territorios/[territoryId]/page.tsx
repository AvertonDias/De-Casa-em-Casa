
"use client";

import { useEffect, useState } from 'react';
import { doc, collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Map, Image as ImageIcon, LayoutGrid, ArrowLeft, BarChart2, Loader } from 'lucide-react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { AddQuadraModal } from '@/components/AddQuadraModal';
import { EditQuadraModal } from '@/components/EditQuadraModal';
import { EditTerritoryModal } from '@/components/EditTerritoryModal';
import { useUser } from '@/contexts/UserContext';

// Interfaces
interface Quadra { 
  id: string; 
  name: string; 
  description?: string; 
  totalHouses?: number;
  housesDone?: number;
}
interface Territory {
  id: string;
  number: string;
  name: string;
  description?: string;
  mapLink?: string;
  cardUrl?: string;
  totalHouses?: number;
  housesDone?: number;
  progress?: number;
}

// Funções de conversão
function getEmbedLink(url?: string): string | null {
  if (!url) return null;
  try {
    const urlObj = new URL(url);
    if (urlObj.pathname.includes('/maps/d/viewer')) {
      const mid = urlObj.searchParams.get('mid');
      if (mid) return `https://www.google.com/maps/d/embed?mid=${mid}`;
    }
    if (urlObj.pathname.includes('/maps/d/embed')) return url;
  } catch (e) { return null; }
  return null;
}

function convertGoogleDriveLink(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  try {
    const match = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
    if (match && match[1]) return `https://lh3.googleusercontent.com/d/${match[1]}`;
    const urlObj = new URL(url);
    const fileId = urlObj.searchParams.get('id');
    if (fileId) return `https://lh3.googleusercontent.com/d/${fileId}`;
  } catch (e) { console.error("URL inválida:", e); return null; }
  return null;
}

// Componente de Progresso
const TerritoryProgressBar = ({ territory }: { territory: Territory }) => {
    const totalHouses = territory.totalHouses || 0;
    const housesDone = territory.housesDone || 0;
    const housesPending = totalHouses - housesDone;
    const progress = territory.progress || 0;

    return (
        <div className="bg-white dark:bg-[#2f2b3a] p-4 rounded-lg shadow-lg">
          <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center mb-4">
            <BarChart2 className="mr-3 text-purple-600 dark:text-purple-400" />
            Progresso Geral do Território
          </h2>
          <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-md">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div><p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Total de Casas</p><p className="text-2xl font-bold text-gray-800 dark:text-white">{totalHouses}</p></div>
              <div><p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Casas Feitas</p><p className="text-2xl font-bold text-green-600 dark:text-green-400">{housesDone}</p></div>
              <div><p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Casas Pendentes</p><p className="text-2xl font-bold text-yellow-500 dark:text-yellow-400">{housesPending}</p></div>
              <div><p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Progresso</p><p className="text-2xl font-bold text-blue-500 dark:text-blue-400">{Math.round(progress * 100)}%</p></div>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2.5 mt-4">
              <div className="bg-blue-600 dark:bg-blue-400 h-2.5 rounded-full" style={{ width: `${progress * 100}%` }}></div>
            </div>
          </div>
        </div>
    );
};

// Componente da Seção de Quadras
const QuadrasSection = ({ quadras, territoryId }: { quadras: Quadra[], territoryId: string }) => {
    const { user } = useUser();

    return (
        <div className="bg-white dark:bg-[#2f2b3a] rounded-lg shadow-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold flex items-center text-gray-800 dark:text-white"><LayoutGrid className="h-6 w-6 mr-3 text-purple-600 dark:text-purple-400" />Quadras</h2>
            {user?.role === 'Administrador' && user?.congregationId && <AddQuadraModal territoryId={territoryId} onQuadraAdded={() => {}} existingQuadrasCount={quadras.length} congregationId={user.congregationId} />}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {quadras.length > 0 ? quadras.map(quadra => {
               const quadraTotal = quadra.totalHouses || 0;
               const quadraDone = quadra.housesDone || 0;
               const quadraPending = quadraTotal - quadraDone;
               const quadraProgress = quadraTotal > 0 ? (quadraDone / quadraTotal) * 100 : 0;
  
               return (
               <div key={quadra.id} className="bg-gray-50 dark:bg-[#2a2736] p-4 rounded-lg shadow flex flex-col justify-between hover:shadow-xl transition-shadow">
                  <Link href={`/dashboard/territorios/${territoryId}/quadras/${quadra.id}`}>
                    <div className="cursor-pointer">
                      <h3 className="font-bold text-lg text-gray-800 dark:text-white">{quadra.name}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{quadra.description || 'Sem descrição'}</p>
  
                      {user && ['Administrador', 'Dirigente'].includes(user.role) && (
                        <div className="bg-gray-100 dark:bg-gray-700/30 p-3 rounded-md mb-4">
                          <div className="grid grid-cols-4 text-center text-xs">
                            <div><span className="block text-gray-500 dark:text-gray-400">Total</span><span className="font-bold text-lg text-gray-800 dark:text-white">{quadraTotal}</span></div>
                            <div><span className="block text-gray-500 dark:text-gray-400">Feitos</span><span className="font-bold text-lg text-green-600 dark:text-green-400">{quadraDone}</span></div>
                            <div><span className="block text-gray-500 dark:text-gray-400">Pendentes</span><span className="font-bold text-lg text-yellow-500 dark:text-yellow-400">{quadraPending}</span></div>
                            <div><span className="block text-gray-500 dark:text-gray-400">Progresso</span><span className="font-bold text-lg text-blue-500 dark:text-blue-400">{Math.round(quadraProgress)}%</span></div>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5 mt-2">
                            <div className="bg-blue-600 dark:bg-blue-400 h-1.5 rounded-full" style={{ width: `${quadraProgress}%` }}></div>
                          </div>
                        </div>
                      )}
                    </div>
                  </Link>
  
                  <div className="flex justify-end items-center">
                    {['Administrador', 'Dirigente'].includes(user?.role || '') && user?.congregationId && <EditQuadraModal quadra={quadra} territoryId={territoryId} onQuadraUpdated={() => {}} congregationId={user.congregationId} />}
                  </div>
                </div>
              )
            }) : <p className="text-gray-500 dark:text-gray-400 col-span-full text-center py-5">Nenhuma quadra adicionada.</p>}
          </div>
        </div>
    );
};

export default function TerritoryDetailPage() {
  const { user, loading: userLoading } = useUser();
  const [territory, setTerritory] = useState<Territory | null>(null);
  const [quadras, setQuadras] = useState<Quadra[]>([]);
  const [loading, setLoading] = useState(true);
  const params = useParams<{ territoryId: string }>();
  const territoryId = params.territoryId;
  const congregationId = user?.congregationId;

  // Listener em tempo real para território e quadras
  useEffect(() => {
    if (!congregationId || !territoryId) {
      if (!userLoading) setLoading(false);
      return;
    }

    const territoryRef = doc(db, 'congregations', congregationId, 'territories', territoryId);
    const unsubTerritory = onSnapshot(territoryRef, (docSnap) => {
      if (docSnap.exists()) {
        setTerritory({ id: docSnap.id, ...docSnap.data() } as Territory);
      } else {
        setTerritory(null);
      }
      setLoading(false);
    });

    const quadrasRef = collection(territoryRef, 'quadras');
    const q = query(quadrasRef, orderBy('name'));
    const unsubQuadras = onSnapshot(q, (quadrasSnapshot) => {
      const quadrasData = quadrasSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Quadra));
      setQuadras(quadrasData);
    });
  
    return () => {
      unsubTerritory();
      unsubQuadras();
    };
  }, [territoryId, congregationId, userLoading]);

  if (loading || userLoading || !territory) {
    return <div className="flex h-full w-full items-center justify-center"><Loader className="animate-spin text-purple-500" /></div>;
  }
  
  const isPublisher = user?.role === 'Publicador';
  const displayMapEmbedUrl = getEmbedLink(territory.mapLink);
  const displayableCardUrl = territory.cardUrl ? convertGoogleDriveLink(territory.cardUrl) : null;
  
  const cardSection = (
    <div className="bg-white dark:bg-[#2f2b3a] p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-bold flex items-center mb-4 text-gray-800 dark:text-white"><ImageIcon className="mr-3 text-purple-600 dark:text-purple-400" /> Cartão do Território</h2>
      {displayableCardUrl ? (<a href={territory.cardUrl} target="_blank" rel="noopener noreferrer"><img src={displayableCardUrl} alt={`Cartão do Território ${territory.name}`} className="w-full h-auto rounded-md border border-gray-200 dark:border-gray-700 object-cover" /></a>) : (<div className="text-center py-10 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg"><p className="text-gray-500 dark:text-gray-500">{territory.cardUrl ? "Não foi possível exibir a imagem." : "Nenhum cartão cadastrado."}</p></div>)}
    </div>
  );

  const mapSection = (
    <div className="bg-white dark:bg-[#2f2b3a] p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center mb-4"><Map className="mr-3 text-purple-600 dark:text-purple-400" /> Mapa do Território</h2>
      {displayMapEmbedUrl ? (<iframe src={displayMapEmbedUrl} width="100%" height="250" style={{ border: 0 }} allowFullScreen={false} loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="rounded-md"></iframe>) : (<div className="text-center py-10 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg"><p className="text-gray-500 dark:text-gray-500">Nenhum link de mapa válido.</p></div>)}
    </div>
  );
  
  return (
    <div className="text-gray-800 dark:text-white space-y-8">
      <div className="flex justify-between items-start">
        <div>
           <Link href="/dashboard/territorios" className="flex items-center text-sm text-blue-600 hover:text-blue-800 dark:text-purple-400 dark:hover:text-purple-300 mb-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar para todos os territórios
          </Link>
          <h1 className="text-4xl font-bold">{territory.number}: {territory.name}</h1>
          <p className="mt-2 text-lg text-gray-600 dark:text-gray-400">{territory.description || 'Território do salão do reino'}</p>
        </div>
        {['Administrador', 'Dirigente'].includes(user?.role || '') && user?.congregationId && <EditTerritoryModal territory={territory} onTerritoryUpdated={() => {}} congregationId={user.congregationId} />}
      </div>

      {isPublisher ? (
        // Layout para Publicadores: Foco nas quadras
        <div className="space-y-8">
          <QuadrasSection quadras={quadras} territoryId={territoryId} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {cardSection}
              {mapSection}
          </div>
          <TerritoryProgressBar territory={territory} />
        </div>
      ) : (
        // Layout para Admins/Dirigentes: Visão completa
        <div className="space-y-8">
          <TerritoryProgressBar territory={territory} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {cardSection}
            {mapSection}
          </div>
          <QuadrasSection quadras={quadras} territoryId={territoryId} />
        </div>
      )}
    </div>
  );
}
