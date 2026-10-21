import {
  ExecuteResult,
  MCPToolSchema,
  OFFICIAL_TOOLS,
  TOOL_MAP,
  normalizeToolName,
} from '@mcd/shared';

export type { ExecuteResult };

class MCPClientService {
  private apiBase: string = '/api/tools';
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

  async initialize(token: string): Promise<any> {
    if (!token || !token.trim()) {
      throw new Error('未提供 MCP Token，请在顶部设置您的 Token');
    }

    try {
      const resp = await fetch(`${this.apiBase}/initialize`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token.trim()}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await resp.json().catch(() => ({}));

      if (!resp.ok || !data.success) {
        throw new Error(data.error || `连接 MCP 服务失败 (${resp.status})`);
      }

      this.sessionId = data.sessionId || `session_${Date.now()}`;
      return data.data;
    } catch (err: any) {
      this.resetSession();
      if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
        throw new Error('无法连接到桌宠中枢服务 (localhost:3001)，请确认后端服务已启动');
      }
      throw err;
    }
  }

  async listTools(token: string): Promise<MCPToolSchema[]> {
    try {
      const headers: Record<string, string> = {};
      if (token && token.trim()) {
        headers['Authorization'] = `Bearer ${token.trim()}`;
      }

      const resp = await fetch(this.apiBase, { headers });
      const data = await resp.json().catch(() => ({}));

      if (data.success && Array.isArray(data.data)) {
        this.serverTools = data.data;
        return data.data;
      }
      return OFFICIAL_TOOLS.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
        category: t.category,
      }));
    } catch (err) {
      console.warn('获取 tools 列表失败，降级使用内置官方定义:', err);
      return OFFICIAL_TOOLS.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
        category: t.category,
      }));
    }
  }

  normalizeToolName(toolName: string): string {
    return normalizeToolName(toolName);
  }

  async executeTool(
    token: string,
    toolName: string,
    args: Record<string, any> = {},
    options?: { mockScenario?: string }
  ): Promise<ExecuteResult> {
    const actualToolName = this.normalizeToolName(toolName);
    const startTime = performance.now();

    const cleanArgs: Record<string, any> = {};
    Object.entries(args).forEach(([k, v]) => {
      if (v !== undefined && v !== '' && v !== null) {
        cleanArgs[k] = v;
      }
    });

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token && token.trim()) {
        headers['Authorization'] = `Bearer ${token.trim()}`;
      }
      if (options?.mockScenario) {
        headers['x-mock-scenario'] = options.mockScenario;
      }

      const resp = await fetch(`${this.apiBase}/${actualToolName}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(cleanArgs),
      });

      const body = await resp.json().catch(() => ({}));

      if (!resp.ok || !body.success) {
        const errorMsg = body.error || `执行工具失败 (${resp.status})`;
        const durationMs = Math.round(performance.now() - startTime);
        const errObj: any = new Error(errorMsg);
        errObj.toolName = actualToolName;
        errObj.args = cleanArgs;
        errObj.durationMs = durationMs;
        errObj.timestamp = new Date().toLocaleTimeString('zh-CN', { hour12: false });
        errObj.result = body.data?.result || body.details || body.data || null;
        errObj.layers = body.layers || null;
        errObj.isError = body.layers?.tool?.isError ?? true;
        throw errObj;
      }

      const resultData: ExecuteResult = body.data || {
        toolName: actualToolName,
        args: cleanArgs,
        result: body.data,
        durationMs: Math.round(performance.now() - startTime),
        timestamp: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
        layers: body.layers,
      };

      if (!this.sessionId) {
        this.sessionId = `session_${Date.now()}`;
      }

      return resultData;
    } catch (err: any) {
      if (err.toolName) {
        throw err;
      }
      const durationMs = Math.round(performance.now() - startTime);
      const isConnError =
        err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError');
      const message = isConnError
        ? '无法连接到桌宠中枢服务 (localhost:3001)，请确认后端服务已启动'
        : err.message || '调用工具异常';

      throw {
        message,
        toolName: actualToolName,
        args: cleanArgs,
        durationMs,
        timestamp: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
      };
    }
  }


  async getNutritionFoods(token: string, keyword?: string) {
    return this.executeTool(token, 'list-nutrition-foods', keyword ? { keyword } : {});
  }

  async getCalendar(token: string, month?: string) {
    return this.executeTool(token, 'campaign-calendar', month ? { month } : {});
  }

  async getNowTimeInfo(token: string) {
    return this.executeTool(token, 'now-time-info', {});
  }

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

  async getLotteryInfo(token: string, activityId?: string) {
    return this.executeTool(token, 'query-lottery-info', activityId ? { activityId } : {});
  }

  async drawLottery(token: string, activityId?: string) {
    return this.executeTool(token, 'draw-lottery', activityId ? { activityId } : {});
  }

  async getMyPrizes(token: string, page: number = 1, pageSize: number = 10) {
    return this.executeTool(token, 'query-my-prizes', { page, pageSize });
  }

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
