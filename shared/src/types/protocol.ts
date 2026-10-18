export type WsClientType = 'desktop' | 'web' | 'cli' | 'skill';

export type WsMessageType =
  | 'identify'
  | 'pet_action'
  | 'pet_speech'
  | 'pet_state_update'
  | 'pet_click'
  | 'system_notice'
  | 'ping'
  | 'pong';

export interface WsMessage<T = any> {
  type: WsMessageType;
  timestamp: string;
  payload?: T;
}

export type PetMood = 'happy' | 'normal';

export type PetActionType =
  | 'idle'
  | 'wave'
  | 'jump'
  | 'speak';

export interface PetState {
  name: string;
  favor: number; // 0 - 100
  mood: PetMood;
  level: number;
  experience: number;
  currentAction: PetActionType;
  lastInteractedTime: string;
  updatedAt: string;
}

export interface PetActionPayload {
  action: PetActionType;
  duration: number;
  speech?: string;
  sound?: string;
}

export interface PetSpeechPayload {
  text: string;
  duration: number;
}

export interface ActionHistoryRecord {
  id: string;
  type?: string;
  summary?: string;
  details?: Record<string, any>;
  timestamp: string;
  source?: 'web' | 'cli' | 'skill' | 'system';
}

export interface UserConfig {
  token: string;
  port: number;
  mcpEndpoint: string;
  autoStart: boolean;
}
