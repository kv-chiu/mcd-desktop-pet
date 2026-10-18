import { WSContext } from 'hono/ws';
import { storage, PetState, PetActionType } from '../storage/index.js';

export type WsClientType = 'desktop' | 'web' | 'cli' | 'skill';

export interface ConnectedClient {
  id: string;
  type: WsClientType;
  ws: WSContext;
  connectedAt: string;
}

export interface WsMessage<T = any> {
  type:
    | 'identify'
    | 'pet_action'
    | 'pet_speech'
    | 'pet_state_update'
    | 'pet_click'
    | 'system_notice'
    | 'ping'
    | 'pong';
  timestamp: string;
  payload?: T;
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

    // Send current pet state upon connection
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

  /**
   * 触发桌宠执行动作（向 desktop 广播）
   */
  emitPetAction(
    action: PetActionType,
    options?: { duration?: number; speech?: string; sound?: string }
  ): void {
    // 更新持久化状态
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

  /**
   * 触发桌宠对话气泡
   */
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

  /**
   * 广播状态变更
   */
  emitStateUpdate(state: PetState): void {
    const msg: WsMessage = {
      type: 'pet_state_update',
      timestamp: new Date().toISOString(),
      payload: state,
    };
    this.broadcast(msg);
  }

  /**
   * 处理客户端上行消息
   */
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
          // 用户点击了桌宠
          const { state, message } = storage.interactPet();
          this.emitStateUpdate(state);
          this.emitPetAction('jump', {
            duration: 2.5,
            speech: message,
          });
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
