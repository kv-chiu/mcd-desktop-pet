import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export interface AppConfig {
  token: string;
  mcpEndpoint: string;
  port: number;
  petName: string;
  soundEnabled: boolean;
  autoStart: boolean;
}

import { PetMood, PetActionType, PetState, ActionHistoryRecord } from '@mcd/shared';
export { PetMood, PetActionType, PetState, ActionHistoryRecord };

const DEFAULT_CONFIG: AppConfig = {
  token: process.env.MCD_MCP_TOKEN || '',
  mcpEndpoint: process.env.MCD_MCP_ENDPOINT || 'https://mcp.mcd.cn/mcp-servers/mcd-mcp',
  port: Number(process.env.PORT) || 3001,
  petName: '麦麦宝',
  soundEnabled: true,
  autoStart: false,
};

const DEFAULT_PET_STATE: PetState = {
  name: '麦麦宝',
  favor: 60,
  mood: 'happy',
  level: 1,
  experience: 0,
  currentAction: 'idle',
  lastInteractedTime: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export class StorageService {
  private baseDir: string;
  private configPath: string;
  private petStatePath: string;
  private historyPath: string;

  constructor() {
    this.baseDir = path.join(os.homedir(), '.mcd-desktop-pet');
    this.configPath = path.join(this.baseDir, 'config.json');
    this.petStatePath = path.join(this.baseDir, 'pet_state.json');
    this.historyPath = path.join(this.baseDir, 'history.json');
    this.ensureDirectory();
  }

  private ensureDirectory(): void {
    if (!fs.existsSync(this.baseDir)) {
      try {
        fs.mkdirSync(this.baseDir, { recursive: true });
      } catch (err) {
        console.error('Failed to create storage directory:', err);
      }
    }
  }

  // --- Config Storage ---
  getConfig(): AppConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const raw = fs.readFileSync(this.configPath, 'utf-8');
        return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
      }
    } catch (err) {
      console.warn('Error reading config, using default:', err);
    }
    return { ...DEFAULT_CONFIG };
  }

  saveConfig(partial: Partial<AppConfig>): AppConfig {
    const current = this.getConfig();
    const updated = { ...current, ...partial };
    try {
      this.ensureDirectory();
      fs.writeFileSync(this.configPath, JSON.stringify(updated, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error writing config:', err);
    }
    return updated;
  }

  // --- Pet State Storage ---
  getPetState(): PetState {
    let state = { ...DEFAULT_PET_STATE };
    try {
      if (fs.existsSync(this.petStatePath)) {
        const raw = fs.readFileSync(this.petStatePath, 'utf-8');
        state = { ...DEFAULT_PET_STATE, ...JSON.parse(raw) };
      }
    } catch (err) {
      console.warn('Error reading pet state, using default:', err);
    }

    // Apply natural decay based on elapsed hours
    return this.applyDecay(state);
  }

  private applyDecay(state: PetState): PetState {
    let calculatedMood: PetMood = state.mood;
    if (state.favor >= 60) {
      calculatedMood = 'happy';
    } else {
      calculatedMood = 'normal';
    }

    return {
      ...state,
      mood: calculatedMood,
    };
  }

  updatePetState(partial: Partial<PetState>): PetState {
    const current = this.getPetState();
    const updated: PetState = {
      ...current,
      ...partial,
      updatedAt: new Date().toISOString(),
    };

    // Clamp values
    if (typeof updated.favor === 'number') {
      updated.favor = Math.min(100, Math.max(0, updated.favor));
    }

    // Check level up: 100 exp per level
    while (updated.experience >= updated.level * 100) {
      updated.experience -= updated.level * 100;
      updated.level += 1;
    }

    try {
      this.ensureDirectory();
      fs.writeFileSync(this.petStatePath, JSON.stringify(updated, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error writing pet state:', err);
    }
    return updated;
  }

  interactPet(): { state: PetState; message: string } {
    const current = this.getPetState();
    const updated = this.updatePetState({
      favor: Math.min(100, current.favor + 5),
      experience: current.experience + 5,
      mood: 'happy',
      currentAction: 'jump',
      lastInteractedTime: new Date().toISOString(),
    });

    this.recordHistory({
      type: 'pet_action',
      summary: '主人抚摸了桌宠 (+5 好感度)',
    });

    return { state: updated, message: '主人摸摸头，今天也要开心鸭！' };
  }

  // --- History Storage ---
  getHistory(limit: number = 50): ActionHistoryRecord[] {
    try {
      if (fs.existsSync(this.historyPath)) {
        const raw = fs.readFileSync(this.historyPath, 'utf-8');
        const list: ActionHistoryRecord[] = JSON.parse(raw);
        return list.slice(-limit).reverse();
      }
    } catch (err) {
      console.warn('Error reading history:', err);
    }
    return [];
  }

  recordHistory(record: Omit<ActionHistoryRecord, 'id' | 'timestamp'>): void {
    try {
      let list: ActionHistoryRecord[] = [];
      if (fs.existsSync(this.historyPath)) {
        const raw = fs.readFileSync(this.historyPath, 'utf-8');
        list = JSON.parse(raw);
      }
      list.push({
        ...record,
        id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        timestamp: new Date().toISOString(),
      });
      // Keep up to 200 records
      if (list.length > 200) {
        list = list.slice(list.length - 200);
      }
      this.ensureDirectory();
      fs.writeFileSync(this.historyPath, JSON.stringify(list, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error writing history:', err);
    }
  }
}

export const storage = new StorageService();
