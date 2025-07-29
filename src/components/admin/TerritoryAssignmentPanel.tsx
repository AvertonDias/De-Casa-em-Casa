"use client";

import { useState, useEffect, useContext } from 'react';
import { UserContext } from '@/contexts/UserContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp, arrayUnion, Timestamp } from 'firebase/firestore';
import { Search } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import AssignTerritoryModal from './AssignTerritoryModal';
import type { Territory, AppUser } from '@/types/types';

export default function TerritoryAssignmentPanel() {
  const { user: currentUser } = useContext(UserContext);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Estados para UI
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'disponivel' | 'designado'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTerritory, setSelectedTerritory] = useState<Territory | null>(null);

  // Busca todos os territórios da congregação
  useEffect(() => {
    if (!currentUser?.congregationId) return;
    const terRef = collection(db, 'congregations', currentUser.congregationId, 'territories');
    const unsub = onSnapshot(query(terRef), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Territory));
      setTerritories(data);
      setLoading(false);
    });
    return () => unsub();
  }, [currentUser]);
  
  // Busca todos os usuários que podem receber territórios
  useEffect(() => {
    if (!currentUser?.congregationId) return;
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('congregationId', '==', currentUser.congregationId), where('status', '==', 'ativo'));
    const unsub = onSnapshot(q, (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }) as AppUser));
    });
    return () => unsub();
  }, [currentUser]);

  const handleOpenModal = (territory: Territory) => {
    setSelectedTerritory(territory);
    setIsModalOpen(true);
  };
  
  const handleSaveAssignment = async (territoryId: string, user: { uid: string; name: string }, dueDate: string) => {
    if (!currentUser?.congregationId) return;
    const territoryRef = doc(db, 'congregations', currentUser.congregationId, 'territories', territoryId);

    const assignment = {
        uid: user.uid,
        name: user.name,
        assignedAt: serverTimestamp(),
        dueDate: Timestamp.fromDate(new Date(dueDate)),
    };
    
    await updateDoc(territoryRef, {
        status: 'designado',
        assignment: assignment
    });
  };
  
  const filteredTerritories = territories.filter(t => {
      const matchesStatus = filterStatus === 'all' || t.status === filterStatus;
      const matchesSearch = searchTerm === '' || t.name.toLowerCase().includes(searchTerm.toLowerCase()) || t.number.includes(searchTerm);
      return matchesStatus && matchesSearch;
  });

  return (
    <>
      <div className="bg-card p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold mb-4">Designar Territórios</h2>
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
            <input type="text" placeholder="Buscar por nome ou número..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-input rounded-md p-2 pl-10 border border-border"/>
          </div>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)} className="bg-input rounded-md p-2 border border-border">
            <option value="all">Todos os status</option>
            <option value="disponivel">Disponível</option>
            <option value="designado">Designado</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border">
                <th className="p-2">Território</th>
                <th className="p-2">Status</th>
                <th className="p-2">Designado a</th>
                <th className="p-2">Ação</th>
              </tr>
            </thead>
            <tbody>
              {filteredTerritories.map(t => (
                <tr key={t.id} className="border-b border-border">
                  <td className="p-2 font-semibold">{t.number} - {t.name}</td>
                  <td className="p-2">{t.status === 'designado' ? <span className="text-yellow-400">Designado</span> : <span className="text-green-400">Disponível</span>}</td>
                  <td className="p-2">{t.assignment ? `${t.assignment.name} (devolve em ${format(t.assignment.dueDate.toDate(), 'dd/MM/yy', { locale: ptBR })})` : 'N/A'}</td>
                  <td className="p-2"><button onClick={() => handleOpenModal(t)} className="text-primary hover:underline">Designar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      <AssignTerritoryModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveAssignment}
        territory={selectedTerritory}
        users={users}
      />
    </>
  );
}
