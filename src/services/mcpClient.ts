import { MCPResponse, MCPToolSchema } from '../types/mcp';
import { OFFICIAL_TOOLS, TOOL_MAP } from './toolRegistry';

export interface ExecuteResult {
  toolName: string;
  args: Record<string, any>;
  result: any;
  durationMs: number;
  timestamp: string;
  error?: string;
}

class MCPClientService {
  private mcpUrl: string = '/mcp';
  private sessionId: string | null = null;
  private serverTools: MCPToolSchema[] = [];

  getSessionId(): string | null {
    return this.sessionId;
  }

  resetSession(): void {
    this.sessionId = null;
  }

  getServerTools(): MCPToolSchema[] {
    return this.serverTools;
  }

  /**
   * 基础 JSON-RPC 2.0 请求
   */
  async callMCP<T = any>(token: string, method: string, params?: any): Promise<MCPResponse<T>> {
    if (!token || !token.trim()) {
      throw new Error('未提供 MCP Token，请在顶部设置您的 Token');
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token.trim()}`,
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
        id: Date.now(),
        method,
        params,
      }),
    });

    const newSessionId = resp.headers.get('Mcp-Session-Id');
    if (newSessionId) {
      this.sessionId = newSessionId;
    }

    if (resp.status === 401) {
      this.resetSession();
      throw new Error('MCP Token 无效或已失效 (401)，请检查并在官方控制台重新获取');
    }

    if (resp.status === 429) {
      throw new Error('触发麦当劳 MCP 限流 (429，每分钟超过600次请求)，请稍后再试');
    }

    if (!resp.ok && resp.status >= 500) {
      const errText = await resp.text().catch(() => '');
      throw new Error(`服务器错误 (${resp.status}): ${errText || resp.statusText}`);
    }

    const contentType = resp.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await resp.text();
      throw new Error(`非预期返回格式: ${text.slice(0, 200)}`);
    }

    return resp.json();
  }

  /**
   * 初始化连接 MCP 会话
   */
  async initialize(token: string): Promise<any> {
    const initResp = await this.callMCP(token, 'initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: {
          listChanged: true,
        },
      },
      clientInfo: {
        name: 'mcd-mcp-webui',
        version: '1.0.9',
      },
    });

    if (initResp.error) {
      throw new Error(`初始化失败: ${initResp.error.message}`);
    }

    return initResp.result;
  }

  /**
   * 从服务端动态获取支持的 Tool 列表
   */
  async listTools(token: string): Promise<MCPToolSchema[]> {
    if (!this.sessionId) {
      await this.initialize(token);
    }

    try {
      const resp = await this.callMCP<{ tools: MCPToolSchema[] }>(token, 'tools/list', {});
      if (resp.result?.tools) {
        this.serverTools = resp.result.tools;
        return resp.result.tools;
      }
      return [];
    } catch (err: any) {
      console.warn('获取 tools/list 失败，使用内置官方定义:', err);
      return [];
    }
  }

  /**
   * 规范化 Tool 名称，兼容别名
   */
  normalizeToolName(toolName: string): string {
    if (toolName === 'campaign-calender') return 'campaign-calendar';
    if (toolName === 'my-coupons') return 'query-my-coupons';
    return toolName;
  }

  /**
   * 执行指定 Tool 并计时记录
   */
  async executeTool(
    token: string,
    toolName: string,
    args: Record<string, any> = {}
  ): Promise<ExecuteResult> {
    const actualToolName = this.normalizeToolName(toolName);
    const startTime = performance.now();

    // 过滤未赋值的空字段
    const cleanArgs: Record<string, any> = {};
    Object.entries(args).forEach(([k, v]) => {
      if (v !== undefined && v !== '' && v !== null) {
        cleanArgs[k] = v;
      }
    });

    try {
      if (!this.sessionId) {
        await this.initialize(token);
      }

      const resp = await this.callMCP(token, 'tools/call', {
        name: actualToolName,
        arguments: cleanArgs,
      });

      const durationMs = Math.round(performance.now() - startTime);

      if (resp.error) {
        throw new Error(resp.error.message || 'MCP 执行返回未知错误');
      }

      return {
        toolName: actualToolName,
        args: cleanArgs,
        result: resp.result,
        durationMs,
        timestamp: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
      };
    } catch (err: any) {
      this.resetSession();
      const durationMs = Math.round(performance.now() - startTime);
      throw {
        message: err.message || '调用工具异常',
        toolName: actualToolName,
        args: cleanArgs,
        durationMs,
        timestamp: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
      };
    }
  }

  // ================= 快捷专属 API 封装 ================= //

  // 1. 营养信息
  async getNutritionFoods(token: string, keyword?: string) {
    return this.executeTool(token, 'list-nutrition-foods', keyword ? { keyword } : {});
  }

  // 2. 日历与时间
  async getCalendar(token: string, month?: string) {
    return this.executeTool(token, 'campaign-calendar', month ? { month } : {});
  }

  async getNowTimeInfo(token: string) {
    return this.executeTool(token, 'now-time-info', {});
  }

  // 3. 优惠券
  async getAvailableCoupons(token: string) {
    return this.executeTool(token, 'available-coupons', {});
  }

  async autoBindCoupons(token: string) {
    return this.executeTool(token, 'auto-bind-coupons', {});
  }

  async getMyCoupons(token: string) {
    return this.executeTool(token, 'query-my-coupons', {});
  }

  async getStoreCoupons(token: string, storeId: string, orderType: string = '1') {
    return this.executeTool(token, 'query-store-coupons', { storeId, orderType });
  }

  // 4. 点餐、外送与门店
  async getDeliveryAddresses(token: string) {
    return this.executeTool(token, 'delivery-query-addresses', {});
  }

  async createDeliveryAddress(
    token: string,
    params: { address: string; name: string; phone: string; detail?: string }
  ) {
    return this.executeTool(token, 'delivery-create-address', params);
  }

  async getNearbyStores(
    token: string,
    params: { address?: string; keyword?: string; latitude?: number; longitude?: number }
  ) {
    return this.executeTool(token, 'query-nearby-stores', params);
  }

  async getMeals(token: string, storeId: string, orderType: string = '1') {
    return this.executeTool(token, 'query-meals', { storeId, orderType });
  }

  async getMealDetail(token: string, storeId: string, productCode: string) {
    return this.executeTool(token, 'query-meal-detail', { storeId, productCode });
  }

  async calculatePrice(
    token: string,
    params: { storeId: string; orderType?: string; products: any[]; couponId?: string }
  ) {
    return this.executeTool(token, 'calculate-price', params);
  }

  async createOrder(
    token: string,
    params: { storeId: string; orderType: string; products: any[]; remark?: string; tableNo?: string }
  ) {
    return this.executeTool(token, 'create-order', params);
  }

  async cancelOrder(token: string, orderId: string, reason?: string) {
    return this.executeTool(token, 'cancel-order', { orderId, reason });
  }

  async queryOrder(token: string, orderId: string) {
    return this.executeTool(token, 'query-order', { orderId });
  }

  async getOrderList(token: string, page: number = 1, pageSize: number = 10) {
    return this.executeTool(token, 'order-list', { page, pageSize });
  }

  // 5. 积分与商城
  async getMyAccount(token: string) {
    return this.executeTool(token, 'query-my-account', {});
  }

  async getMallProducts(token: string, category?: string, page: number = 1) {
    return this.executeTool(token, 'mall-points-products', { category, page });
  }

  async getMallProductDetail(token: string, productId: string) {
    return this.executeTool(token, 'mall-product-detail', { productId });
  }

  async createMallOrder(token: string, productId: string, count: number = 1, addressId?: string) {
    return this.executeTool(token, 'mall-create-order', { productId, count, addressId });
  }

  async getMallOrderList(token: string, page: number = 1, pageSize: number = 10) {
    return this.executeTool(token, 'mall-order-list', { page, pageSize });
  }

  async getMallOrderDetail(token: string, orderId: string) {
    return this.executeTool(token, 'mall-order-detail', { orderId });
  }

  // 6. 积分抽奖
  async getLotteryInfo(token: string, activityId?: string) {
    return this.executeTool(token, 'query-lottery-info', activityId ? { activityId } : {});
  }

  async drawLottery(token: string, activityId?: string) {
    return this.executeTool(token, 'draw-lottery', activityId ? { activityId } : {});
  }

  async getMyPrizes(token: string, page: number = 1, pageSize: number = 10) {
    return this.executeTool(token, 'query-my-prizes', { page, pageSize });
  }

  // 7. 主题派对
  async getPartyCities(token: string, productId?: string) {
    return this.executeTool(token, 'query-party-city', productId ? { productId } : {});
  }

  async getPartyStores(token: string, params: { cityId?: string; cityName?: string }) {
    return this.executeTool(token, 'query-party-store', params);
  }

  async getPartyStoreDates(token: string, storeId: string, productId?: string) {
    return this.executeTool(token, 'query-partystore-date', { storeId, productId });
  }

  async getPartyStoreSessions(token: string, storeId: string, date: string) {
    return this.executeTool(token, 'query-partystore-session', { storeId, date });
  }

  async createPartyOrder(
    token: string,
    params: {
      storeId: string;
      date: string;
      sessionId: string;
      contactName: string;
      phone: string;
      childrenCount?: number;
    }
  ) {
    return this.executeTool(token, 'party-order-create', params);
  }
}

export const mcpClient = new MCPClientService();
export { OFFICIAL_TOOLS, TOOL_MAP };
