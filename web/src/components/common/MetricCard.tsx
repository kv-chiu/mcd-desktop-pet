import React from 'react';

export interface MetricCardProps {
  title: string;
  value: React.ReactNode;
  subtitle: string;
  icon: React.ReactNode;
  iconBg?: string;
  badge?: {
    text: string;
    colorClass?: string;
  };
  action?: React.ReactNode;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  iconBg = 'rgba(255, 255, 255, 0.05)',
  badge,
  action,
  onClick,
  className = '',
  style,
}) => {
  return (
    <div
      className={`glass-card ${className}`}
      onClick={onClick}
      style={{
        padding: '20px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.18s ease, border-color 0.18s ease',
        ...style,
      }}
      onMouseEnter={(e) => {
        if (onClick) {
          e.currentTarget.style.borderColor = 'var(--border-active)';
          e.currentTarget.style.transform = 'translateY(-2px)';
        }
      }}
      onMouseLeave={(e) => {
        if (onClick) {
          e.currentTarget.style.borderColor = 'var(--border)';
          e.currentTarget.style.transform = 'translateY(0)';
        }
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>{title}</span>
        {action ? (
          action
        ) : (
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: iconBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {icon}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
        <span style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
          {value}
        </span>
        {badge && (
          <span className={`badge ${badge.colorClass || 'badge-neutral'}`}>
            {badge.text}
          </span>
        )}
      </div>

      <div style={{ fontSize: '12px', color: 'var(--text-subtle)', marginTop: '8px' }}>
        {subtitle}
      </div>
    </div>
  );
};

export default MetricCard;
