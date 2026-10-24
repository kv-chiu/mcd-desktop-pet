import React from 'react';

interface SlotBadgeProps {
  slot: string;
  className?: string;
  style?: React.CSSProperties;
}

const SLOT_CONFIG: Record<string, { label: string; badgeClass: string }> = {
  menu: { label: 'Menu Slot', badgeClass: 'badge-gold' },
  render: { label: 'Render Slot', badgeClass: 'badge-blue' },
  event: { label: 'Event Slot', badgeClass: 'badge-green' },
  ws: { label: 'Event Slot', badgeClass: 'badge-green' },
  cli: { label: 'CLI Slot', badgeClass: 'badge-red' },
  skill: { label: 'Skill Slot', badgeClass: 'badge-purple' },
};

export const SlotBadge: React.FC<SlotBadgeProps> = ({ slot, className = '', style }) => {
  const normalized = slot.toLowerCase().replace('_slot', '').replace('-slot', '');
  const config = SLOT_CONFIG[normalized] || {
    label: `${slot.toUpperCase()} Slot`,
    badgeClass: 'badge-neutral',
  };

  return (
    <span
      className={`badge ${config.badgeClass} ${className}`}
      style={{ fontSize: '10px', textTransform: 'uppercase', ...style }}
    >
      {config.label}
    </span>
  );
};

export default SlotBadge;
