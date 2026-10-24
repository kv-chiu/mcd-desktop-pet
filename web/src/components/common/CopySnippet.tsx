import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CopySnippetProps {
  text: string;
  displayPrefix?: string;
  style?: React.CSSProperties;
  label?: string;
}

export const CopySnippet: React.FC<CopySnippetProps> = ({
  text,
  displayPrefix,
  style,
  label,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      onClick={handleCopy}
      title="点击快速复制"
      style={{
        background: '#07070a',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        padding: '8px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontFamily: 'var(--font-mono)',
        fontSize: '11px',
        color: '#d4d4dc',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        ...style,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border)';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', minWidth: 0 }}>
        {label && (
          <span
            style={{
              color: 'var(--text-subtle)',
              fontSize: '10px',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              fontWeight: 700,
            }}
          >
            {label}
          </span>
        )}
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {displayPrefix && <span style={{ color: 'var(--mcd-gold)', marginRight: '6px' }}>{displayPrefix}</span>}
          {text}
        </span>
      </div>

      <button
        type="button"
        onClick={handleCopy}
        style={{
          background: 'transparent',
          border: 'none',
          color: copied ? 'var(--status-green)' : 'var(--text-subtle)',
          cursor: 'pointer',
          padding: '2px 4px',
          marginLeft: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          fontSize: '10px',
          flexShrink: 0,
        }}
        title="复制到剪贴板"
      >
        {copied ? <Check size={13} /> : <Copy size={13} />}
        {copied && <span>已复制</span>}
      </button>
    </div>
  );
};
