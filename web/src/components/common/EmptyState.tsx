import React from 'react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  style?: React.CSSProperties;
  compact?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = '📦',
  title,
  description,
  action,
  style,
  compact = false,
}) => {
  return (
    <div
      style={{
        padding: compact ? '24px 16px' : '48px 24px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: compact ? '8px' : '14px',
        color: 'var(--text-subtle)',
        ...style,
      }}
    >
      <div style={{ fontSize: compact ? '28px' : '44px', lineHeight: 1 }}>{icon}</div>
      <div
        style={{
          fontWeight: 700,
          fontSize: compact ? '14px' : '16px',
          color: 'var(--text-main)',
        }}
      >
        {title}
      </div>
      {description && (
        <p
          style={{
            margin: 0,
            fontSize: compact ? '12px' : '13px',
            color: 'var(--text-subtle)',
            maxWidth: '380px',
            lineHeight: 1.5,
          }}
        >
          {description}
        </p>
      )}
      {action && <div style={{ marginTop: compact ? '4px' : '8px' }}>{action}</div>}
    </div>
  );
};
