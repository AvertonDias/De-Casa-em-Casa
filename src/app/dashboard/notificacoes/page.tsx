
"use client";

import { useState, useEffect } from 'react';
import { useUser } from '@/contexts/UserContext';
import withAuth from '@/components/withAuth';
import { Bell, Inbox, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Link from 'next/link';

// Simulação de dados de notificação
const mockNotifications = [
  {
    id: '1',
    type: 'territory_assigned',
    title: 'Novo Território Designado',
    body: 'O território "Centro 1" foi designado para você.',
    timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 minutos atrás
    isRead: false,
    link: '/dashboard/meus-territorios'
  },
  {
    id: '2',
    type: 'territory_overdue',
    title: 'Território Atrasado!',
    body: 'O prazo para devolução do território "Jardim dos Italianos" venceu.',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2), // 2 dias atrás
    isRead: false,
    link: '/dashboard/meus-territorios'
  },
  {
    id: '3',
    type: 'announcement',
    title: 'Reunião de Serviço',
    body: 'Lembrete da reunião de serviço na próxima terça-feira.',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5), // 5 dias atrás
    isRead: true,
  },
];


function NotificacoesPage() {
  const { user } = useUser();
  const [notifications, setNotifications] = useState(mockNotifications);

  const handleMarkAsRead = (id: string) => {
    setNotifications(
      notifications.map(n => n.id === id ? { ...n, isRead: true } : n)
    );
  };
  
  const handleMarkAllAsRead = () => {
    setNotifications(
        notifications.map(n => ({...n, isRead: true}))
    );
  }

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="p-4 md:p-8 space-y-6">
        <div>
            <h1 className="text-3xl font-bold">Central de Notificações</h1>
            <p className="text-muted-foreground">Veja aqui seus alertas e avisos importantes.</p>
        </div>
        
        <div className="bg-card rounded-lg border max-w-4xl mx-auto">
            <div className="p-4 flex justify-between items-center border-b">
                <h2 className="font-semibold text-lg">Suas Notificações</h2>
                {unreadCount > 0 && (
                    <button onClick={handleMarkAllAsRead} className="text-sm text-primary hover:underline">
                        Marcar todas como lidas
                    </button>
                )}
            </div>

            {notifications.length > 0 ? (
                <div className="divide-y">
                    {notifications.map(notification => (
                        <div key={notification.id} className={`p-4 flex items-start gap-4 ${!notification.isRead ? 'bg-primary/5' : ''}`}>
                            <div className="mt-1">
                                {!notification.isRead && <div className="w-2.5 h-2.5 bg-primary rounded-full"></div>}
                            </div>
                            <div className="flex-1">
                                <p className={`font-semibold ${!notification.isRead ? 'text-foreground' : 'text-muted-foreground'}`}>{notification.title}</p>
                                <p className="text-sm text-muted-foreground">{notification.body}</p>
                                {notification.link ? (
                                    <Link href={notification.link} className="text-sm text-blue-500 hover:underline">
                                        Ver detalhes
                                    </Link>
                                ) : null}
                                <p className="text-xs text-muted-foreground/80 mt-1">
                                    {formatDistanceToNow(notification.timestamp, { addSuffix: true, locale: ptBR })}
                                </p>
                            </div>
                            {!notification.isRead && (
                                <button onClick={() => handleMarkAsRead(notification.id)} className="text-sm text-muted-foreground hover:text-foreground">
                                    Marcar como lida
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center p-10 text-muted-foreground">
                    <Inbox size={48} className="mx-auto mb-4" />
                    <h3 className="font-semibold">Nenhuma notificação</h3>
                    <p className="text-sm">Você está em dia com todos os seus avisos.</p>
                </div>
            )}
        </div>
    </div>
  );
}

export default withAuth(NotificacoesPage);
