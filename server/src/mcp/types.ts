export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: any;
}

export interface JsonRpcResponse<T = any> {
  jsonrpc: '2.0';
  id: string | number;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export interface ToolParameterProperty {
  type: string;
  description?: string;
  enum?: string[];
  default?: any;
}

export interface ToolInputSchema {
  type: string;
  properties?: Record<string, ToolParameterProperty>;
  required?: string[];
}

export interface MCPToolSchema {
  name: string;
  description: string;
  inputSchema?: ToolInputSchema;
  category?: string;
}

export interface ExecuteResult {
  toolName: string;
  args: Record<string, any>;
  result: any;
  durationMs: number;
  timestamp: string;
}
