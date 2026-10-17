import { MCPResponse } from '../types/mcp';

class MCPClientService {
  private mcpUrl: string = '/mcp';
  private sessionId: string | null = null;

  getSessionId(): string | null {
    return this.sessionId;
  }

  resetSession(): void {
    this.sessionId = null;
  }

  async callMCP<T = any>(token: string, method: string, params?: any): Promise<MCPResponse<T>> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    if (this.sessionId) {
      headers['Mcp-Session-Id'] = this.sessionId;
    }

    const resp = await fetch(this.mcpUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method,
        params,
      }),
    });

    const newSessionId = resp.headers.get('Mcp-Session-Id');
    if (newSessionId) {
      this.sessionId = newSessionId;
    }

    if (!resp.ok && resp.status >= 500) {
      const errText = await resp.text().catch(() => '');
      throw new Error(`服务器错误 (${resp.status}): ${errText || resp.statusText}`);
    }

    return resp.json();
  }

  async executeTool(token: string, toolName: string, args: Record<string, any> = {}): Promise<any> {
    try {
      if (!this.sessionId) {
        const initResp = await this.callMCP(token, 'initialize', {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          clientInfo: { name: 'mcd-web-client', version: '1.0.0' },
        });

        if (initResp.error) {
          throw new Error(initResp.error.message);
        }
      }

      const resp = await this.callMCP(token, 'tools/call', {
        name: toolName,
        arguments: args,
      });

      if (resp.error) {
        throw new Error(resp.error.message);
      }

      return resp.result;
    } catch (err: any) {
      this.resetSession();
      throw err;
    }
  }
}

export const mcpClient = new MCPClientService();
