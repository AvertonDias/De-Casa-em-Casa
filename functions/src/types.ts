
export interface AppUser {
  uid: string;
  email: string;
  name: string;
  whatsapp?: string;
  congregationId: string;
  role: 'Administrador' | 'Dirigente' | 'Publicador' | 'pendente';
  status: 'ativo' | 'inativo' | 'pendente' | 'rejeitado';
  fcmTokens?: string[];
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

    
