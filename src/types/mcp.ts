export type ConnectionStatus = 'disconnected' | 'connected' | 'connecting';

export type ToolType =
  | 'now-time-info'
  | 'campaign-calender'
  | 'available-coupons'
  | 'my-coupons'
  | 'auto-bind-coupons';

export interface MCPResponse<T = any> {
  jsonrpc: string;
  id: number;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
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
