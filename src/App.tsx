import React, { useState, useRef } from 'react';
import { Theme } from '@radix-ui/themes';
import { Header } from './components/Header';
import { QuickActions } from './components/QuickActions';
import { ToolExecutor } from './components/ToolExecutor';
import { ToolList } from './components/ToolList';
import { Visualizer } from './components/Visualizer';
import { OFFICIAL_TOOLS, TOOL_MAP } from './services/toolRegistry';
import { mcpClient, ExecuteResult } from './services/mcpClient';
import { ConnectionStatus, OfficialToolId, ToolMetadata } from './types/mcp';

export const App: React.FC = () => {
  const [token, setToken] = useState<string>(() => {
    return localStorage.getItem('mcd_mcp_token') || '';
  });

  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  // Active selected tool for execution
  const [selectedTool, setSelectedTool] = useState<ToolMetadata>(
    OFFICIAL_TOOLS.find((t) => t.id === 'campaign-calendar') || OFFICIAL_TOOLS[0]
  );
  const [initialArgs, setInitialArgs] = useState<Record<string, any> | undefined>(undefined);

  const [isExecuting, setIsExecuting] = useState(false);
  const [executeError, setExecuteError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<ExecuteResult | null>(null);

  const executorRef = useRef<HTMLDivElement>(null);
  const visualizerRef = useRef<HTMLDivElement>(null);

  // Save token to localStorage whenever it changes
  const handleTokenChange = (newToken: string) => {
    setToken(newToken);
    localStorage.setItem('mcd_mcp_token', newToken);
    if (!newToken.trim()) {
      setStatus('disconnected');
      mcpClient.resetSession();
      setSessionId(null);
    }
  };

  // Test connection
  const handleTestConnection = async () => {
    if (!token.trim()) return;
    setIsTesting(true);
    setStatus('connecting');
    setExecuteError(null);

    try {
      await mcpClient.initialize(token);
      const sid = mcpClient.getSessionId();
      setSessionId(sid);
      setStatus('connected');
    } catch (err: any) {
      setStatus('disconnected');
      setSessionId(null);
      setExecuteError(err.message || '连接麦当劳 MCP 服务失败');
    } finally {
      setIsTesting(false);
    }
  };

  // Execute selected tool
  const handleExecute = async (toolName: string, args: Record<string, any>) => {
    if (!token.trim()) {
      setExecuteError('请先在顶部设置您的 MCP Token');
      return;
    }

    setIsExecuting(true);
    setExecuteError(null);

    try {
      const res = await mcpClient.executeTool(token, toolName, args);
      setLastResult(res);
      setStatus('connected');
      setSessionId(mcpClient.getSessionId());

      // Smooth scroll to visualizer
      setTimeout(() => {
        visualizerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (err: any) {
      setExecuteError(err.message || '工具调用异常');
      if (err.result) {
        setLastResult({
          toolName,
          args,
          result: err.result,
          durationMs: err.durationMs || 0,
          timestamp: err.timestamp || new Date().toLocaleTimeString(),
          error: err.message,
        });
      }
    } finally {
      setIsExecuting(false);
    }
  };

  // Handle Quick Action click
  const handleQuickAction = (toolId: OfficialToolId, defaultArgs?: Record<string, any>) => {
    const targetTool = TOOL_MAP[toolId] || OFFICIAL_TOOLS.find((t) => t.id === toolId);
    if (targetTool) {
      setSelectedTool(targetTool);
      setInitialArgs(defaultArgs);
      setExecuteError(null);

      // Scroll to executor
      executorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Handle Tool selection from 33-tool list
  const handleSelectTool = (tool: ToolMetadata) => {
    setSelectedTool(tool);
    setInitialArgs(undefined);
    setExecuteError(null);
    executorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <Theme appearance="dark" accentColor="amber" grayColor="slate" radius="large">
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {/* Navigation & Token Bar */}
        <Header
          token={token}
          onTokenChange={handleTokenChange}
          status={status}
          sessionId={sessionId}
          onTestConnection={handleTestConnection}
          isTesting={isTesting}
        />

        {/* Main Content Area */}
        <main className="app-container" style={{ flex: 1, width: '100%' }}>
          {/* 1. Quick Actions */}
          <QuickActions onSelectAction={handleQuickAction} activeToolId={selectedTool.id} />

          {/* 2. Tool Execution Workspace */}
          <div ref={executorRef}>
            <ToolExecutor
              tool={selectedTool}
              token={token}
              onExecute={handleExecute}
              isExecuting={isExecuting}
              error={executeError}
              initialArgs={initialArgs}
            />
          </div>

          {/* 3. Result Visualizer (when executed) */}
          {lastResult && (
            <div ref={visualizerRef}>
              <Visualizer
                toolName={lastResult.toolName}
                result={lastResult.result}
                durationMs={lastResult.durationMs}
                timestamp={lastResult.timestamp}
              />
            </div>
          )}

          {/* 4. Complete 33 Tools Directory */}
          <div style={{ marginTop: '36px' }}>
            <ToolList selectedToolId={selectedTool.id} onSelectTool={handleSelectTool} />
          </div>
        </main>

        {/* Footer */}
        <footer
          style={{
            borderTop: '1px solid var(--border-subtle)',
            padding: '24px 20px',
            textAlign: 'center',
            color: 'var(--text-tertiary)',
            background: 'var(--bg-surface)',
          }}
          className="font-s"
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span>麦当劳 MCP 协议客户端</span>
            <span>·</span>
            <span>基于 Streamable HTTP 协议与 React 19 构建</span>
            <span>·</span>
            <a
              href="https://github.com/M-China/mcd-mcp-server"
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}
            >
              官方协议标准库
            </a>
          </div>
        </footer>
      </div>
    </Theme>
  );
};

export default App;
