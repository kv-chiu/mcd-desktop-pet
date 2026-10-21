import { PetActionType } from './protocol.js';

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

export interface ToolParameterProperty {
  type: string;
  description?: string;
  enum?: string[];
  default?: any;
}

export interface ToolInputSchema {
  type: string;
  properties?: Record<string, ToolParameterProperty | any>;
  required?: string[];
}

export interface MCPToolSchema {
  name: string;
  description?: string;
  inputSchema?: ToolInputSchema;
  category?: string;
}

export interface ToolMetadata {
  id: OfficialToolId;
  name: string;
  nameZh?: string;
  nameEn: string;
  description: string;
  descriptionEn?: string;
  category: ToolCategory;
  categoryZh: string;
  icon: string;
  params: ToolParamDef[];
  exampleArgs?: Record<string, any>;
  inputSchema?: ToolInputSchema;
  aliases?: string[];
}

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: any;
}

export interface JsonRpcResponse<T = any> {
  jsonrpc: string | '2.0';
  id: string | number;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export type MCPResponse<T = any> = JsonRpcResponse<T>;

export interface MCPListToolsResult {
  tools: MCPToolSchema[];
}

export interface CallToolContent {
  type: string;
  text?: string;
  data?: string;
  mimeType?: string;
  [key: string]: any;
}

export interface CallToolResult {
  content: CallToolContent[];
  isError?: boolean;
  [key: string]: unknown;
}

export interface TransportStatus {
  success: boolean;
  status: number;
  statusText?: string;
  endpoint?: string;
  error?: string;
}

export interface JsonRpcStatus {
  success: boolean;
  id?: string | number;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export interface ToolExecutionStatus {
  success: boolean;
  isError: boolean;
  toolName: string;
  content?: CallToolContent[];
  rawText?: string;
  error?: string;
}

export type BusinessOutcome = 'full_success' | 'partial_success' | 'failure' | 'neutral' | 'unknown';

export interface BusinessStatus {
  outcome: BusinessOutcome;
  summary: string;
  detail?: string;
  successCount?: number;
  failCount?: number;
  totalCount?: number;
  data?: any;
}

export interface ExecutionLayers {
  transport: TransportStatus;
  rpc: JsonRpcStatus;
  tool: ToolExecutionStatus;
  business: BusinessStatus;
}

export interface PetFeedbackAdvice {
  shouldFeedback: boolean;
  action: PetActionType;
  duration: number;
  speech: string;
  sound?: string;
}

export interface ExecuteResult {
  toolName: string;
  args: Record<string, any>;
  result: any;
  durationMs: number;
  timestamp: string;
  isError?: boolean;
  error?: string;
  layers?: ExecutionLayers;
  business?: BusinessStatus;
  petFeedback?: PetFeedbackAdvice;
}

export interface CategoryInfo {
  key: ToolCategory;
  nameZh: string;
  nameEn: string;
  icon: string;
  description: string;
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
