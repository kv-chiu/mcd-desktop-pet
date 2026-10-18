import { storage } from '../storage/index.js';
import {
  JsonRpcRequest,
  JsonRpcResponse,
  MCPToolSchema,
  ExecuteResult,
  CallToolResult,
  evaluateToolLayers,
} from './types.js';
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
      const err: any = new Error('MCP Token 无效或已过期 (401)，请在官方控制台重新获取并配置');
      err.status = 401;
      throw err;
    }

    if (resp.status === 429) {
      const err: any = new Error('触发麦当劳官方 MCP 限流保护 (429，超过 600 次/分钟)，请稍后重试');
      err.status = 429;
      throw err;
    }

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      let errMsg = errText.trim() || resp.statusText;
      try {
        const parsed = JSON.parse(errText);
        if (parsed?.error?.message) {
          errMsg = parsed.error.message;
        } else if (parsed?.message) {
          errMsg = parsed.message;
        }
      } catch {
        // fallback to errText
      }
      const err: any = new Error(
        resp.status >= 500
          ? `麦当劳 MCP 服务器错误 (${resp.status}): ${errMsg || resp.statusText}`
          : `麦当劳 MCP 请求错误 (${resp.status}): ${errMsg || resp.statusText}`
      );
      err.status = resp.status;
      throw err;
    }

    const contentType = resp.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await resp.text();
      const err: any = new Error(`MCP 返回非 JSON 格式响应: ${text.slice(0, 200)}`);
      err.status = resp.status;
      throw err;
    }

    const data = (await resp.json()) as JsonRpcResponse<T>;
    if (data && typeof data === 'object') {
      (data as any).httpStatus = resp.status;
    }
    return data;
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

  private mockHandler: ((toolName: string, args: Record<string, any>) => any) | null = null;

  setMockHandler(handler: ((toolName: string, args: Record<string, any>) => any) | null): void {
    this.mockHandler = handler;
  }

  getMockResponse(toolName: string, scenario: string): JsonRpcResponse<CallToolResult> {
    switch (scenario) {
      case 'coupon-tool-error':
        // 模拟工具返回 result.isError: true、文本“优惠券领取失败”
        return {
          jsonrpc: '2.0',
          id: Date.now(),
          result: {
            content: [{ type: 'text', text: '优惠券领取失败' }],
            isError: true,
          },
        };

      case 'coupon-partial':
        // 模拟业务部分成功: 成功 2 张，失败 1 张
        return {
          jsonrpc: '2.0',
          id: Date.now(),
          result: {
            content: [
              {
                type: 'text',
                text: '自动领券完成，成功: 2，失败: 1\n**麦麦省半价巨无霸券**\ncouponCode: MCD101\n<img src="https://img.mcd.cn/c1.png"/>\n**麦麦省脆汁鸡套餐券**\ncouponCode: MCD102\n<img src="https://img.mcd.cn/c2.png"/>',
              },
            ],
            isError: false,
          },
        };

      case 'coupon-full-success':
        // 模拟业务完全成功: 成功 3 张，失败 0 张
        return {
          jsonrpc: '2.0',
          id: Date.now(),
          result: {
            content: [
              {
                type: 'text',
                text: '自动领券完成，成功: 3，失败: 0\n**麦麦省半价巨无霸券**\ncouponCode: MCD101\n<img src="https://img.mcd.cn/c1.png"/>\n**麦麦省麦辣鸡翅券**\ncouponCode: MCD102\n<img src="https://img.mcd.cn/c2.png"/>\n**麦麦省新地买一赠一券**\ncouponCode: MCD103\n<img src="https://img.mcd.cn/c3.png"/>',
              },
            ],
            isError: false,
          },
        };

      case 'coupon-biz-failure':
        // 模拟业务全部失败: 成功 0 张，失败 2 张
        return {
          jsonrpc: '2.0',
          id: Date.now(),
          result: {
            content: [
              {
                type: 'text',
                text: '自动领券结果：成功: 0，失败: 2\n当前暂无可领取的优惠券或已达领取上限',
              },
            ],
            isError: false,
          },
        };

      case 'order-tool-error':
        return {
          jsonrpc: '2.0',
          id: Date.now(),
          result: {
            content: [{ type: 'text', text: '订单创建失败：所选门店已打烊' }],
            isError: true,
          },
        };

      default:
        throw new Error(`未知的模拟场景: ${scenario}`);
    }
  }

  /**
   * 调用执行工具
   */
  async executeTool(
    toolName: string,
    args: Record<string, any> = {},
    overrideToken?: string,
    options?: { mockScenario?: string }
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
      let resp: JsonRpcResponse<CallToolResult>;

      if (this.mockHandler) {
        resp = await this.mockHandler(actualToolName, cleanArgs);
      } else if (options?.mockScenario) {
        if (options.mockScenario === 'transport-error') {
          throw new Error('网络连接超时或目标主机不可达 (模拟传输层失败)');
        }
        if (options.mockScenario === 'http-400-empty') {
          const err: any = new Error('麦当劳 MCP 请求错误 (400): Bad Request');
          err.status = 400;
          throw err;
        }
        if (options.mockScenario === 'http-404-empty') {
          const err: any = new Error('麦当劳 MCP 请求错误 (404): Not Found');
          err.status = 404;
          throw err;
        }
        if (options.mockScenario === 'rpc-empty-body') {
          resp = {} as any;
        } else if (options.mockScenario === 'login-required') {
          resp = {
            jsonrpc: '2.0',
            id: Date.now(),
            result: {
              content: [{ type: 'text', text: '{"success":false,"message":"请先登录"}' }],
              isError: false,
            },
          };
        } else if (options.mockScenario === 'unknown-unconfirmed') {
          resp = {
            jsonrpc: '2.0',
            id: Date.now(),
            result: {
              content: [{ type: 'text', text: '已收到业务请求，等待系统调度处理' }],
              isError: false,
            },
          };
        } else if (options.mockScenario === 'rpc-error') {
          resp = {
            jsonrpc: '2.0',
            id: Date.now(),
            error: {
              code: -32603,
              message: 'MCP JSON-RPC Internal Error (模拟协议错误)',
            },
          };
        } else {
          resp = this.getMockResponse(actualToolName, options.mockScenario);
        }
      } else {
        if (!this.sessionId) {
          await this.initialize(overrideToken);
        }

        resp = await this.callRpc(
          'tools/call',
          {
            name: actualToolName,
            arguments: cleanArgs,
          },
          overrideToken
        );
      }

      const durationMs = Math.round(performance.now() - startTime);

      const httpStatus = typeof (resp as any)?.httpStatus === 'number' ? (resp as any).httpStatus : 200;

      // 进行四层状态评估（传输层、RPC 层、工具层、业务层）
      const evaluation = evaluateToolLayers({
        toolName: actualToolName,
        args: cleanArgs,
        rpcResponse: resp,
        httpStatus,
      });

      // JSON-RPC 协议级错误或结构异常
      if (!evaluation.rpc.success || resp?.error) {
        const rpcErr: any = new Error(
          resp?.error?.message || evaluation.rpc.error?.message || 'MCP 执行返回未知协议错误'
        );
        rpcErr.toolName = actualToolName;
        rpcErr.args = cleanArgs;
        rpcErr.durationMs = durationMs;
        rpcErr.layers = {
          transport: evaluation.transport,
          rpc: evaluation.rpc,
          tool: evaluation.tool,
          business: evaluation.business,
        };
        throw rpcErr;
      }

      const isError = evaluation.tool.isError || evaluation.business.outcome === 'failure';
      const errorMsg =
        evaluation.tool.error ||
        (evaluation.business.outcome === 'failure' || evaluation.business.outcome === 'unknown'
          ? evaluation.business.summary
          : undefined);

      const result: ExecuteResult = {
        toolName: actualToolName,
        args: cleanArgs,
        result: resp.result,
        durationMs,
        timestamp: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
        isError,
        error: isError ? errorMsg : undefined,
        layers: {
          transport: evaluation.transport,
          rpc: evaluation.rpc,
          tool: evaluation.tool,
          business: evaluation.business,
        },
        business: evaluation.business,
        petFeedback: evaluation.petFeedback,
      };

      try {
        storage.recordHistory({
          type: 'tool_call',
          summary: `执行工具: ${actualToolName} [${evaluation.business.outcome}]`,
          details: { args: cleanArgs, durationMs, outcome: evaluation.business.outcome, isError },
        });
      } catch (historyErr) {
        console.error('[McpGateway] 写入工具调用历史失败:', historyErr);
      }

      return result;
    } catch (err: any) {
      if (!options?.mockScenario && !this.mockHandler) {
        this.resetSession();
      }
      const durationMs = Math.round(performance.now() - startTime);

      const httpStatus = typeof err.status === 'number' ? err.status : 500;
      const evaluation =
        err.layers ||
        evaluateToolLayers({
          toolName: actualToolName,
          args: cleanArgs,
          httpStatus,
          transportError: err.message || '调用 MCP 工具异常',
        });

      throw {
        message: err.message || '调用 MCP 工具异常',
        toolName: actualToolName,
        args: cleanArgs,
        durationMs,
        timestamp: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
        layers: evaluation,
      };
    }
  }
}

export const mcpGateway = new McpGatewayClient();
