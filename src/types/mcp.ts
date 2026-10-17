export type ConnectionStatus = 'disconnected' | 'connected' | 'connecting';

export type ToolCategory =
  | 'all'
  | 'coupons'
  | 'order'
  | 'nutrition'
  | 'mall'
  | 'lottery'
  | 'party'
  | 'daily';

export type OfficialToolId =
  | 'list-nutrition-foods'
  | 'delivery-query-addresses'
  | 'delivery-create-address'
  | 'delivery-query-stores'
  | 'query-meal-assistance'
  | 'query-nearby-stores'
  | 'query-store-coupons'
  | 'query-meals'
  | 'query-meal-detail'
  | 'calculate-price'
  | 'create-order'
  | 'cancel-order'
  | 'query-order'
  | 'order-list'
  | 'campaign-calendar'
  | 'available-coupons'
  | 'auto-bind-coupons'
  | 'query-my-coupons'
  | 'query-my-account'
  | 'mall-points-products'
  | 'mall-product-detail'
  | 'mall-create-order'
  | 'now-time-info'
  | 'query-lottery-info'
  | 'draw-lottery'
  | 'query-my-prizes'
  | 'mall-order-list'
  | 'mall-order-detail'
  | 'query-party-city'
  | 'query-party-store'
  | 'query-partystore-date'
  | 'query-partystore-session'
  | 'party-order-create';

// Backwards compatibility aliases
export type ToolType = OfficialToolId | 'campaign-calender' | 'my-coupons';

export interface ToolParamDef {
  name: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'json';
  required?: boolean;
  defaultValue?: any;
  placeholder?: string;
  description?: string;
  options?: Array<{ label: string; value: string | number }>;
}

export interface ToolMetadata {
  id: OfficialToolId;
  name: string;
  nameEn: string;
  description: string;
  descriptionEn: string;
  category: ToolCategory;
  categoryZh: string;
  icon: string;
  params: ToolParamDef[];
  exampleArgs?: Record<string, any>;
}

export interface MCPResponse<T = any> {
  jsonrpc: string;
  id: number | string;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export interface MCPToolSchema {
  name: string;
  description?: string;
  inputSchema?: {
    type?: string;
    properties?: Record<string, any>;
    required?: string[];
  };
}

export interface MCPListToolsResult {
  tools: MCPToolSchema[];
}

export interface ActivityItem {
  title: string;
  content: string;
  img: string;
}

export interface AvailableCouponItem {
  title: string;
  status: string;
  img: string;
}

export interface MyCouponItem {
  title: string;
  price: string;
  validity: string;
  tags: string[];
  img: string;
}

export interface BindResultData {
  success: string;
  fail: string;
  isAllSuccess: boolean;
  coupons: Array<{
    title: string;
    code: string;
    img: string;
  }>;
}

export interface TimeData {
  formatted?: string;
  date?: string;
  dayOfWeek?: string;
  timezone?: string;
  utc?: string;
}

export interface NutritionItem {
  name: string;
  energyKcal?: string;
  energyKj?: string;
  protein?: string;
  fat?: string;
  carbs?: string;
  sodium?: string;
  calcium?: string;
  servingSize?: string;
  rawText?: string;
}

export interface PointsAccountData {
  availablePoints?: string | number;
  totalPoints?: string | number;
  frozenPoints?: string | number;
  expiringPoints?: string | number;
  expireDate?: string;
  rawText?: string;
}

export interface LotteryInfoData {
  activityId?: string;
  title?: string;
  status?: string;
  costPoints?: number | string;
  remainingChances?: number | string;
  prizes?: Array<{
    name: string;
    img?: string;
    description?: string;
  }>;
  rawText?: string;
}

export interface OrderItem {
  orderId: string;
  orderType?: string;
  storeName?: string;
  status?: string;
  createTime?: string;
  totalAmount?: string;
  productsSummary?: string;
  payLink?: string;
  pickupCode?: string;
  rawText?: string;
}

export interface MallProductItem {
  productId: string;
  name: string;
  pointsCost: string | number;
  cashCost?: string | number;
  img?: string;
  validity?: string;
  description?: string;
}
