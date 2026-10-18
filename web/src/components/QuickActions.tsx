import React from 'react';
import { Icon } from './Icon';
import { OfficialToolId } from '../types/mcp';

interface QuickActionItem {
  id: OfficialToolId;
  title: string;
  subtitle: string;
  icon: string;
  defaultArgs?: Record<string, any>;
}

const QUICK_ACTIONS: QuickActionItem[] = [
  {
    id: 'auto-bind-coupons',
    title: '一键自动领券',
    subtitle: '自动领取当前所有可用优惠券',
    icon: 'zap',
  },
  {
    id: 'campaign-calendar',
    title: '营销活动日历',
    subtitle: '查询当月最新会员活动排期',
    icon: 'calendar',
  },
  {
    id: 'query-my-coupons',
    title: '我的优惠券',
    subtitle: '查看已入账的麦麦省券及有效期',
    icon: 'ticket',
  },
  {
    id: 'query-my-account',
    title: '我的积分资产',
    subtitle: '查询可用积分及近期到期积分',
    icon: 'wallet',
  },
  {
    id: 'list-nutrition-foods',
    title: '餐品营养速查',
    subtitle: '查询热量卡路里与各营养元素',
    icon: 'activity',
    defaultArgs: { keyword: '汉堡' },
  },
  {
    id: 'now-time-info',
    title: '当前系统时间',
    subtitle: '校准当前精准服务时间与时区',
    icon: 'clock',
  },
];

interface QuickActionsProps {
  onSelectAction: (toolId: OfficialToolId, defaultArgs?: Record<string, any>) => void;
  activeToolId?: string;
}

export const QuickActions: React.FC<QuickActionsProps> = ({ onSelectAction, activeToolId }) => {
  return (
    <section style={{ marginBottom: '28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span className="font-l" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
            高频常用工具
          </span>
          <span className="font-s" style={{ color: 'var(--text-tertiary)' }}>
            一键直达
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px' }}>
        {QUICK_ACTIONS.map((item) => {
          const isActive = activeToolId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectAction(item.id, item.defaultArgs)}
              className={`frosted-card-interactive ${isActive ? 'active' : ''}`}
              style={{
                padding: '14px 16px',
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                border: isActive ? '1px solid var(--accent-gold)' : undefined,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    background: isActive ? 'rgba(245, 158, 11, 0.2)' : 'var(--bg-surface-elevated)',
                    color: isActive ? 'var(--accent-gold)' : 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name={item.icon} size={15} />
                </div>
                <Icon name="chevron-right" size={13} style={{ color: 'var(--text-tertiary)' }} />
              </div>

              <div>
                <div className="font-m" style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                  {item.title}
                </div>
                <div className="font-s" style={{ color: 'var(--text-tertiary)', marginTop: '2px', lineHeight: '1.3' }}>
                  {item.subtitle}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};
