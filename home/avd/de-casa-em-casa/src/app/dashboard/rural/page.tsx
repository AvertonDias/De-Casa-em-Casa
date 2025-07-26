
"use client";

import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useUser } from '@/contexts/UserContext';
import { AddRuralTerritoryModal } from '@/components/AddRuralTerritoryModal';
import { Map, PlusCircle, Search, Link as LinkIcon, Loader, Inbox, Edit2, Trash2 } from 'lucide-react';
import Link from 'next/link';
import AddEditLinkModal from '@/components/AddEditLinkModal'; 
import type { RuralTerritory, Congregation, RuralLink } from '@/types/types';

const RuralTerritoryCard = ({ territory }: { territory: RuralTerritory }) => (
  <Link href={`/dashboard/rural/${territory.id}`} className="block h-full">
    <div className="bg-card p-5 rounded-lg shadow-md flex flex-col justify-between h-full hover:border-primary border border-transparent transition-all">
      <div>
        <div className="flex items-center mb-3">
          <Map className="text-primary mr-3" size={24} />
          <h2 className="text-xl font-bold truncate">{territory.number} - {territory.name}</h2>
        </div>
        <p className="text-sm h-10 line-clamp-2 text-muted-foreground">{territory.description || 'Nenhuma observação.'}</p>
      </div>
      <div className="flex items-center justify-end gap-2 mt-4">
        {/* O botão de edição agora pode estar na página de detalhes */}
      </div>
    </div>
  </Link>
);


export default function RuralPage() {
  const { user, loading: userLoading } = useUser();
  const [territories, setTerritories] = useState<RuralTerritory[]>([]);
  const [congregation, setCongregation] = useState<Congregation | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [linkToEdit, setLinkToEdit] = useState<RuralLink | null>(null);

  useEffect(() => {
    if (!user?.congregationId) {
        if (!userLoading) setLoading(false);
        return;
    };

    const territoriesRef = collection(db, 'congregations', user.congregationId, 'territories');
    const q = query(territoriesRef, where("type", "==", "rural"), orderBy("number"));
    const unsubTerritories = onSnapshot(q, (snapshot) => {
      setTerritories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as RuralTerritory[]);
      setLoading(false);
    });

    const congRef = doc(db, 'congregations', user.congregationId);
    const unsubCong = onSnapshot(congRef, (docSnap) => {
      setCongregation(docSnap.data() as Congregation);
    });

    return () => { unsubTerritories(); unsubCong(); };
  }, [user, userLoading]);

  const handleOpenAddLinkModal = () => {
    setLinkToEdit(null);
    setIsLinkModalOpen(true);
  };
  
  const handleOpenEditLinkModal = (link: RuralLink) => {
    setLinkToEdit(link);
    setIsLinkModalOpen(true);
  };

  const handleSaveLink = async (linkData: Omit<RuralLink, 'id'>, id?: string) => {
    if (!user?.congregationId) return;
    const congRef = doc(db, 'congregations', user.congregationId);
    
    if (id) {
      const existingLink = congregation?.globalRuralLinks?.find(l => l.id === id);
      if (existingLink) {
        await updateDoc(congRef, { globalRuralLinks: arrayRemove(existingLink) });
        await updateDoc(congRef, { globalRuralLinks: arrayUnion({ ...linkData, id }) });
      }
    } else {
      const newLink = { ...linkData, id: crypto.randomUUID() };
      await updateDoc(congRef, { globalRuralLinks: arrayUnion(newLink) });
    }
  };

  const handleDeleteLink = async (linkToDelete: RuralLink) => {
    if (!user?.congregationId || !window.confirm(`Tem certeza que deseja excluir o link "${linkToDelete.description}"?`)) return;
    const congRef = doc(db, 'congregations', user.congregationId);
    await updateDoc(congRef, { globalRuralLinks: arrayRemove(linkToDelete) });
  };

  const filteredTerritories = territories.filter(t =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (userLoading || loading) {
    return <div className="flex items-center justify-center h-full"><Loader className="animate-spin text-primary" size={48} /></div>;
  }

  const isAdmin = user?.role === 'Administrador';

  return (
    <>
      <div className="p-4 md:p-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold">Territórios Rurais</h1>
            <p className="text-muted-foreground">{user?.congregationName || 'Sua Congregação'}</p>
          </div>
          {isAdmin && user.congregationId && (
            <>
              <button onClick={() => setIsAddModalOpen(true)} className="flex items-center px-4 py-2 bg-primary text-white font-semibold rounded-lg hover:bg-primary/90">
                  <PlusCircle size={20} className="mr-2" /> Novo Território Rural
              </button>
              <AddRuralTerritoryModal 
                  isOpen={isAddModalOpen} 
                  onClose={() => setIsAddModalOpen(false)} 
                  onTerritoryAdded={() => setIsAddModalOpen(false)} 
                  congregationId={user.congregationId} 
              />
            </>
          )}
        </div>

        <div className="bg-card p-4 rounded-lg mb-6">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold flex items-center"><LinkIcon size={16} className="mr-2"/> Links Gerais da Página</h2>
            {isAdmin && (
              <button onClick={handleOpenAddLinkModal} className="text-sm text-primary hover:underline font-semibold">+ Adicionar Link</button>
            )}
          </div>
          <div className="mt-2 text-sm space-y-2">
            {congregation?.globalRuralLinks && congregation.globalRuralLinks.length > 0 ? (
              congregation.globalRuralLinks.map(link => (
                <div key={link.id} className="flex items-center justify-between group">
                  <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline truncate pr-2">
                    {link.description}
                  </a>
                  {isAdmin && (
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleOpenEditLinkModal(link)} className="text-muted-foreground hover:text-white"><Edit2 size={14} /></button>
                      <button onClick={() => handleDeleteLink(link)} className="text-muted-foreground hover:text-red-500"><Trash2 size={14} /></button>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p className="text-muted-foreground text-xs italic">Nenhum link geral adicionado.</p>
            )}
          </div>
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

        {filteredTerritories.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredTerritories.map((territory) => (
                    <RuralTerritoryCard key={territory.id} territory={territory} />
                ))}
            </div>
        ) : (
          <div className="text-center mt-16 p-6 bg-card rounded-lg">
            <Inbox size={56} className="mx-auto text-gray-400" />
            <h2 className="mt-4 text-xl font-semibold">
              {searchTerm ? "Nenhum resultado encontrado" : "Nenhum território rural encontrado"}
            </h2>
            <p className="mt-2 text-muted-foreground">
              {searchTerm ? "Tente buscar por um termo diferente." : (isAdmin ? "Clique no botão acima para adicionar o primeiro." : "Peça a um administrador para adicionar territórios rurais.")}
            </p>
          </div>
        )}
      </div>

      <AddEditLinkModal
        isOpen={isLinkModalOpen}
        onClose={() => setIsLinkModalOpen(false)}
        onSave={handleSaveLink}
        linkToEdit={linkToEdit}
      />
    </>
  );
}
