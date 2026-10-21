import React, { useState } from 'react';
import { Icon } from './Icon';
import {
  extractTextFromResult,
  parseTimeData,
  parseCalendarData,
  parseAvailableCoupons,
  parseMyCoupons,
  parseBindResult,
  parseNutritionFoods,
  parsePointsAccount,
  parseLotteryInfo,
  parseOrderList,
} from '../utils/parsers';
import { ExecutionLayers } from '../types/mcp';

interface VisualizerProps {
  toolName: string;
  result: any;
  durationMs?: number;
  timestamp?: string;
  error?: string;
  layers?: ExecutionLayers;
}

export const Visualizer: React.FC<VisualizerProps> = ({
  toolName,
  result,
  durationMs,
  timestamp,
  error,
  layers,
}) => {
  const [viewMode, setViewMode] = useState<'visual' | 'raw'>('visual');
  const [copied, setCopied] = useState(false);

  const rawText = extractTextFromResult(result);
  const jsonString = typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderStructuredContent = () => {
    if (!rawText && !result) {
      return (
        <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
          <Icon name="package" size={24} style={{ marginBottom: '8px', opacity: 0.5 }} />
          <div className="font-m">暂无返回数据</div>
        </div>
      );
    }

    if (toolName === 'now-time-info') {
      const timeData = parseTimeData(result, rawText);
      return (
        <div
          style={{
            padding: '24px',
            background: 'linear-gradient(135deg, rgba(24, 24, 29, 0.9) 0%, rgba(18, 18, 22, 0.95) 100%)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div className="apple-badge apple-badge-gold">
            <Icon name="clock" size={12} />
            麦当劳系统基准时钟
          </div>
          <div className="font-l font-mono" style={{ fontSize: '28px', fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
            {timeData?.formatted || rawText || '时间数据获取中...'}
          </div>
          {timeData?.dayOfWeek && (
            <div className="font-m" style={{ color: 'var(--text-secondary)' }}>
              {timeData.date} · {timeData.dayOfWeek}
            </div>
          )}
        </div>
      );
    }

    if (toolName === 'campaign-calendar') {
      const calendarData = parseCalendarData(rawText);
      const days = Object.keys(calendarData);

      if (days.length === 0) {
        return (
          <div className="apple-code-block" style={{ whiteSpace: 'pre-wrap' }}>
            {rawText}
          </div>
        );
      }

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="apple-badge apple-badge-gold">
              <Icon name="calendar" size={12} />
              共计 {days.length} 个活动排期日
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
            {days.map((day) => (
              <div
                key={day}
                style={{
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className="font-m font-mono" style={{ fontWeight: 600, color: 'var(--accent-gold)' }}>
                    {day}
                  </span>
                  <span className="font-s" style={{ color: 'var(--text-tertiary)' }}>
                    {calendarData[day].length} 项活动
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {calendarData[day].map((act, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '8px 10px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        borderRadius: '6px',
                        borderLeft: '2px solid var(--accent-gold)',
                      }}
                    >
                      <div className="font-m" style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                        {act.title}
                      </div>
                      {act.content && (
                        <div className="font-s" style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
                          {act.content}
                        </div>
                      )}
                      {act.img && (
                        <div style={{ marginTop: '8px' }}>
                          <img
                            src={act.img}
                            alt={act.title}
                            style={{ maxWidth: '100%', maxHeight: '120px', borderRadius: '4px', objectFit: 'cover' }}
                            loading="lazy"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (toolName === 'query-my-coupons' || toolName === 'available-coupons' || toolName === 'query-store-coupons') {
      const myResult = parseMyCoupons(rawText);
      const availResult = parseAvailableCoupons(rawText);
      const list = myResult.coupons.length > 0 ? myResult.coupons : availResult;

      if (list.length === 0) {
        return (
          <div className="apple-code-block" style={{ whiteSpace: 'pre-wrap' }}>
            {rawText}
          </div>
        );
      }

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="apple-badge apple-badge-gold">
              <Icon name="ticket" size={12} />
              找到 {list.length} 张优惠券
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
            {list.map((c: any, idx) => (
              <div
                key={idx}
                style={{
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '10px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                    <div className="font-m" style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                      {c.title}
                    </div>
                    {c.price && (
                      <span className="font-m font-mono" style={{ fontWeight: 600, color: 'var(--accent-gold)' }}>
                        ¥{c.price}
                      </span>
                    )}
                  </div>

                  {c.validity && (
                    <div className="font-s" style={{ color: 'var(--text-tertiary)', marginTop: '4px' }}>
                      有效期: {c.validity}
                    </div>
                  )}

                  {c.status && (
                    <div style={{ marginTop: '6px' }}>
                      <span className="apple-badge apple-badge-success">{c.status}</span>
                    </div>
                  )}

                  {c.tags && c.tags.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                      {c.tags.map((t: string, i: number) => (
                        <span key={i} className="apple-badge" style={{ fontSize: '11px' }}>
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {c.img && (
                  <div style={{ alignSelf: 'flex-end', marginTop: '6px' }}>
                    <img
                      src={c.img}
                      alt={c.title}
                      style={{ width: '64px', height: '64px', borderRadius: '4px', objectFit: 'contain' }}
                      loading="lazy"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (toolName === 'auto-bind-coupons') {
      const isFailed = Boolean(
        result?.isError ||
        layers?.tool?.isError ||
        layers?.business?.outcome === 'failure' ||
        rawText.includes('优惠券领取失败') ||
        rawText.includes('领取失败')
      );
      const bindData = parseBindResult(rawText);

      if (isFailed && bindData.coupons.length === 0) {
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span className="apple-badge apple-badge-error">
                <Icon name="x-circle" size={12} />
                领券失败: {layers?.business?.summary || layers?.tool?.error || error || rawText.trim() || '优惠券领取失败'}
              </span>
            </div>
            <div className="apple-code-block" style={{ color: 'var(--red-9)' }}>
              {rawText || error || '工具执行返回 result.isError: true'}
            </div>
          </div>
        );
      }

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span
              className={`apple-badge ${
                bindData.isAllSuccess
                  ? 'apple-badge-success'
                  : parseInt(bindData.success, 10) > 0
                  ? 'apple-badge-gold'
                  : 'apple-badge-error'
              }`}
            >
              <Icon name={bindData.isAllSuccess ? 'check' : 'ticket'} size={12} />
              成功领取: {bindData.success} 张
            </span>
            {parseInt(bindData.fail, 10) > 0 && (
              <span className="apple-badge apple-badge-error">
                <Icon name="x-circle" size={12} />
                失败: {bindData.fail} 张
              </span>
            )}
          </div>

          {bindData.coupons.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '10px' }}>
              {bindData.coupons.map((c, idx) => (
                <div
                  key={idx}
                  style={{
                    background: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}
                >
                  {c.img && (
                    <img
                      src={c.img}
                      alt={c.title}
                      style={{ width: '48px', height: '48px', borderRadius: '4px', objectFit: 'contain' }}
                    />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="font-m" style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.title}
                    </div>
                    <div className="font-s font-mono" style={{ color: 'var(--text-tertiary)', marginTop: '2px' }}>
                      券码: {c.code}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="apple-code-block">{rawText}</div>
          )}
        </div>
      );
    }

    if (toolName === 'list-nutrition-foods') {
      const items = parseNutritionFoods(rawText);
      if (items.length === 0) {
        return <div className="apple-code-block">{rawText}</div>;
      }

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="apple-badge apple-badge-gold">
              <Icon name="activity" size={12} />
              找到 {items.length} 种餐品营养数据
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
            {items.map((item, idx) => (
              <div
                key={idx}
                style={{
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className="font-m" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    {item.name}
                  </span>
                  {item.energyKcal && (
                    <span className="font-s font-mono apple-badge apple-badge-gold">
                      {item.energyKcal}
                    </span>
                  )}
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '6px',
                    background: 'var(--bg-surface)',
                    padding: '8px',
                    borderRadius: '6px',
                    textAlign: 'center',
                  }}
                >
                  <div>
                    <div className="font-s" style={{ color: 'var(--text-tertiary)' }}>蛋白质</div>
                    <div className="font-s font-mono" style={{ fontWeight: 500, marginTop: '2px' }}>{item.protein || '-'}</div>
                  </div>
                  <div>
                    <div className="font-s" style={{ color: 'var(--text-tertiary)' }}>脂肪</div>
                    <div className="font-s font-mono" style={{ fontWeight: 500, marginTop: '2px' }}>{item.fat || '-'}</div>
                  </div>
                  <div>
                    <div className="font-s" style={{ color: 'var(--text-tertiary)' }}>碳水</div>
                    <div className="font-s font-mono" style={{ fontWeight: 500, marginTop: '2px' }}>{item.carbs || '-'}</div>
                  </div>
                  <div>
                    <div className="font-s" style={{ color: 'var(--text-tertiary)' }}>钠</div>
                    <div className="font-s font-mono" style={{ fontWeight: 500, marginTop: '2px' }}>{item.sodium || '-'}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (toolName === 'query-my-account') {
      const points = parsePointsAccount(rawText);
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div
            style={{
              padding: '24px',
              background: 'linear-gradient(135deg, rgba(24, 24, 29, 0.9) 0%, rgba(18, 18, 22, 0.95) 100%)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div className="apple-badge apple-badge-gold">
                <Icon name="wallet" size={12} />
                麦当劳会员积分
              </div>
              {points.expireDate && (
                <div className="font-s" style={{ color: 'var(--text-tertiary)' }}>
                  到期日: {points.expireDate}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span className="font-l font-mono" style={{ fontSize: '32px', fontWeight: 600, color: 'var(--accent-gold)' }}>
                {points.availablePoints}
              </span>
              <span className="font-s" style={{ color: 'var(--text-secondary)' }}>可用积分</span>
            </div>

            {(points.totalPoints || points.expiringPoints) && (
              <div style={{ display: 'flex', gap: '20px', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
                {points.totalPoints && (
                  <div>
                    <span className="font-s" style={{ color: 'var(--text-tertiary)' }}>累计获得: </span>
                    <span className="font-s font-mono" style={{ color: 'var(--text-primary)' }}>{points.totalPoints}</span>
                  </div>
                )}
                {points.expiringPoints && (
                  <div>
                    <span className="font-s" style={{ color: 'var(--text-tertiary)' }}>即将过期: </span>
                    <span className="font-s font-mono" style={{ color: 'var(--status-error)' }}>{points.expiringPoints}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    if (toolName === 'query-lottery-info' || toolName === 'draw-lottery') {
      const lottery = parseLotteryInfo(rawText);
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div
            style={{
              padding: '20px',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div className="font-m" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                {lottery.title}
              </div>
              <span className="apple-badge apple-badge-gold">{lottery.status}</span>
            </div>

            <div style={{ display: 'flex', gap: '20px' }}>
              {lottery.costPoints && (
                <div>
                  <span className="font-s" style={{ color: 'var(--text-tertiary)' }}>每次消耗: </span>
                  <span className="font-s font-mono" style={{ color: 'var(--accent-gold)', fontWeight: 500 }}>
                    {lottery.costPoints} 积分
                  </span>
                </div>
              )}
              {lottery.remainingChances !== undefined && (
                <div>
                  <span className="font-s" style={{ color: 'var(--text-tertiary)' }}>剩余抽奖次数: </span>
                  <span className="font-s font-mono" style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                    {lottery.remainingChances} 次
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="apple-code-block">{rawText}</div>
        </div>
      );
    }

    if (toolName === 'order-list' || toolName === 'mall-order-list') {
      const orders = parseOrderList(rawText);
      if (orders.length === 0) {
        return <div className="apple-code-block">{rawText}</div>;
      }

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="apple-badge apple-badge-gold">
            <Icon name="scroll" size={12} />
            共 {orders.length} 笔订单记录
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
            {orders.map((order, idx) => (
              <div
                key={idx}
                style={{
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className="font-s font-mono" style={{ color: 'var(--accent-gold)' }}>
                    #{order.orderId}
                  </span>
                  {order.status && <span className="apple-badge">{order.status}</span>}
                </div>

                {order.storeName && (
                  <div className="font-m" style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                    {order.storeName}
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
                  <span className="font-s" style={{ color: 'var(--text-tertiary)' }}>
                    {order.createTime || ''}
                  </span>
                  {order.totalAmount && (
                    <span className="font-m font-mono" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {order.totalAmount}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="apple-code-block" style={{ whiteSpace: 'pre-wrap' }}>
        {rawText || jsonString}
      </div>
    );
  };

  return (
    <div className="frosted-card" style={{ padding: '20px', marginTop: '24px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          paddingBottom: '16px',
          borderBottom: '1px solid var(--border-subtle)',
          marginBottom: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="font-l" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
            执行响应结果
          </span>
          <span className="font-s font-mono apple-badge" style={{ color: 'var(--accent-gold)' }}>
            {toolName}
          </span>
          {durationMs !== undefined && (
            <span className="apple-badge font-mono">
              <Icon name="clock" size={11} />
              {durationMs}ms
            </span>
          )}
          {timestamp && (
            <span className="font-s" style={{ color: 'var(--text-tertiary)' }}>
              {timestamp}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="segmented-control">
            <button
              type="button"
              className={`segmented-item ${viewMode === 'visual' ? 'active' : ''}`}
              onClick={() => setViewMode('visual')}
            >
              <Icon name="sparkles" size={13} />
              可视化
            </button>
            <button
              type="button"
              className={`segmented-item ${viewMode === 'raw' ? 'active' : ''}`}
              onClick={() => setViewMode('raw')}
            >
              <Icon name="terminal" size={13} />
              原始数据
            </button>
          </div>

          <button
            type="button"
            onClick={handleCopy}
            className="apple-btn-secondary"
            title="复制完整 JSON 响应"
          >
            <Icon name={copied ? 'check' : 'copy'} size={13} />
            {copied ? '已复制' : '复制 JSON'}
          </button>
        </div>
      </div>

      {layers && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '16px',
            padding: '10px 14px',
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <span className="font-s" style={{ color: 'var(--text-tertiary)', fontWeight: 500 }}>
            状态分层判定:
          </span>
          <span className={`apple-badge ${layers.transport.success ? 'apple-badge-success' : 'apple-badge-error'}`}>
            传输: HTTP {layers.transport.status} {layers.transport.success ? '成功' : '失败'}
          </span>
          <span className={`apple-badge ${layers.rpc.success ? 'apple-badge-success' : 'apple-badge-error'}`}>
            JSON-RPC: {layers.rpc.success ? '协议正常' : '协议错误'}
          </span>
          <span className={`apple-badge ${layers.tool.success ? 'apple-badge-success' : 'apple-badge-error'}`}>
            工具执行: {layers.tool.success ? '正常' : '失败 (isError: true)'}
          </span>
          <span
            className={`apple-badge ${
              layers.business.outcome === 'full_success'
                ? 'apple-badge-success'
                : layers.business.outcome === 'partial_success'
                ? 'apple-badge-gold'
                : layers.business.outcome === 'failure'
                ? 'apple-badge-error'
                : layers.business.outcome === 'unknown'
                ? 'apple-badge-warning'
                : 'apple-badge'
            }`}
          >
            业务结果:{' '}
            {layers.business.outcome === 'full_success'
              ? '完全成功'
              : layers.business.outcome === 'partial_success'
              ? '部分成功'
              : layers.business.outcome === 'failure'
              ? '业务失败'
              : layers.business.outcome === 'unknown'
              ? '结果未知'
              : '常规完成'}
          </span>
        </div>
      )}

      {viewMode === 'visual' ? renderStructuredContent() : <div className="apple-code-block">{jsonString}</div>}
    </div>
  );
};
