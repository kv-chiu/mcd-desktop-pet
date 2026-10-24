import React from 'react';

interface SectionHeaderProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  style?: React.CSSProperties;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  icon,
  title,
  subtitle,
  action,
  style,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '16px',
        gap: '12px',
        flexWrap: 'wrap',
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {icon && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              lineHeight: 1,
            }}
          >
            {icon}
          </div>
        )}
        <div>
          <h3
            style={{
              fontSize: '15px',
              fontWeight: 700,
              margin: 0,
              color: 'var(--text-main)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {title}
          </h3>
          {subtitle && (
            <div style={{ fontSize: '12px', color: 'var(--text-subtle)', marginTop: '2px' }}>
              {subtitle}
            </div>
          )}
        </div>
      </div>

      {action && <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>{action}</div>}
    </div>
  );
};
