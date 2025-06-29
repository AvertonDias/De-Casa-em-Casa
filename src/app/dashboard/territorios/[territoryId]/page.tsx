"use client";

import { useEffect, useState } from 'react';
import { doc, getDoc, collection, query, orderBy, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Map, Image as ImageIcon, LayoutGrid, ArrowLeft, BarChart2 } from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { AddQuadraModal } from '@/components/AddQuadraModal';
import { EditQuadraModal } from '@/components/EditQuadraModal';
import { EditTerritoryModal } from '@/components/EditTerritoryModal';
import { useUser } from '@/contexts/UserContext';

// Interfaces
interface Stats { total: number; feitos: number; pendentes: number; progresso: number; }
interface Quadra { id: string; name: string; description?: string; stats: Stats; }
interface Territory {
  id: string;
  number: string;
  name: string;
  description?: string;
  mapLink?: string;
  cardUrl?: string;
}

// Funções de conversão
function getEmbedLink(url?: string): string | null {
  if (!url) return null;
  try {
    const urlObj = new URL(url);
    if (urlObj.pathname.includes('/maps/d/viewer')) {
      const mid = urlObj.searchParams.get('mid');
      if (mid) {
        return `https://www.google.com/maps/d/embed?mid=${mid}`;
      }
    }
    if (urlObj.pathname.includes('/maps/d/embed')) {
      return url;
    }
  } catch (e) {
    return null;
  }
  return null;
}

function convertGoogleDriveLink(url: string): string | null {
  if (!url || typeof url !== 'string') return null;

  try {
    const match = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
    if (match && match[1]) {
      const fileId = match[1];
      return `https://lh3.googleusercontent.com/d/${fileId}`;
    }

    const urlObj = new URL(url);
    const fileId = urlObj.searchParams.get('id');
    if (fileId) {
      return `https://lh3.googleusercontent.com/d/${fileId}`;
    }

  } catch (e) {
    console.error("URL inválida ou não é do Google Drive:", e);
    return null; 
  }

  return null;
}


