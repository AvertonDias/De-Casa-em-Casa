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
}


// Definição para um registro no Histórico de Atividades
export interface Activity {
  id: string;
  activityDate: Timestamp;
  notes?: string;
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

export interface RuralTerritory {
  id: string;
  number: string;
  name: string;
  description?: string;
  mapLink?: string;
  links?: RuralLink[];
  workLogs?: RuralWorkLog[];
  type: 'rural'; 
}
