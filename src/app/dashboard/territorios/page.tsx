"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, orderBy, onSnapshot, doc, getDoc, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { EditTerritoryModal } from '@/components/EditTerritoryModal';
import { useUser } from '@/contexts/UserContext';
import { Search, Inbox, Loader, PlusCircle } from 'lucide-react';
import { RestrictedContent } from '@/components/RestrictedContent';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

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

export default function TerritoriosPage() {
  const { user, loading: userLoading } = useUser();
  const [congregationName, setCongregationName] = useState('');
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');

  // State and logic for the "Add Territory" modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [number, setNumber] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [mapLink, setMapLink] = useState('');
  const [cardUrl, setCardUrl] = useState('');
  const [modalError, setModalError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOpenModal = () => {
    setNumber('');
    setName('');
    setDescription('');
    setMapLink('');
    setCardUrl('');
    setModalError('');
    setIsModalOpen(true);
  };

  const handleTerritoryAdded = () => {
    // This can be used for a success toast in the future
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setModalError('');

    if (!number || !name) {
      setModalError('Número e Nome são campos obrigatórios.');
      setIsSubmitting(false);
      return;
    }

    if (!user?.congregationId) {
      setModalError("ID da congregação não encontrado. Ação bloqueada.");
      setIsSubmitting(false);
      return;
    }

    try {
      const territoriesRef = collection(db, 'congregations', user.congregationId, 'territories');
      await addDoc(territoriesRef, {
        number,
        name,
        description,
        mapLink,
        cardUrl,
        type: 'urban',
        lastUpdate: serverTimestamp(),
        progress: 0,
      });

      setIsModalOpen(false);
      handleTerritoryAdded();
      
    } catch (err) {
      console.error("Erro ao adicionar território:", err);
      setModalError("Não foi possível adicionar o território. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (userLoading) return;

    if (user?.status === 'ativo' && user.congregationId) {
      const fetchCongregationName = async () => {
        const congRef = doc(db, 'congregations', user.congregationId!);
        const congSnap = await getDoc(congRef);
        if (congSnap.exists()) {
          setCongregationName(congSnap.data().name);
        }
      };
      fetchCongregationName();

      const territoriesRef = collection(db, 'congregations', user.congregationId, 'territories');
      const q = query(territoriesRef, where("type", "in", ["urban", null]), orderBy('number'));

      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const territoriesData = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as Territory[];
        
        setTerritories(territoriesData);
        setLoading(false);
      }, (error) => {
        console.error("Erro ao ouvir territórios:", error);
        setLoading(false);
      });

      return () => unsubscribe();
    } else if (!userLoading) {
        setLoading(false);
    }
  }, [user, userLoading]);
  
  const filteredTerritories = territories.filter(territory =>
    territory.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    territory.number.toString().toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading || userLoading) {
    return <div className="flex justify-center items-center h-full"><Loader className="animate-spin" /></div>;
  }

  if (!user) {
    return <p>Usuário não encontrado.</p>;
  }

  if (user.status === 'pendente') {
    return (
        <RestrictedContent
            title="Acesso aos Territórios Restrito"
            message="Seu acesso precisa ser aprovado por um administrador para que você possa ver esta página."
        />
    )
  }

  return (
    <div className="text-gray-800 dark:text-white">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Territórios da Congregação</h1>
          <p className="text-purple-400 font-semibold">{user?.congregationName || 'Carregando...'}</p>
        </div>
        {user?.role === 'Administrador' && (
            <button 
              onClick={handleOpenModal} 
              className="w-full md:w-auto flex items-center justify-center px-4 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition-colors"
            >
                <PlusCircle size={20} className="mr-2" />
                Adicionar Território
            </button>
        )}
      </div>

      <div className="mb-6 relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-5 w-5 text-gray-400" />
          </span>
          <input
              type="text"
              placeholder="Buscar por nome ou número..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-card border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
      </div>

      <div className="space-y-6">
        {filteredTerritories.length > 0 ? (
          filteredTerritories.map(territory => {
            const totalHouses = territory.totalHouses || 0;
            const housesDone = territory.housesDone || 0;
            const progress = territory.progress || 0;
            const housesPending = totalHouses - housesDone;

            return (
              <div key={territory.id} onClick={() => router.push(`/dashboard/territorios/${territory.id}`)} className="block group cursor-pointer">
                <div className="bg-white dark:bg-[#2f2b3a] rounded-lg shadow-lg p-6 transition-all duration-200 group-hover:shadow-xl group-hover:ring-2 group-hover:ring-primary">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <span className="font-bold text-xl text-purple-600 dark:text-purple-300 mr-4">{territory.number}</span>
                      <span className="font-semibold text-lg group-hover:underline">{territory.name}</span>
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                        {['Administrador', 'Dirigente'].includes(user?.role || '') && user?.congregationId && <EditTerritoryModal territory={territory} onTerritoryUpdated={() => {}} congregationId={user.congregationId} />}
                    </div>
                  </div>

                  {user && ['Administrador', 'Dirigente'].includes(user.role) && (
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center text-xs">
                          <div><p className="text-gray-500 dark:text-gray-400">Total Casas</p><p className="font-bold text-lg">{totalHouses}</p></div>
                          <div><p className="text-gray-500 dark:text-gray-400">Feitas</p><p className="font-bold text-lg text-green-500">{housesDone}</p></div>
                          <div><p className="text-gray-500 dark:text-gray-400">Pendentes</p><p className="font-bold text-lg text-yellow-500">{housesPending}</p></div>
                          <div><p className="text-gray-500 dark:text-gray-400">Progresso</p><p className="font-bold text-lg text-blue-500">{Math.round(progress * 100)}%</p></div>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-3">
                            <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${progress * 100}%` }}></div>
                        </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })
        ) : (
          <div className="text-center mt-16 p-6 bg-white dark:bg-[#2a2736] rounded-lg">
              <Inbox size={56} className="mx-auto text-gray-400" />
              <h2 className="mt-4 text-xl font-semibold text-gray-800 dark:text-white">
                {searchTerm ? "Nenhum resultado encontrado" : "Nenhum território cadastrado"}
              </h2>
              <p className="mt-2 text-gray-500 dark:text-gray-400">
                {searchTerm ? "Tente buscar por um termo diferente." : "Clique em \"Adicionar Território\" para começar."}
              </p>
          </div>
        )}
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Adicionar Novo Território</DialogTitle>
            <DialogDescription>
              Preencha os detalhes do novo território abaixo.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} id="add-territory-form" className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="number-modal">Número</Label>
                <Input id="number-modal" value={number} onChange={(e) => setNumber(e.target.value)} placeholder="Ex: 12" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name-modal">Nome</Label>
                <Input id="name-modal" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Centro Comercial" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description-modal">Observações (Opcional)</Label>
                <Textarea id="description-modal" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex: Território da prefeitura..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mapLink-modal">Link do Mapa (Opcional)</Label>
                <Input id="mapLink-modal" value={mapLink} onChange={(e) => setMapLink(e.target.value)} placeholder="https://maps.google.com/..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cardUrl-modal">URL do Cartão (Opcional)</Label>
                <Input id="cardUrl-modal" value={cardUrl} onChange={(e) => setCardUrl(e.target.value)} placeholder="https://drive.google.com/..." />
              </div>
            {modalError && <p className="text-red-500 text-sm text-center">{modalError}</p>}
          </form>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button type="submit" form="add-territory-form" disabled={isSubmitting}>
              {isSubmitting ? "Salvando..." : "Salvar Território"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
