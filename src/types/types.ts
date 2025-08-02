// src/types/types.ts

import { Timestamp } from "firebase/firestore";

// Definição para um usuário do seu aplicativo
export interface AppUser {
  uid: string;
  name: string;
  email: string;
  role: 'Administrador' | 'Dirigente' | 'Publicador';
  status: 'ativo' | 'inativo' | 'pendente' | 'rejeitado';
  congregationId?: string;
  congregationName?: string | null;
  isOnline?: boolean;
  lastSeen?: any; // Firestore Timestamp
}

// Definição para um Território
export interface Territory {
  id: string;
  number: string;
  name: string;
  type: 'urban' | 'rural'; 
  
  description?: string;
  mapLink?: string;
  cardUrl?: string;
  progress?: number;
  lastUpdate?: Timestamp;
  quadraCount?: number;

  stats?: {
    totalHouses: number;
    housesDone: number;
  };

  // Mantemos estes para compatibilidade ou uso direto, se necessário
  totalHouses?: number;
  housesDone?: number;
  
  // Novos campos de atribuição
  status: 'disponivel' | 'designado'; // Novo status
  assignment?: Assignment | null; // Objeto com os detalhes da atribuição atual
  assignmentHistory?: AssignmentHistoryLog[]; // Array com o histórico
}

export interface RuralLink {
  id: string; 
  url: string;
  description: string;
}

export interface Congregation {
    id: string;
    name: string;
    number: string;
    
    territoryCount?: number;
    ruralTerritoryCount?: number;
    totalQuadras?: number;
    totalHouses?: number;
    totalHousesDone?: number;
    
    peakOnlineUsers?: {
        count: number;
        timestamp: Timestamp;
    };

    globalRuralLinks?: RuralLink[];

    createdAt?: Timestamp;
    lastUpdate?: Timestamp;
}


// Definição para uma Quadra
export interface Quadra {
  id: string;
  name: string;
  description?: string;
  totalHouses?: number;
  housesDone?: number;
}

// Definição para uma Casa
export interface Casa {
  id: string;
  number: string;
  order: number;
  status: boolean;
  observations?: string;
  lastWorkedBy?: {
    uid: string;
    name: string;
  };
}


// Definição para um registro no Histórico de Atividades
export interface Activity {
  id: string;
  activityDate: Timestamp;
  notes?: string;
  description?: string; // <-- CAMPO ADICIONADO
  userName: string;
  userId: string;
  createdAt: Timestamp; 
}

export interface CongregationStats {
  territoryCount?: number;
  totalQuadras?: number;
  totalHouses?: number;
  totalHousesDone?: number;
  ruralTerritoryCount?: number;
}

export interface RecentTerritory {
  id: string;
  name: string;
  number: string;
  progress?: number;
  lastUpdate?: { seconds: number };
  lastWorkedTimestamp?: { seconds: number };
}

export interface RuralWorkLog {
  id: string;
  date: Timestamp;
  notes: string;
  userName: string;
  userId: string; // Adicionado para rastreamento
}

export interface RuralTerritory extends Territory {
  type: 'rural';
  links?: RuralLink[];
  workLogs?: any[]; // Ou um tipo mais específico para RuralWorkLog
}


// --- Novos Tipos para Atribuição ---

export interface Assignment {
  uid: string;      // UID do usuário designado
  name: string;     // Nome do usuário designado
  assignedAt: Timestamp; // Data em que foi atribuído
  dueDate: Timestamp;    // Data em que deve ser devolvido
}

export interface AssignmentHistoryLog {
  uid: string;
  name: string;
  assignedAt: Timestamp;
  completedAt: Timestamp; // Data em que foi devolvido
}
