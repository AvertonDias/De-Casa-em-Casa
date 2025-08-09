// src/components/admin/NotificationPanel.tsx

"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast'; 
import { useUser } from '@/contexts/UserContext';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app, db } from '@/lib/firebase'; 
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import type { AppUser, Territory } from '@/types/types';

// O endpoint da Cloud Function para enviar notificações
const functionsInstance = getFunctions(app, 'southamerica-east1'); 
const sendNotificationFunction = httpsCallable(functionsInstance, 'sendPushNotification');


export default function NotificationPanel() {
  const { user: currentUser } = useUser();
  const { toast } = useToast();

  const [messageTitle, setMessageTitle] = useState('');
  const [messageBody, setMessageBody] = useState('');
  const [selectedRecipientType, setSelectedRecipientType] = useState<'all' | 'individual' | 'overdue_territories'>('all');
  const [selectedIndividualUser, setSelectedIndividualUser] = useState<string>(''); // UID do usuário individual
  
  const [availableUsers, setAvailableUsers] = useState<AppUser[]>([]); // Lista de usuários para seleção individual
  const [territoriesWithOverdueAssignment, setTerritoriesWithOverdueAssignment] = useState<Territory[]>([]); // Territórios vencidos
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Carrega lista de usuários para seleção individual e territórios vencidos
  useEffect(() => {
    if (!currentUser?.congregationId) return;

    // Busca todos os usuários ativos da congregação (para seleção individual)
    const usersRef = collection(db, 'users');
    const qUsers = query(
      usersRef, 
      where('congregationId', '==', currentUser.congregationId),
      where('status', '==', 'ativo') // Apenas usuários ativos
    );
    const unsubUsers = onSnapshot(qUsers, (snapshot) => {
      setAvailableUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as AppUser)));
    }, (err) => console.error("Erro ao carregar usuários para notificações:", err));

    // Busca territórios com designação vencida (para relembrar)
    const territoriesRef = collection(db, 'congregations', currentUser.congregationId, 'territories');
    const today = Timestamp.now(); // Usa o Timestamp do Firebase para a comparação
    const qOverdue = query(
      territoriesRef,
      where('status', '==', 'designado'),
      where('assignment.dueDate', '<', today) // Territórios designados com data de devolução ANTERIOR a hoje
    );
    const unsubOverdue = onSnapshot(qOverdue, (snapshot) => {
      setTerritoriesWithOverdueAssignment(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Territory)));
    }, (err) => console.error("Erro ao carregar territórios vencidos:", err));


    return () => {
      unsubUsers();
      unsubOverdue();
    };
  }, [currentUser]);


  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (!messageTitle.trim() || !messageBody.trim()) {
      setError('Título e mensagem são obrigatórios.');
      setIsLoading(false);
      return;
    }
    
    if (selectedRecipientType === 'individual' && !selectedIndividualUser) {
        setError('Por favor, selecione um usuário para envio individual.');
        setIsLoading(false);
        return;
    }

    if (!currentUser?.role || (currentUser.role !== 'Administrador' && currentUser.role !== 'Dirigente')) {
        setError('Você não tem permissão para enviar notificações.');
        setIsLoading(false);
        return;
    }


    try {
      let recipientUids: string[] = [];
      let notificationType: 'global' | 'individual' | 'overdue';

      switch (selectedRecipientType) {
        case 'all':
          notificationType = 'global';
          // A Cloud Function será responsável por pegar todos os UIDs, para não passar UIDs grandes no frontend
          break;
        case 'individual':
          notificationType = 'individual';
          recipientUids = [selectedIndividualUser];
          break;
        case 'overdue_territories':
          notificationType = 'overdue';
          // Para cada território vencido, pegue o UID do designado
          recipientUids = territoriesWithOverdueAssignment
            .filter(t => t.assignment?.uid) // Garante que tem um UID
            .map(t => t.assignment!.uid);
          // Opcional: Filtre UIDs duplicados se um usuário tiver múltiplos territórios vencidos
          recipientUids = [...new Set(recipientUids)]; 
          break;
        default:
          throw new Error("Tipo de destinatário inválido.");
      }

      const payload = {
        title: messageTitle.trim(),
        body: messageBody.trim(),
        targetUids: recipientUids, // Será vazio para 'all' e a Cloud Function cuidará
        notificationType: notificationType,
        senderUid: currentUser.uid,
        senderName: currentUser.name,
        congregationId: currentUser.congregationId
      };

      const result = await sendNotificationFunction(payload);

      if ((result.data as any).success) {
        toast({
          title: 'Sucesso!',
          description: (result.data as any).message || 'Notificação enviada.',
          variant: 'default',
        });
        setMessageTitle('');
        setMessageBody('');
        setSelectedIndividualUser('');
        setError('');
      } else {
        setError((result.data as any).error || 'Falha ao enviar notificação.');
      }
    } catch (err: any) {
      console.error('Erro ao enviar notificação:', err);
      setError(err.message || 'Erro inesperado ao enviar notificação.');
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="bg-card p-6 rounded-lg shadow-md max-w-2xl mx-auto">
      <div className="flex items-center mb-4">
        <Send className="h-6 w-6 mr-3 text-primary" />
        <h2 className="text-2xl font-bold">Enviar Notificação</h2>
      </div>
      <p className="text-muted-foreground mb-6">
        Envie notificações push para os usuários da congregação.
      </p>

      <form onSubmit={handleSendMessage} className="space-y-4">
        <div>
          <label htmlFor="recipientType" className="block text-sm font-medium">Destinatários:</label>
          <select
            id="recipientType"
            value={selectedRecipientType}
            onChange={(e) => setSelectedRecipientType(e.target.value as 'all' | 'individual' | 'overdue_territories')}
            className="mt-1 block w-full bg-input rounded-md p-2 border border-border"
          >
            <option value="all">Todos os Usuários Ativos</option>
            <option value="individual">Usuário Individual</option>
            {territoriesWithOverdueAssignment.length > 0 && (
                <option value="overdue_territories">Relembrar: Territórios Vencidos ({territoriesWithOverdueAssignment.length})</option>
            )}
          </select>
        </div>

        {selectedRecipientType === 'individual' && (
          <div>
            <label htmlFor="individualUser" className="block text-sm font-medium">Selecionar Usuário:</label>
            <select
              id="individualUser"
              value={selectedIndividualUser}
              onChange={(e) => setSelectedIndividualUser(e.target.value)}
              className="mt-1 block w-full bg-input rounded-md p-2 border border-border"
            >
              <option value="" disabled>Escolha um usuário...</option>
              {availableUsers.map(user => (
                <option key={user.uid} value={user.uid}>
                  {user.name}
                </option>
              ))}
            </select>
          </div>
        )}
        
        {selectedRecipientType === 'overdue_territories' && territoriesWithOverdueAssignment.length === 0 && (
            <p className="text-sm text-muted-foreground italic">Nenhum território vencido encontrado para notificar.</p>
        )}


        <div>
          <label htmlFor="messageTitle" className="block text-sm font-medium">Título da Mensagem:</label>
          <Input 
            id="messageTitle"
            value={messageTitle} 
            onChange={(e) => setMessageTitle(e.target.value)} 
            placeholder="Ex: Reunião Semanal" 
            className="mt-1"
          />
        </div>

        <div>
          <label htmlFor="messageBody" className="block text-sm font-medium">Corpo da Mensagem:</label>
          <textarea
            id="messageBody"
            value={messageBody}
            onChange={(e) => setMessageBody(e.target.value)}
            placeholder="Ex: Lembrete sobre a reunião de serviço nesta terça-feira..."
            rows={4}
            className="mt-1 block w-full bg-input rounded-md p-2 border border-border"
          ></textarea>
        </div>

        {error && <p className="text-sm text-center text-destructive">{error}</p>}
        
        <Button type="submit" disabled={isLoading} className="w-full">
          {isLoading ? <><Loader className="mr-2 h-4 w-4 animate-spin" /> Enviando...</> : "Enviar Notificação"}
        </Button>
      </form>
    </div>
  );
}
