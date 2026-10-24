import React from 'react';

export interface FilterTabItem<T extends string = string> {
  id: T;
  label: string;
  count?: number;
}

interface FilterTabsProps<T extends string = string> {
  tabs: FilterTabItem<T>[];
  activeId: T;
  onChange: (id: T) => void;
  className?: string;
  style?: React.CSSProperties;
}

export function FilterTabs<T extends string = string>({
  tabs,
  activeId,
  onChange,
  className,
  style,
}: FilterTabsProps<T>) {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        background: 'var(--bg-card-elevated)',
        padding: '3px',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border)',
        ...style,
      }}
    >
      {tabs.map((tab) => {
        const isActive = activeId === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            style={{
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: 600,
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              background: isActive ? 'var(--mcd-gold)' : 'transparent',
              color: isActive ? '#000' : 'var(--text-muted)',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                style={{
                  fontSize: '11px',
                  opacity: isActive ? 0.8 : 0.6,
                  fontWeight: 700,
                }}
              >
                ({tab.count})
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
