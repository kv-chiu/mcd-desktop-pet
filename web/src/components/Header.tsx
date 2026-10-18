import React, { useState } from 'react';
import { Icon } from './Icon';
import { ConnectionStatus } from '../types/mcp';

interface HeaderProps {
  token: string;
  onTokenChange: (token: string) => void;
  status: ConnectionStatus;
  sessionId: string | null;
  onTestConnection: () => void;
  isTesting: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  token,
  onTokenChange,
  status,
  sessionId,
  onTestConnection,
  isTesting,
}) => {
  const [showToken, setShowToken] = useState(false);

  return (
    <header className="frosted-nav">
      <div className="app-container" style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(245, 158, 11, 0.15)',
                border: '1px solid var(--accent-gold-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-gold)',
              }}
            >
              <Icon name="utensils" size={18} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="font-l" style={{ fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
                  麦当劳 MCP Client
                </span>
                <span className="apple-badge apple-badge-gold" style={{ fontSize: '11px', padding: '1px 6px' }}>
                  v1.0.9
                </span>
              </div>
              <div className="font-s" style={{ color: 'var(--text-tertiary)', marginTop: '2px' }}>
                官方 33 项标准工具接口 · Streamable HTTP 协议
              </div>
            </div>
          </div>

          {/* Status & Open Platform Link */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {status === 'connected' ? (
              <span className="apple-badge apple-badge-success">
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--status-success)' }} />
                已连接
              </span>
            ) : status === 'connecting' ? (
              <span className="apple-badge apple-badge-gold">
                <Icon name="refresh" size={12} className="animate-spin" />
                正在连接...
              </span>
            ) : (
              <span className="apple-badge apple-badge-error">
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--status-error)' }} />
                未连接
              </span>
            )}

            {sessionId && (
              <span className="apple-badge font-mono" title={`Session ID: ${sessionId}`} style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                Session: {sessionId.slice(0, 8)}...
              </span>
            )}

            <a
              href="https://open.mcd.cn/mcp"
              target="_blank"
              rel="noreferrer"
              className="apple-btn-secondary"
              style={{ textDecoration: 'none' }}
            >
              <Icon name="external-link" size={13} />
              开放平台
            </a>
          </div>
        </div>

        {/* Token Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            padding: '6px 10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-tertiary)', flexShrink: 0 }}>
            <Icon name="key" size={14} />
            <span className="font-s" style={{ fontWeight: 500 }}>MCP Token:</span>
          </div>

          <div style={{ flex: 1, position: 'relative' }}>
            <input
              type={showToken ? 'text' : 'password'}
              value={token}
              onChange={(e) => onTokenChange(e.target.value)}
              placeholder="请输入您在麦当劳开放平台申请的 MCP Token (Bearer Token)"
              className="font-s font-mono"
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          <button
            type="button"
            onClick={() => setShowToken(!showToken)}
            className="apple-btn-secondary"
            style={{ padding: '4px 8px', border: 'none', background: 'transparent' }}
            title={showToken ? '隐藏 Token' : '显示 Token'}
          >
            <Icon name={showToken ? 'eye-off' : 'eye'} size={14} />
          </button>

          <button
            type="button"
            onClick={onTestConnection}
            disabled={!token || isTesting}
            className="apple-btn-primary"
            style={{ padding: '4px 12px', fontSize: 'var(--font-size-s)' }}
          >
            {isTesting ? <Icon name="refresh" size={13} className="animate-spin" /> : <Icon name="zap" size={13} />}
            测试连接
          </button>
        </div>
      </div>
    </header>
  );
};
