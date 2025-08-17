
"use client";

import { useState, useEffect } from 'react';
import { useUser } from '@/contexts/UserContext';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader, Edit } from 'lucide-react';
import { Label } from '../ui/label';

export default function CongregationEditForm() {
  const { user } = useUser();
  const [congregationName, setCongregationName] = useState('');
  const [congregationNumber, setCongregationNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (user?.congregationId) {
      const congRef = doc(db, 'congregations', user.congregationId);
      getDoc(congRef).then(snap => {
        if (snap.exists()) {
          setCongregationName(snap.data().name || '');
          setCongregationNumber(snap.data().number || '');
        }
      });
    }
  }, [user?.congregationId]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');

    if (!user || !user.congregationId) {
      setError("Congregação não encontrada.");
      setIsLoading(false);
      return;
    }

    try {
      if (user.role === 'Administrador') {
        const congRef = doc(db, "congregations", user.congregationId);
        await updateDoc(congRef, { name: congregationName.trim(), number: congregationNumber.trim() });
      } else {
        throw new Error("Você não tem permissão para editar a congregação.");
      }
      setSuccess("Congregação atualizada com sucesso!");
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || "Falha ao salvar as configurações.");
    } finally {
      setIsLoading(false);
    }
  };

  const isDisabled = user?.role !== 'Administrador';

  return (
    <div className="bg-card p-6 rounded-lg shadow-md max-w-md mx-auto">
      <div className="flex items-center mb-4">
        <Edit className="h-6 w-6 mr-3 text-primary" />
        <h2 className="text-2xl font-bold">Dados da Congregação</h2>
      </div>
      <p className="text-muted-foreground mb-6">
        Edite o nome e o número da sua congregação. Apenas administradores podem realizar esta ação.
      </p>
      <form onSubmit={handleUpdate} className="space-y-4">
        <div>
          <Label htmlFor="congregationName">Nome da Congregação</Label>
          <Input 
            id="congregationName"
            value={congregationName} 
            onChange={e => setCongregationName(e.target.value)} 
            placeholder="Nome da Congregação" 
            disabled={isDisabled}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="congregationNumber">Número da Congregação</Label>
          <Input 
            id="congregationNumber"
            type="tel" 
            inputMode="numeric" 
            value={congregationNumber} 
            onChange={e => setCongregationNumber(e.target.value.replace(/\D/g, ''))} 
            placeholder="Apenas números" 
            disabled={isDisabled}
            className="mt-1"
          />
        </div>
        
        {error && <p className="text-sm text-center text-destructive">{error}</p>}
        {success && <p className="text-sm text-center text-green-500">{success}</p>}
        
        <Button type="submit" disabled={isDisabled || isLoading} className="w-full">
          {isLoading ? <Loader className="animate-spin" /> : "Salvar Alterações"}
        </Button>
      </form>
    </div>
  );
};