export default function TerritorioDetailPage() {
  const { user, loading: userLoading } = useUser();
  const [territory, setTerritory] = useState<Territory | null>(null);
  const [quadras, setQuadras] = useState<Quadra[]>([]);
  const [territoryStats, setTerritoryStats] = useState<Stats>({ total: 0, feitos: 0, pendentes: 0, progresso: 0 });
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const params = useParams<{ territoryId: string }>();
  const territoryId = params.territoryId;

  // Real-time listener for quadras and stats calculation
  useEffect(() => {
    if (userLoading) {
      return;
    }
    if (!user || !user.congregationId) {
        console.error("Usuário não autenticado ou sem ID de congregação.");
        setLoading(false);
        return;
    }
    if (!territoryId) {
      setLoading(false);
      return;
    }
  
    const territoryRef = doc(db, 'congregations', user.congregationId, 'territories', territoryId);
  
    const fetchTerritoryInfo = async () => {
      const territorySnap = await getDoc(territoryRef);
      if (territorySnap.exists()) {
        setTerritory({ id: territorySnap.id, ...territorySnap.data() } as Territory);
      } else {
        router.push('/dashboard/territorios');
      }
    };
    
    // Fetch territory info only if it's not already set
    if (!territory) {
      fetchTerritoryInfo();
    }
  
    const quadrasRef = collection(territoryRef, 'quadras');
    const q = query(quadrasRef, orderBy('name'));
  
    const unsubscribe = onSnapshot(q, async (quadrasSnapshot) => {
      let totalCasasGeral = 0;
      let feitosGeral = 0;
  
      const quadrasComStats = await Promise.all(
        quadrasSnapshot.docs.map(async (quadraDoc) => {
          const casasRef = collection(quadraDoc.ref, 'casas');
          const casasSnap = await getDocs(casasRef);
          
          const total = casasSnap.size;
          const feitos = casasSnap.docs.filter(doc => doc.data().status === true).length;
          
          totalCasasGeral += total;
          feitosGeral += feitos;
  
          return {
            id: quadraDoc.id,
            name: quadraDoc.data().name,
            description: quadraDoc.data().description,
            stats: { 
              total, 
              feitos, 
              pendentes: total - feitos, 
              progresso: total > 0 ? Math.round((feitos / total) * 100) : 0 
            }
          } as Quadra;
        })
      );
      
      setQuadras(quadrasComStats);
  
      setTerritoryStats({
        total: totalCasasGeral,
        feitos: feitosGeral,
        pendentes: totalCasasGeral - feitosGeral,
        progresso: totalCasasGeral > 0 ? Math.round((feitosGeral / totalCasasGeral) * 100) : 0,
      });
  
      setLoading(false);
    }, (error) => {
      console.error("Erro ao ouvir as mudanças nas quadras:", error);
      setLoading(false);
    });
  
    return () => unsubscribe();
  }, [territoryId, user, userLoading, router, territory]);


  if (loading) {
    return <div className="text-center text-gray-500 dark:text-gray-400">Carregando detalhes do território...</div>;
  }

  if (!territory) {
    return <div className="text-center text-red-500 dark:text-red-400">Território não encontrado.</div>;
  }
  
  const displayMapEmbedUrl = getEmbedLink(territory.mapLink);
  const displayableCardUrl = territory.cardUrl ? convertGoogleDriveLink(territory.cardUrl) : null;

  const fetchTerritoryInfoForModal = async () => {
    if (!user?.congregationId) return;
    const territoryRef = doc(db, 'congregations', user.congregationId, 'territories', territoryId);
    const territorySnap = await getDoc(territoryRef);
    if (territorySnap.exists()) {
      setTerritory({ id: territorySnap.id, ...territorySnap.data() } as Territory);
    }
  }

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
        <EditTerritoryModal territory={territory} onTerritoryUpdated={fetchTerritoryInfoForModal} />
      </div>

       <div className="bg-white dark:bg-[#2f2b3a] p-4 rounded-lg shadow-lg">
        <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center mb-4">
          <BarChart2 className="mr-3 text-purple-600 dark:text-purple-400" />
          Progresso Geral do Território
        </h2>
        <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-md">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Total de Casas</p>
              <p className="text-2xl font-bold text-gray-800 dark:text-white">{territoryStats.total}</p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Casas Feitas</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{territoryStats.feitos}</p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Casas Pendentes</p>
              <p className="text-2xl font-bold text-yellow-500 dark:text-yellow-400">{territoryStats.pendentes}</p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Progresso</p>
              <p className="text-2xl font-bold text-blue-500 dark:text-blue-400">{territoryStats.progresso}%</p>
            </div>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2.5 mt-4">
            <div className="bg-blue-600 dark:bg-blue-400 h-2.5 rounded-full" style={{ width: `${territoryStats.progresso}%` }}></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-[#2f2b3a] p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-bold flex items-center mb-4 text-gray-800 dark:text-white">
            <ImageIcon className="mr-3 text-purple-600 dark:text-purple-400" /> Cartão do Território
          </h2>
          {displayableCardUrl ? (
            <a href={territory.cardUrl} target="_blank" rel="noopener noreferrer" title="Abrir link original em nova aba">
              <img 
                src={displayableCardUrl} 
                alt={`Cartão do Território ${territory.name}`} 
                className="w-full h-auto rounded-md border border-gray-200 dark:border-gray-700 object-cover" 
              />
            </a>
          ) : (
            <div className="text-center py-10 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
              <p className="text-gray-500 dark:text-gray-500">
                {territory.cardUrl ? "Não foi possível exibir a imagem. Verifique o link." : "Nenhum cartão cadastrado."}
              </p>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-[#2f2b3a] p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center mb-4">
            <Map className="mr-3 text-purple-600 dark:text-purple-400" /> Mapa do Território
          </h2>
          {displayMapEmbedUrl ? (
            <iframe
              src={displayMapEmbedUrl}
              width="100%"
              height="250"
              style={{ border: 0 }}
              allowFullScreen={false}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="rounded-md"
            ></iframe>
          ) : (
            <div className="text-center py-10 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
              <p className="text-gray-500 dark:text-gray-500">Nenhum link de mapa válido cadastrado.</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Edite o território para adicionar um link do Google My Maps.</p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-[#2f2b3a] rounded-lg shadow-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold flex items-center text-gray-800 dark:text-white"><LayoutGrid className="h-6 w-6 mr-3 text-purple-600 dark:text-purple-400" />Quadras</h2>
          <AddQuadraModal territoryId={territoryId} onQuadraAdded={() => {}} existingQuadrasCount={quadras.length} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {quadras.length > 0 ? quadras.map(quadra => (
             <div 
                key={quadra.id} 
                className="bg-gray-50 dark:bg-[#2a2736] p-4 rounded-lg shadow flex flex-col justify-between hover:shadow-xl transition-shadow"
              >
                <Link href={`/dashboard/territorios/${territoryId}/quadras/${quadra.id}`}>
                  <div className="cursor-pointer">
                    <h3 className="font-bold text-lg text-gray-800 dark:text-white">{quadra.name}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{quadra.description || 'Sem descrição'}</p>

                    <div className="bg-gray-100 dark:bg-gray-700/30 p-3 rounded-md mb-4">
                      <div className="grid grid-cols-4 text-center text-xs">
                        <div>
                          <span className="block text-gray-500 dark:text-gray-400">Total</span>
                          <span className="font-bold text-lg text-gray-800 dark:text-white">{quadra.stats.total}</span>
                        </div>
                        <div>
                          <span className="block text-gray-500 dark:text-gray-400">Feitos</span>
                          <span className="font-bold text-lg text-green-600 dark:text-green-400">{quadra.stats.feitos}</span>
                        </div>
                        <div>
                          <span className="block text-gray-500 dark:text-gray-400">Pendentes</span>
                          <span className="font-bold text-lg text-yellow-500 dark:text-yellow-400">{quadra.stats.pendentes}</span>
                        </div>
                        <div>
                          <span className="block text-gray-500 dark:text-gray-400">Progresso</span>
                          <span className="font-bold text-lg text-blue-500 dark:text-blue-400">{quadra.stats.progresso}%</span>
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5 mt-2">
                        <div className="bg-blue-600 dark:bg-blue-400 h-1.5 rounded-full" style={{ width: `${quadra.stats.progresso}%` }}></div>
                      </div>
                    </div>
                  </div>
                </Link>

                <div className="flex justify-end items-center">
                  <EditQuadraModal quadra={quadra} territoryId={territoryId} onQuadraUpdated={() => {}} />
                </div>
              </div>
          )) : <p className="text-gray-500 dark:text-gray-400 col-span-full text-center py-5">Nenhuma quadra adicionada.</p>}
        </div>
      </div>
    </div>
  );
}
