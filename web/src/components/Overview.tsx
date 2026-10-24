import React, { useState } from 'react';
import {
  StickyNote,
  Archive,
  Blocks,
  Palette,
  Plus,
  ChevronRight,
  Eye,
  EyeOff,
} from 'lucide-react';
import { NoteItem, AppConfig, PetState } from '../types';
import {
  MetricCard,
  SectionHeader,
  EmptyState,
  CopySnippet,
} from './common';

interface OverviewProps {
  notes: NoteItem[];
  config: AppConfig;
  petState: PetState | null;
  onNavigateToTab: (tab: 'notes' | 'plugins' | 'settings') => void;
  onCreateNote: (title: string, content: string) => Promise<void>;
  onTriggerPetAction: (action: string) => void;
  onToggleTheme: () => void;
  onUpdatePetScale: (scale: number) => void;
  onTogglePetVisibility: () => void;
}

const PET_ACTIONS = [
  { id: 'eating_burger', name: '吃汉堡', emoji: '🍔' },
  { id: 'eating_fries', name: '吃薯条', emoji: '🍟' },
  { id: 'drinking_cola', name: '喝可乐', emoji: '🥤' },
  { id: 'wave', name: '挥手', emoji: '👋' },
  { id: 'jump', name: '跳跃', emoji: '✨' },
  { id: 'idle', name: '待机', emoji: '💤' },
];

const SCALE_PRESETS = [0.6, 0.8, 1.0, 1.2, 1.5];

const CLI_COMMANDS = [
  'mcd-desktop-pet note create --text "明天下午两点开会"',
  'mcd-desktop-pet note list --status active',
  'mcd-desktop-pet status',
];

