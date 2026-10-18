export interface ServerProcessInfo {
  pid: number;
  port: number;
  startTime: string;
  entryScript: string;
}

export interface HealthResponse {
  status: string;
  uptimeSeconds: number;
  timestamp: string;
  websocket: {
    total: number;
    desktop: number;
    web: number;
    other: number;
  };
  mcp: {
    hasToken: boolean;
    hasActiveSession: boolean;
    sessionId?: string | null;
  };
}

export interface CliResult<T = unknown> {
  success: boolean;
  command: string;
  message: string;
  data?: T;
  error?: string;
}

export interface StartOptions {
  port?: string | number;
  foreground?: boolean;
  json?: boolean;
  silent?: boolean;
}

export interface StopOptions {
  force?: boolean;
  timeout?: string | number;
  json?: boolean;
  silent?: boolean;
}

export interface RestartOptions {
  port?: string | number;
  force?: boolean;
  timeout?: string | number;
  json?: boolean;
  silent?: boolean;
}

export interface StatusOptions {
  port?: string | number;
  json?: boolean;
  silent?: boolean;
}

export interface LogsOptions {
  lines?: string | number;
  follow?: boolean;
}
