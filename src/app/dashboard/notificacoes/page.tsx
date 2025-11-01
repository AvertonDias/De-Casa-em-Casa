
"use client";

import { useState, useEffect } from 'react';
import { useUser } from '@/contexts/UserContext';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, writeBatch, doc } from 'firebase/firestore';
import withAuth from '@/components/withAuth';
import { Bell, Inbox, AlertTriangle, CheckCheck, Loader, UserPlus, Milestone } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Link from 'next/link';
import { type Notification } from '@/types/types';
import { Button } from '@/components/ui/button';

function NotificacoesPage() {
  const { user, loading: userLoading } = useUser();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userLoading) {
      return; 
    }
    if (!user) {
      setLoading(false);
      return;
    }

    const notificationsRef = collection(db, `users/${user.uid}/notifications`);
    const q = query(notificationsRef, orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetchedNotifications = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as Notification));
        setNotifications(fetchedNotifications);
        setLoading(false);
    }, (error) => {
        console.error("Erro ao buscar notificações: ", error);
        setLoading(false);
    });

    return () => unsubscribe();
  }, [user, userLoading]);

  // Marca as notificações como lidas quando a página é visualizada
  useEffect(() => {
      if (!user || notifications.length === 0) return;

      const unreadNotifications = notifications.filter(n => !n.isRead);
      if (unreadNotifications.length > 0) {
        const batch = writeBatch(db);
        unreadNotifications.forEach(n => {
          const notifRef = doc(db, `users/${user.uid}/notifications`, n.id);
          batch.update(notifRef, { isRead: true });
        });
        batch.commit().catch(err => console.error("Erro ao marcar notificações como lidas:", err));
      }
  }, [user, notifications]);

  const handleMarkAllAsRead = async () => {
    if (!user) return;
    const batch = writeBatch(db);
    notifications.forEach(n => {
        if (!n.isRead) {
            const notifRef = doc(db, `users/${user.uid}/notifications`, n.id);
            batch.update(notifRef, { isRead: true });
        }
    });
    await batch.commit();
  };

  const getIconForType = (type: Notification['type']) => {
    switch(type) {
      case 'territory_assigned': return <Milestone className="text-blue-500" />;
      case 'territory_overdue': return <AlertTriangle className="text-red-500" />;
      case 'territory_returned': return <CheckCheck className="text-green-500" />;
      case 'territory_available': return <Bell className="text-green-500" />;
      case 'user_pending': return <UserPlus className="text-yellow-500" />;
      default: return <Bell className="text-gray-500" />;
    }
  }
  
  if (loading) {
    return <div className="flex justify-center items-center h-full p-8"><Loader className="animate-spin text-primary" size={32}/></div>
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
        <div>
            <h1 className="text-3xl font-bold">Central de Notificações</h1>
            <p className="text-muted-foreground">Veja aqui seus alertas e avisos importantes.</p>
        </div>
        
        <div className="bg-card rounded-lg border max-w-4xl mx-auto">
            <div className="p-4 flex justify-between items-center border-b">
                <h2 className="font-semibold text-lg">Suas Notificações</h2>
                {notifications.some(n => !n.isRead) && (
                    <Button variant="ghost" size="sm" onClick={handleMarkAllAsRead}>
                        <CheckCheck size={16} className="mr-2" /> Marcar todas como lidas
                    </Button>
                )}
            </div>

            {notifications.length > 0 ? (
                <div className="divide-y">
                    {notifications.map(notification => (
                        <div key={notification.id} className={`p-4 flex items-start gap-4 transition-colors ${!notification.isRead ? 'bg-primary/10' : 'bg-transparent'}`}>
                            <div className="mt-1">
                                {getIconForType(notification.type)}
                            </div>
                            <div className="flex-1">
                                <p className={`transition-colors ${!notification.isRead ? 'font-bold text-foreground' : 'font-semibold text-muted-foreground'}`}>{notification.title}</p>
                                <p className={`text-sm transition-colors ${!notification.isRead ? 'text-foreground/90' : 'text-muted-foreground'}`}>{notification.body}</p>
                                {notification.link && (
                                    <Link href={notification.link} className="text-sm text-blue-500 hover:underline mt-1 block">
                                        Ver detalhes
                                    </Link>
                                )}
                                <p className="text-xs text-muted-foreground/80 mt-1">
                                    {notification.createdAt ? formatDistanceToNow(notification.createdAt.toDate(), { addSuffix: true, locale: ptBR }) : ''}
                                </p>
                            </div>
                            {!notification.isRead && (
                                <div className="w-2.5 h-2.5 bg-primary rounded-full mt-2" title="Não lida"></div>
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
