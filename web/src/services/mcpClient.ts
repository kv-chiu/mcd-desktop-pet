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

  /**
   * 初始化连接 MCP 会话（通过 Server 中枢网关握手）
   */
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

  /**
   * 从服务端动态获取支持的 Tool 列表
   */
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

  /**
   * 规范化 Tool 名称，兼容历史别名
   */
  normalizeToolName(toolName: string): string {
    return normalizeToolName(toolName);
  }

  /**
   * 执行指定 Tool 并计时记录（通过 Server 中枢网关，自动联动桌宠）
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
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token && token.trim()) {
        headers['Authorization'] = `Bearer ${token.trim()}`;
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
        errObj.result = body.details || null;
        throw errObj;
      }

      const resultData: ExecuteResult = body.data || {
        toolName: actualToolName,
        args: cleanArgs,
        result: body.data,
        durationMs: Math.round(performance.now() - startTime),
        timestamp: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
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
