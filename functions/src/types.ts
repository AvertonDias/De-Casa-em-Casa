
export interface AppUser {
  uid: string;
  email: string;
  name: string;
  whatsapp?: string;
  congregationId: string;
  role: 'Administrador' | 'Dirigente' | 'Publicador' | 'pendente';
  status: 'ativo' | 'inativo' | 'pendente' | 'rejeitado';
  isOnline?: boolean;
  lastSeen?: any;
}

export interface CreateCongregationData {
    adminName: string;
    adminEmail: string;
    adminPassword: string;
    congregationName: string;
    congregationNumber: string;
    whatsapp: string;
}

export interface Notification {
  id: string;
  title: string;
  body: string;
  link?: string;
  type: 'territory_assigned' | 'territory_overdue' | 'user_pending' | 'announcement' | 'territory_returned' | 'territory_available';
  isRead: boolean;
  createdAt: any;
}

export interface Territory {
    id: string;
}
    
