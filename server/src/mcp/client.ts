import { storage } from '../storage/index.js';
import { JsonRpcRequest, JsonRpcResponse, MCPToolSchema, ExecuteResult } from './types.js';
import { OFFICIAL_TOOLS, normalizeToolName } from './tools.js';

export class McpGatewayClient {
  private sessionId: string | null = null;
  private serverTools: MCPToolSchema[] = [];

  constructor() {}

  getSessionId(): string | null {
    return this.sessionId;
  }

  resetSession(): void {
    this.sessionId = null;
  }

  getServerTools(): MCPToolSchema[] {
    return this.serverTools;
  }

  private getEffectiveToken(overrideToken?: string): string {
    const token = (overrideToken || storage.getConfig().token || '').trim();
    if (!token) {
      throw new Error('未配置麦当劳 MCP Token。请在配置中设置 Token 或在请求头提供 Bearer Token。');
    }
    return token;
  }

  private getEndpoint(): string {
    return storage.getConfig().mcpEndpoint || 'https://mcp.mcd.cn/mcp-servers/mcd-mcp';
  }

  /**
   * 基础 JSON-RPC 2.0 请求
   */
  async callRpc<T = any>(
    method: string,
    params?: any,
    overrideToken?: string
  ): Promise<JsonRpcResponse<T>> {
    const token = this.getEffectiveToken(overrideToken);
    const endpoint = this.getEndpoint();

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    if (this.sessionId) {
      headers['Mcp-Session-Id'] = this.sessionId;
    }

    const payload: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params,
    };

    let resp: Response;
    try {
      resp = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
    } catch (networkErr: any) {
      throw new Error(`MCP 终端网络连接失败 (${endpoint}): ${networkErr?.message || networkErr}`);
    }

    // 捕获与更新 Session ID
    const newSessionId = resp.headers.get('Mcp-Session-Id') || resp.headers.get('mcp-session-id');
    if (newSessionId) {
      this.sessionId = newSessionId;
    }

    if (resp.status === 401) {
      this.resetSession();
      throw new Error('MCP Token 无效或已过期 (401)，请在官方控制台重新获取并配置');
    }

    if (resp.status === 429) {
      throw new Error('触发麦当劳官方 MCP 限流保护 (429，超过 600 次/分钟)，请稍后重试');
    }

    if (!resp.ok && resp.status >= 500) {
      const errText = await resp.text().catch(() => '');
      throw new Error(`麦当劳 MCP 服务器错误 (${resp.status}): ${errText || resp.statusText}`);
    }

    const contentType = resp.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await resp.text();
      throw new Error(`MCP 返回非 JSON 格式响应: ${text.slice(0, 200)}`);
    }

    return resp.json() as Promise<JsonRpcResponse<T>>;
  }

  /**
   * 初始化连接 MCP 会话握手
   */
  async initialize(overrideToken?: string): Promise<any> {
    const initResp = await this.callRpc(
      'initialize',
      {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {
            listChanged: true,
          },
        },
        clientInfo: {
          name: 'mcd-desktop-pet-gateway',
          version: '1.0.0',
        },
      },
      overrideToken
    );

    if (initResp.error) {
      throw new Error(`MCP 初始化握手失败: ${initResp.error.message}`);
    }

    return initResp.result;
  }

  /**
   * 动态拉取服务端工具列表
   */
  async listTools(overrideToken?: string): Promise<MCPToolSchema[]> {
    if (!this.sessionId) {
      await this.initialize(overrideToken);
    }

    try {
      const resp = await this.callRpc<{ tools: MCPToolSchema[] }>('tools/list', {}, overrideToken);
      if (resp.result?.tools && resp.result.tools.length > 0) {
        this.serverTools = resp.result.tools;
        return resp.result.tools;
      }
    } catch (err: any) {
      console.warn('获取 tools/list 异常，降级使用内置 33 项官方工具定义:', err.message);
    }

    return OFFICIAL_TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
      category: t.category,
    }));
  }

  /**
   * 调用执行工具
   */
  async executeTool(
    toolName: string,
    args: Record<string, any> = {},
    overrideToken?: string
  ): Promise<ExecuteResult> {
    const actualToolName = normalizeToolName(toolName);
    const startTime = performance.now();

    // 过滤未赋值的字段
    const cleanArgs: Record<string, any> = {};
    for (const [k, v] of Object.entries(args)) {
      if (v !== undefined && v !== '' && v !== null) {
        cleanArgs[k] = v;
      }
    }

    try {
      if (!this.sessionId) {
        await this.initialize(overrideToken);
      }

      const resp = await this.callRpc(
        'tools/call',
        {
          name: actualToolName,
          arguments: cleanArgs,
        },
        overrideToken
      );

      const durationMs = Math.round(performance.now() - startTime);

      if (resp.error) {
        throw new Error(resp.error.message || 'MCP 执行返回未知错误');
      }

      const result: ExecuteResult = {
        toolName: actualToolName,
        args: cleanArgs,
        result: resp.result,
        durationMs,
        timestamp: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
      };

      storage.recordHistory({
        type: 'tool_call',
        summary: `执行工具: ${actualToolName}`,
        details: { args: cleanArgs, durationMs },
      });

      return result;
    } catch (err: any) {
      this.resetSession();
      const durationMs = Math.round(performance.now() - startTime);
      throw {
        message: err.message || '调用 MCP 工具异常',
        toolName: actualToolName,
        args: cleanArgs,
        durationMs,
        timestamp: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
      };
    }
  }
}

export const mcpGateway = new McpGatewayClient();
