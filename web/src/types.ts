export interface NoteItem {
  id: string;
  order_number: string;
  title: string;
  content: string;
  media?: string[];
  position: [number, number];
  size: [number, number];
  status: 'active' | 'archived';
  theme?: string;
  pinned: boolean;
  created_at: string;
  updated_at: string;
  archived_at?: string;
}

export interface AppConfig {
  theme: 'mcdonalds' | 'pure';
  port: number;
  auto_start: boolean;
  sound_enabled: boolean;
  volume: number;
  pet_scale?: number;
}

export interface PluginInfo {
  id: string;
  name: string;
  version: string;
  description: string;
  category: string;
  is_builtin: boolean;
  status: string;
  icon?: string;
  slots: string[];
  author: string;
  metadata?: Record<string, string>;
}

export interface PetState {
  current_action: string;
  mood: string;
  hunger: number;
  stamina: number;
  is_visible: boolean;
  scale: number;
}
