import React from 'react';
import {
  LayoutDashboard,
  StickyNote,
  Blocks,
  Settings,
  Eye,
  EyeOff,
} from 'lucide-react';
import { PetState, NoteItem } from '../types';

export type NavTab = 'overview' | 'notes' | 'plugins' | 'settings';

interface SidebarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  petState: PetState | null;
  notes: NoteItem[];
  isConnected: boolean;
  onTogglePetVisibility: () => void;
  onTriggerQuickAction: (action: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  petState,
  notes,
  isConnected,
  onTogglePetVisibility,
  onTriggerQuickAction,
}) => {
  const activeNotesCount = (Array.isArray(notes) ? notes : []).filter((n) => n.status === 'active').length;
  const isPetVisible = petState?.is_visible !== false;

  const navItems = [
    {
      id: 'overview' as NavTab,
      label: '概览工作台',
      sublabel: '状态监控 & 快捷操作',
      icon: LayoutDashboard,
    },
    {
      id: 'notes' as NavTab,
      label: '历史便签盒',
      sublabel: '图文便签 & 归档检索',
      icon: StickyNote,
      badge: activeNotesCount > 0 ? `${activeNotesCount} 活动` : undefined,
      badgeColor: 'badge-gold',
    },
    {
      id: 'plugins' as NavTab,
      label: '插件与插槽',
      sublabel: '5-Slot 契约矩阵',
      icon: Blocks,
      badge: '5 Slots',
      badgeColor: 'badge-purple',
    },
    {
      id: 'settings' as NavTab,
      label: '偏好设置',
      sublabel: '主题外观 · 缩放 · 音量',
      icon: Settings,
    },
  ];

  return (
    <aside
      style={{
        width: '260px',
        height: '100vh',
        position: 'fixed',
        left: 0,
        top: 0,
        background: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 100,
        userSelect: 'none',
      }}
    >
      {/* Brand Header */}
      <div
        style={{
          padding: '24px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '11px',
            background: 'var(--mcd-red)',
            border: '2px solid var(--mcd-gold)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--mcd-gold)',
            fontWeight: 900,
            fontSize: '22px',
            boxShadow: '0 4px 14px rgba(218, 41, 28, 0.45)',
            flexShrink: 0,
          }}
        >
          M
        </div>
        <div style={{ overflow: 'hidden' }}>
          <div
            style={{
              fontWeight: 700,
              fontSize: '15px',
              color: 'var(--text-main)',
              letterSpacing: '-0.02em',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
              overflow: 'hidden',
            }}
          >
            桌宠管理控制台
          </div>
          <div
            style={{
              fontSize: '11px',
              color: 'var(--text-subtle)',
              marginTop: '1px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span style={{ color: 'var(--mcd-gold)', fontWeight: 600 }}>v1.0.0</span>
            <span>·</span>
            <span>5-Slot 扩展架构</span>
          </div>
        </div>
      </div>

      {/* Nav Menu Items */}
      <nav style={{ flex: 1, padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div
          style={{
            fontSize: '11px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--text-subtle)',
            padding: '6px 12px',
          }}
        >
          功能导航
        </div>

        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const IconComponent = item.icon;

          return (
            <button
              key={item.id}
              id={`nav-${item.id}`}
              onClick={() => onTabChange(item.id)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                background: isActive ? 'var(--bg-card-elevated)' : 'transparent',
                border: isActive ? '1px solid var(--border-active)' : '1px solid transparent',
                color: isActive ? 'var(--text-main)' : 'var(--text-muted)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.16s ease',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'var(--bg-card)';
                  e.currentTarget.style.color = 'var(--text-main)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--text-muted)';
                }
              }}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: 'var(--radius-sm)',
                  background: isActive ? 'var(--mcd-gold-soft)' : 'rgba(255,255,255,0.04)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isActive ? 'var(--mcd-gold)' : 'var(--text-muted)',
                  flexShrink: 0,
                  transition: 'all 0.16s ease',
                }}
              >
                <IconComponent size={17} />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: isActive ? 600 : 500 }}>{item.label}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-subtle)', marginTop: '1px' }}>
                  {item.sublabel}
                </div>
              </div>

              {item.badge && (
                <span className={`badge ${item.badgeColor || 'badge-neutral'}`} style={{ fontSize: '10px', padding: '2px 6px' }}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom Pet Widget Card */}
      <div style={{ padding: '16px 14px', borderTop: '1px solid var(--border)' }}>
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: isConnected ? 'var(--status-green)' : 'var(--mcd-red)',
                  boxShadow: isConnected ? '0 0 8px var(--status-green)' : 'none',
                }}
              />
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)' }}>
                {isConnected ? '桌面宠物在席' : '中枢服务断开'}
              </span>
            </div>

            <button
              onClick={onTogglePetVisibility}
              title={isPetVisible ? '隐藏桌宠本体与便签' : '唤醒桌宠本体与便签'}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: isPetVisible ? 'var(--text-muted)' : 'var(--text-subtle)',
                display: 'flex',
                alignItems: 'center',
                padding: '4px',
                borderRadius: '4px',
              }}
            >
              {isPetVisible ? <Eye size={15} /> : <EyeOff size={15} />}
            </button>
          </div>

          <div
            style={{
              fontSize: '11px',
              color: 'var(--text-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '10px',
            }}
          >
            <span>动作: <strong style={{ color: 'var(--mcd-gold)' }}>{petState?.current_action || 'idle'}</strong></span>
            <span>比例: {Math.round((petState?.scale || 1.0) * 100)}%</span>
          </div>

          {/* Quick Pet Interaction Buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
            <button
              type="button"
              className="btn-secondary"
              style={{ padding: '4px 6px', fontSize: '11px' }}
              onClick={() => onTriggerQuickAction('eating_burger')}
              title="喂食汉堡"
            >
              🍔 汉堡
            </button>
            <button
              type="button"
              className="btn-secondary"
              style={{ padding: '4px 6px', fontSize: '11px' }}
              onClick={() => onTriggerQuickAction('eating_fries')}
              title="吃包薯条"
            >
              🍟 薯条
            </button>
            <button
              type="button"
              className="btn-secondary"
              style={{ padding: '4px 6px', fontSize: '11px' }}
              onClick={() => onTriggerQuickAction('jump')}
              title="开心跳跃"
            >
              ✨ 跳跃
            </button>
          </div>
        </div>

        {/* Port Status */}
        <div
          style={{
            fontSize: '11px',
            color: 'var(--text-subtle)',
            marginTop: '10px',
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          <span>Port :23301</span>
          <span>·</span>
          <span>WebSocket Event Hub</span>
        </div>
      </div>
    </aside>
  );
};