export const Overview: React.FC<OverviewProps> = ({
  notes,
  config,
  petState,
  onNavigateToTab,
  onCreateNote,
  onTriggerPetAction,
  onToggleTheme,
  onUpdatePetScale,
  onTogglePetVisibility,
}) => {
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const safeNotes = Array.isArray(notes) ? notes : [];
  const activeNotes = safeNotes.filter((n) => n.status === 'active');
  const archivedNotes = safeNotes.filter((n) => n.status === 'archived');
  const recentNotes = [...safeNotes].slice(0, 4);

  const handleQuickCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim() || isSubmitting) return;

    try {
      setIsSubmitting(true);
      await onCreateNote(newTitle.trim(), newContent.trim());
      setNewTitle('');
      setNewContent('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isMcD = config.theme === 'mcdonalds';
  const isPetVisible = petState?.is_visible !== false;
  const currentScale = petState?.scale || 1.0;

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top 4 Metrics Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <MetricCard
          title="活动便签"
          value={activeNotes.length}
          subtitle="支持无缝拖拽、缩放与图文混排"
          icon={<StickyNote size={17} color="var(--mcd-gold)" />}
          iconBg="var(--mcd-gold-soft)"
          badge={{ text: '悬浮桌面中', colorClass: 'badge-gold' }}
          onClick={() => onNavigateToTab('notes')}
        />

        <MetricCard
          title="已出餐归档"
          value={archivedNotes.length}
          subtitle="随时支持一键重新“贴回桌面”"
          icon={<Archive size={17} />}
          badge={{ text: '已安全存盘', colorClass: 'badge-neutral' }}
          onClick={() => onNavigateToTab('notes')}
        />

        <MetricCard
          title="插件与插槽"
          value="5 / 5"
          subtitle="Menu · Render · Event · CLI · Skill"
          icon={<Blocks size={17} color="#c084fc" />}
          iconBg="var(--status-purple-soft)"
          badge={{ text: '5-Slot 规范就绪', colorClass: 'badge-purple' }}
          onClick={() => onNavigateToTab('plugins')}
        />

        <MetricCard
          title="当前外观皮肤"
          value={isMcD ? '🍟 麦当劳限定' : '✨ 极简纯净'}
          subtitle={isMcD ? '热敏小票便签 · 红黄美学 · 微音效' : '办公专注 · 纯净卡片 · 现代灰白'}
          icon={<Palette size={17} />}
          action={
            <button
              onClick={onToggleTheme}
              className="btn-secondary"
              style={{ padding: '4px 8px', fontSize: '11px' }}
              title="一键切换皮肤"
            >
              <Palette size={13} />
              <span>切换</span>
            </button>
          }
        />
      </div>

      {/* Main 2-Column Content */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.25fr) minmax(0, 1fr)', gap: '24px' }}>
        {/* Left Column: Quick Post & Recent Stream */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Quick Note Card */}
          <div className="glass-card" style={{ padding: '24px' }}>
            <SectionHeader
              icon="📝"
              title="快速发布便利贴"
              subtitle="直达屏幕浮动"
            />

            <form onSubmit={handleQuickCreate} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input
                type="text"
                placeholder="便签标题（可选，如：开会日程 / 麦辣鸡腿堡套餐）"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="input-field"
              />
              <textarea
                placeholder="记录待办、灵感备忘或粘贴文字... (内容将即时贴在桌面屏幕上)"
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                rows={3}
                className="input-field"
                style={{ resize: 'vertical', minHeight: '80px' }}
              />

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-subtle)' }}>
                  创建后自动生成流水编号，并同步存盘
                </span>
                <button
                  type="submit"
                  disabled={!newContent.trim() || isSubmitting}
                  className="btn-primary"
                >
                  <Plus size={15} />
                  <span>{isSubmitting ? '正在出餐...' : '贴到桌面'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Recent Notes Stream */}
          <div className="glass-card" style={{ padding: '24px' }}>
            <SectionHeader
              icon="📜"
              title="最近便签记录"
              action={
                <button
                  onClick={() => onNavigateToTab('notes')}
                  className="btn-secondary"
                  style={{ padding: '4px 10px', fontSize: '12px' }}
                >
                  <span>查看便签盒</span>
                  <ChevronRight size={13} />
                </button>
              }
            />

            {recentNotes.length === 0 ? (
              <EmptyState
                icon="🍟"
                title="暂无便签记录"
                description="点击上方快速发布你的第一张便利贴吧"
                compact
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {recentNotes.map((note) => (
                  <div
                    key={note.id}
                    style={{
                      background: 'var(--bg-card-elevated)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '12px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                        <span className="badge badge-gold" style={{ fontSize: '10px', padding: '1px 5px' }}>
                          {note.order_number || '#001'}
                        </span>
                        <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {note.title || '便签备忘'}
                        </span>
                        <span className={`badge ${note.status === 'active' ? 'badge-green' : 'badge-neutral'}`} style={{ fontSize: '10px' }}>
                          {note.status === 'active' ? '桌面中' : '已归档'}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {note.content}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Pet Control Deck & CLI Reference */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Pet Control Deck */}
          <div className="glass-card" style={{ padding: '24px' }}>
            <SectionHeader
              icon="🐾"
              title="桌宠实时控制舱"
              action={
                <button
                  onClick={onTogglePetVisibility}
                  className="btn-secondary"
                  style={{ padding: '4px 8px', fontSize: '12px' }}
                >
                  {isPetVisible ? <EyeOff size={13} /> : <Eye size={13} />}
                  <span>{isPetVisible ? '隐藏全部' : '唤醒桌面'}</span>
                </button>
              }
            />

            {/* Action Buttons Grid */}
            <div style={{ marginBottom: '18px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-subtle)', marginBottom: '8px', fontWeight: 600 }}>
                互动动作点播：
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {PET_ACTIONS.map((act) => (
                  <button
                    key={act.id}
                    type="button"
                    className="btn-secondary"
                    style={{
                      padding: '8px 10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '12px',
                      justifyContent: 'center',
                    }}
                    onClick={() => onTriggerPetAction(act.id)}
                  >
                    <span>{act.emoji}</span>
                    <span>{act.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Scale Presets */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-subtle)', fontWeight: 600 }}>
                  桌宠缩放比例 (无气泡打扰)：
                </span>
                <span className="badge badge-gold">
                  {Math.round(currentScale * 100)}%
                </span>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {SCALE_PRESETS.map((sc) => {
                  const isCurrent = Math.abs(currentScale - sc) < 0.04;
                  return (
                    <button
                      key={sc}
                      type="button"
                      className="btn-secondary"
                      style={{
                        flex: 1,
                        padding: '6px 0',
                        fontSize: '12px',
                        background: isCurrent ? 'var(--mcd-gold)' : undefined,
                        color: isCurrent ? '#000' : undefined,
                        fontWeight: isCurrent ? 700 : 500,
                      }}
                      onClick={() => onUpdatePetScale(sc)}
                    >
                      {Math.round(sc * 100)}%
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* AI Agent & CLI Quick Reference */}
          <div className="glass-card" style={{ padding: '24px' }}>
            <SectionHeader
              icon="🤖"
              title="AI Agent & CLI 指令速查"
              action={<span className="badge badge-neutral">默认 JSON 输出</span>}
            />

            <p style={{ fontSize: '12px', color: 'var(--text-subtle)', marginBottom: '12px', lineHeight: 1.5 }}>
              支持 Claude Code / Cursor / Terminal 自动化调用，无参数运行等同于 start：
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {CLI_COMMANDS.map((cmd) => (
                <CopySnippet key={cmd} text={cmd} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Overview;
