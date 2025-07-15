// ============================================================================
//   DEFINIÇÃO DE TIPOS
// ============================================================================
export interface UserData {
  uid: string;
  email: string;
  displayName: string;
  congregationId: string;
  role: 'Administrador' | 'Dirigente' | 'Publicador' | 'pendente';
  status: 'ativo' | 'inativo' | 'pendente';
  fcmTokens?: string[];
}

export interface CreateCongregationData {
    adminName: string;
    adminEmail: string;
    adminPassword: string;
    congregationName: string;
    congregationNumber: string;
}

    