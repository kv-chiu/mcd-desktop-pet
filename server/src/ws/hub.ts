import { WSContext } from 'hono/ws';
import { storage } from '../storage/index.js';
import type { WsClientType, WsMessage, PetState, PetActionType } from '@mcd/shared';
export type { WsClientType, WsMessage };

export interface ConnectedClient {
  id: string;
  type: WsClientType;
  ws: WSContext;
  connectedAt: string;
}

export class WebSocketHub {
  private clients: Map<string, ConnectedClient> = new Map();

  constructor() {}

  registerClient(id: string, ws: WSContext, type: WsClientType = 'desktop'): ConnectedClient {
    const client: ConnectedClient = {
      id,
      type,
      ws,
      connectedAt: new Date().toISOString(),
    };
    this.clients.set(id, client);
    console.log(`[WebSocketHub] Client connected: ${id} (${type}), total: ${this.clients.size}`);

    this.sendToClient(client, {
      type: 'pet_state_update',
      timestamp: new Date().toISOString(),
      payload: storage.getPetState(),
    });

    return client;
  }

  unregisterClient(id: string): void {
    if (this.clients.has(id)) {
      this.clients.delete(id);
      console.log(`[WebSocketHub] Client disconnected: ${id}, total: ${this.clients.size}`);
    }
  }

  setClientType(id: string, type: WsClientType): void {
    const client = this.clients.get(id);
    if (client) {
      client.type = type;
      console.log(`[WebSocketHub] Client ${id} identified as: ${type}`);
    }
  }

  getConnectedCount(): { total: number; desktop: number; web: number; other: number } {
    let desktop = 0;
    let web = 0;
    let other = 0;

    for (const client of this.clients.values()) {
      if (client.type === 'desktop') desktop++;
      else if (client.type === 'web') web++;
      else other++;
    }

    return { total: this.clients.size, desktop, web, other };
  }

  sendToClient(client: ConnectedClient, msg: WsMessage): void {
    try {
      client.ws.send(JSON.stringify(msg));
    } catch (err) {
      console.warn(`[WebSocketHub] Failed to send to ${client.id}:`, err);
    }
  }

  broadcast(msg: WsMessage, targetType?: WsClientType): void {
    const payloadStr = JSON.stringify(msg);
    for (const client of this.clients.values()) {
      if (!targetType || client.type === targetType) {
        try {
          client.ws.send(payloadStr);
        } catch (err) {
          console.warn(`[WebSocketHub] Broadcast error to ${client.id}:`, err);
        }
      }
    }
  }

  emitPetAction(
    action: PetActionType,
    options?: { duration?: number; speech?: string; sound?: string }
  ): void {
    storage.updatePetState({ currentAction: action });

    const msg: WsMessage = {
      type: 'pet_action',
      timestamp: new Date().toISOString(),
      payload: {
        action,
        duration: options?.duration || 3.0,
        speech: options?.speech,
        sound: options?.sound,
      },
    };

    console.log(`[WebSocketHub] Broadcasting pet action: ${action}`);
    this.broadcast(msg);
  }

  emitPetSpeech(text: string, duration: number = 4): void {
    const msg: WsMessage = {
      type: 'pet_speech',
      timestamp: new Date().toISOString(),
      payload: {
        text,
        duration,
      },
    };
    this.broadcast(msg);
  }

  emitStateUpdate(state: PetState): void {
    const msg: WsMessage = {
      type: 'pet_state_update',
      timestamp: new Date().toISOString(),
      payload: state,
    };
    this.broadcast(msg);
  }

  handleIncomingMessage(clientId: string, rawText: string): void {
    try {
      const msg: WsMessage = JSON.parse(rawText);
      const client = this.clients.get(clientId);

      switch (msg.type) {
        case 'identify':
          if (msg.payload?.client) {
            this.setClientType(clientId, msg.payload.client);
          }
          break;

        case 'pet_click': {
          try {
            const { state, message } = storage.interactPet();
            this.emitStateUpdate(state);
            this.emitPetAction('jump', {
              duration: 2.5,
              speech: message,
            });
          } catch (err) {
            console.error('[WebSocketHub] 点击桌宠互动持久化失败:', err);
          }
          break;
        }

        case 'set_lunch_time': {
          if (msg.payload) {
            const updates: any = {};
            if (typeof msg.payload.time === 'string') updates.lunchTime = msg.payload.time;
            if (typeof msg.payload.enabled === 'boolean') updates.lunchReminderEnabled = msg.payload.enabled;
            if (typeof msg.payload.advanceMinutes === 'number' && msg.payload.advanceMinutes > 0) {
              updates.lunchAdvanceMinutes = Math.round(msg.payload.advanceMinutes);
            }
            storage.saveConfig(updates);
            console.log(
              `[WebSocketHub] 午休时间配置已更新: ${updates.lunchTime || '未变'}, 提前: ${
                updates.lunchAdvanceMinutes ? updates.lunchAdvanceMinutes + '分钟' : '未变'
              }, 开启: ${updates.lunchReminderEnabled}`
            );
          }
          break;
        }

        case 'ping':
          if (client) {
            this.sendToClient(client, {
              type: 'pong',
              timestamp: new Date().toISOString(),
            });
          }
          break;

        default:
          console.log(`[WebSocketHub] Received unhandled message type: ${msg.type}`);
          break;
      }
    } catch (err) {
      console.warn(`[WebSocketHub] Failed to parse message from ${clientId}:`, err);
    }
  }
}

export const wsHub = new WebSocketHub();
