import React, { useState, useEffect } from 'react';
import { ToolMetadata } from '../types/mcp';
import { Icon } from './Icon';

interface ToolExecutorProps {
  tool: ToolMetadata;
  token: string;
  onExecute: (toolName: string, args: Record<string, any>) => Promise<void>;
  isExecuting: boolean;
  error?: string | null;
  initialArgs?: Record<string, any>;
}

export const ToolExecutor: React.FC<ToolExecutorProps> = ({
  tool,
  token,
  onExecute,
  isExecuting,
  error,
  initialArgs,
}) => {
  const [formData, setFormData] = useState<Record<string, any>>({});

  useEffect(() => {
    const initial: Record<string, any> = {};
    tool.params.forEach((param) => {
      if (initialArgs && initialArgs[param.name] !== undefined) {
        initial[param.name] = initialArgs[param.name];
      } else if (param.defaultValue !== undefined) {
        initial[param.name] = param.defaultValue;
      } else if (tool.exampleArgs && tool.exampleArgs[param.name] !== undefined) {
        initial[param.name] = tool.exampleArgs[param.name];
      }
    });
    setFormData(initial);
  }, [tool, initialArgs]);

  const handleInputChange = (name: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleLoadExample = () => {
    if (tool.exampleArgs) {
      setFormData({ ...tool.exampleArgs });
    }
  };

  const handleClear = () => {
    setFormData({});
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onExecute(tool.id, formData);
  };

  return (
    <div className="frosted-card" style={{ padding: '24px', marginBottom: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(245, 158, 11, 0.12)',
              border: '1px solid var(--accent-gold-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-gold)',
              flexShrink: 0,
            }}
          >
            <Icon name={tool.icon} size={20} />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span className="font-l" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                {tool.name}
              </span>
              <span className="apple-badge font-mono">{tool.id}</span>
              <span className="apple-badge apple-badge-gold">{tool.categoryZh}</span>
            </div>
            <div className="font-s" style={{ color: 'var(--text-tertiary)', marginTop: '2px' }}>
              {tool.nameEn}
            </div>
            <div className="font-m" style={{ color: 'var(--text-secondary)', marginTop: '6px', maxWidth: '780px', lineHeight: '1.45' }}>
              {tool.description}
            </div>
          </div>
        </div>

        {tool.exampleArgs && Object.keys(tool.exampleArgs).length > 0 && (
          <button
            type="button"
            onClick={handleLoadExample}
            className="apple-btn-secondary"
            title="一键填入官方推荐的典型调用参数"
          >
            <Icon name="sparkles" size={13} />
            填入示例参数
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {tool.params.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            {tool.params.map((param) => {
              const value = formData[param.name] ?? '';
              return (
                <div key={param.name} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label className="font-s" style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                      {param.label}
                      <span className="font-mono" style={{ color: 'var(--text-tertiary)', marginLeft: '6px' }}>
                        ({param.name})
                      </span>
                    </label>
                    {param.required ? (
                      <span className="apple-badge apple-badge-gold" style={{ fontSize: '11px', padding: '1px 5px' }}>
                        必填
                      </span>
                    ) : (
                      <span className="apple-badge" style={{ fontSize: '11px', padding: '1px 5px' }}>
                        可选
                      </span>
                    )}
                  </div>

                  {param.type === 'select' && param.options ? (
                    <select
                      value={value}
                      onChange={(e) => handleInputChange(param.name, e.target.value)}
                      className="apple-input"
                    >
                      {param.options.map((opt) => (
                        <option key={opt.value} value={opt.value} style={{ background: '#18181d', color: '#ededed' }}>
                          {opt.label} ({opt.value})
                        </option>
                      ))}
                    </select>
                  ) : param.type === 'boolean' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '38px' }}>
                      <input
                        type="checkbox"
                        checked={Boolean(value)}
                        onChange={(e) => handleInputChange(param.name, e.target.checked)}
                        style={{ width: '16px', height: '16px', accentColor: 'var(--accent-gold)' }}
                      />
                      <span className="font-s" style={{ color: 'var(--text-secondary)' }}>
                        {param.description || '启用此选项'}
                      </span>
                    </div>
                  ) : param.type === 'json' ? (
                    <textarea
                      rows={3}
                      value={typeof value === 'object' ? JSON.stringify(value, null, 2) : value}
                      onChange={(e) => {
                        try {
                          handleInputChange(param.name, JSON.parse(e.target.value));
                        } catch {
                          handleInputChange(param.name, e.target.value);
                        }
                      }}
                      placeholder={param.placeholder || 'JSON 格式数据'}
                      className="apple-input font-mono"
                      style={{ fontSize: 'var(--font-size-s)', resize: 'vertical' }}
                    />
                  ) : (
                    <input
                      type={param.type === 'number' ? 'number' : 'text'}
                      value={value}
                      onChange={(e) =>
                        handleInputChange(
                          param.name,
                          param.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value
                        )
                      }
                      placeholder={param.placeholder || `请输入 ${param.label}`}
                      className="apple-input"
                    />
                  )}

                  {param.description && (
                    <div className="font-s" style={{ color: 'var(--text-tertiary)', lineHeight: '1.3' }}>
                      {param.description}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div
            style={{
              padding: '12px 14px',
              background: 'var(--bg-surface-elevated)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
            }}
            className="font-s"
          >
            本工具无需输入任何参数，点击下方按钮即可直接通过 MCP 调用。
          </div>
        )}

        {error && (
          <div
            style={{
              padding: '10px 14px',
              background: 'var(--status-error-soft)',
              border: '1px solid rgba(248, 113, 113, 0.25)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--status-error)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
            className="font-s"
          >
            <Icon name="x-circle" size={15} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid var(--border-subtle)' }}>
          <button
            type="button"
            onClick={handleClear}
            className="apple-btn-secondary"
            disabled={isExecuting}
          >
            重置输入
          </button>

          <button
            type="submit"
            disabled={!token || isExecuting}
            className="apple-btn-primary"
            style={{ padding: '8px 24px' }}
          >
            {isExecuting ? (
              <>
                <Icon name="refresh" size={14} className="animate-spin" />
                正在执行 MCP 调用...
              </>
            ) : (
              <>
                <Icon name="zap" size={14} />
                执行工具 ({tool.id})
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
