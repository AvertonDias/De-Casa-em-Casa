// src/functions/src/types/types.ts

import { Timestamp, FieldValue } from "firebase-admin/firestore";

// Definição para um usuário do seu aplicativo
export interface AppUser {
  uid: string;
  name: string;
  email: string;
  photoURL?: string;
  whatsapp?: string; // Campo para o WhatsApp
  role: 'Administrador' | 'Dirigente' | 'Servo de Territórios' | 'Publicador';
  status: 'ativo' | 'inativo' | 'pendente' | 'rejeitado' | 'bloqueado';
  congregationId?: string;
  congregationName?: string | null;
  isOnline?: boolean;
  lastSeen?: any; // Firestore Timestamp
}

export interface Notification {
  id: string;
  title: string;
  body: string;
  link?: string;
  type: 'territory_assigned' | 'territory_overdue' | 'user_pending' | 'announcement' | 'territory_returned' | 'territory_available';
  isRead: boolean;
  createdAt: Timestamp;
  readAt?: Timestamp; 
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
  lastUpdate?: Timestamp | FieldValue;
  lastWorkedAt?: Timestamp | FieldValue;
  createdAt?: Timestamp | FieldValue;
  quadraCount?: number;

  stats?: {
    totalHouses: number;
    housesDone: number;
  };
  
  status: 'disponivel' | 'designado';
  assignment?: Assignment | null; 
  assignmentHistory?: AssignmentHistoryLog[];
  links?: RuralLink[]; 
  workLogs?: any[]; 
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
    
    territoryCount: number;
    ruralTerritoryCount: number;
    totalQuadras: number;
    totalHouses: number;
    totalHousesDone: number;
    
    peakOnlineUsers?: {
        count: number;
        timestamp: Timestamp;
    };

    globalRuralLinks?: RuralLink[];

    createdAt?: Timestamp;
    lastUpdate?: Timestamp;
}

export interface Quadra {
  id: string;
  name: string;
  description?: string;
  totalHouses: number;
  housesDone: number;
}

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

export interface Activity {
  id: string;
  activityDate: Timestamp;
  notes?: string;
  description?: string; 
  userName: string;
  userId: string;
  createdAt: Timestamp; 
  type?: 'work' | 'manual';
}

export interface Assignment {
  uid: string;     
  name: string;    
  assignedAt: Timestamp; 
  dueDate: Timestamp;    
}

export interface AssignmentHistoryLog {
  uid: string;
  name: string;
  assignedAt: Timestamp;
  completedAt: Timestamp;
}
