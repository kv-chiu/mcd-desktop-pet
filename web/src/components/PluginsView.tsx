import React, { useState, useEffect } from 'react';
import {
  Check,
  Copy,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { PluginInfo } from '../types';
import { SlotBadge, SectionHeader } from './common';

interface PluginsViewProps {
  onTriggerQuickAction: (action: string) => void;
  onNavigateToNotes: () => void;
}

const CATEGORIES = [
  { id: 'all', label: '全部分类' },
  { id: 'productivity', label: '便签生产力' },
  { id: 'companion', label: '情感陪伴' },
  { id: 'ai', label: 'AI Agent' },
  { id: 'business', label: '业务扩展' },
  { id: 'system', label: '系统服务' },
];

const CATEGORY_MAP: Record<string, { label: string; badgeClass: string }> = {
  productivity: { label: '便签生产力', badgeClass: 'badge-gold' },
  companion: { label: '情感陪伴', badgeClass: 'badge-blue' },
  ai: { label: 'AI Agent', badgeClass: 'badge-purple' },
  business: { label: '业务扩展', badgeClass: 'badge-red' },
  system: { label: '系统服务', badgeClass: 'badge-neutral' },
};

const SLOT_SPECS = [
  {
    num: 1,
    id: 'menu',
    name: 'Menu Slot',
    title: '右键菜单插槽',
    desc: '统一注册右键菜单项与快捷键；Godot 依据注册结果及当前主题皮肤动态渲染。',
  },
  {
    num: 2,
    id: 'render',
    name: 'Render Slot',
    title: '桌面渲染插槽',
    desc: '统一注册桌面透明置顶窗口与元素模板，包括桌宠本体、悬浮便签与气泡容器。',
  },
  {
    num: 3,
    id: 'event',
    name: 'Event Slot',
    title: '通信与事件插槽',
    desc: '通过 WebSocket Event Hub 广播跨端事件；解耦动作指令与表现层播放反馈。',
  },
  {
    num: 4,
    id: 'cli',
    name: 'CLI Slot',
    title: '命令行命令插槽',
    desc: '统一注册 CLI 子命令，默认输出干净标准 JSON，保留标准错误用于日志输出。',
  },
  {
    num: 5,
    id: 'skill',
    name: 'Skill Slot',
    title: 'AI 技能插槽',
    desc: '面向 AI Agent 统一注册自然语言意图映射规范，汇总生成标准 `SKILL.md`。',
  },
];

const PLUGIN_ICONS: Record<string, string> = {
  sticky_notes: '📝',
  'sticky-notes': '📝',
  desktop_pet: '🐾',
  'desktop-pet': '🐾',
  agent_skills: '🤖',
  'agent-skills': '🤖',
  mcd_mcp: '🍟',
  'mcdonalds-mcp': '🍟',
  system_tray: '🪟',
  'tray-control': '🪟',
};

export const PluginsView: React.FC<PluginsViewProps> = ({
  onTriggerQuickAction,
  onNavigateToNotes,
}) => {
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetchPlugins();
  }, []);

  const fetchPlugins = async () => {
    try {
      const res = await fetch('/api/plugins');
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data)
          ? data
          : data && Array.isArray(data.plugins)
          ? data.plugins
          : [];
        setPlugins(list);
      }
    } catch {
      setPlugins([]);
    }
  };

  const copyText = (txt: string, id: string) => {
    navigator.clipboard.writeText(txt);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const safePlugins = Array.isArray(plugins) ? plugins : [];
  const filteredPlugins = safePlugins.filter((p) => {
    const q = search.toLowerCase();
    const matchSearch =
      (p.name || '').toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q) ||
      (p.id || '').toLowerCase().includes(q);
    const matchCat = categoryFilter === 'all' || p.category === categoryFilter;
    return matchSearch && matchCat;
  });

  const renderActionButtons = (plugin: PluginInfo) => {
    const id = plugin.id;
    if (id === 'sticky_notes' || id === 'sticky-notes') {
      return (
        <button
          onClick={onNavigateToNotes}
          className="btn-secondary"
          style={{ padding: '4px 8px', fontSize: '11px' }}
        >
          打开便签盒
        </button>
      );
    }
    if (id === 'desktop_pet' || id === 'desktop-pet') {
      return (
        <button
          onClick={() => onTriggerQuickAction('eating_burger')}
          className="btn-secondary"
          style={{ padding: '4px 8px', fontSize: '11px' }}
        >
          🍔 喂食测试
        </button>
      );
    }
    if (id === 'agent_skills' || id === 'agent-skills') {
      return (
        <button
          onClick={() => copyText('mcd-desktop-pet note list --status active', 'cli-list')}
          className="btn-secondary"
          style={{ padding: '4px 8px', fontSize: '11px' }}
        >
          {copiedId === 'cli-list' ? <Check size={11} /> : <Copy size={11} />}
          <span>{copiedId === 'cli-list' ? '已复制' : 'CLI 语法'}</span>
        </button>
      );
    }
    if (id === 'mcd_mcp' || id === 'mcdonalds-mcp') {
      return (
        <span className="badge badge-neutral" style={{ fontSize: '10px' }}>
          二期接入
        </span>
      );
    }
    if (id === 'system_tray' || id === 'tray-control') {
      return (
        <button
          onClick={() => onTriggerQuickAction('wave')}
          className="btn-secondary"
          style={{ padding: '4px 8px', fontSize: '11px' }}
        >
          👋 托盘互动
        </button>
      );
    }
    return null;
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Banner with Search & Filter */}
      <div
        className="glass-card"
        style={{
          padding: '24px',
          background: 'linear-gradient(135deg, rgba(26,26,36,0.8) 0%, rgba(16,16,22,0.95) 100%)',
        }}
      >
        <SectionHeader
          icon="🧩"
          title="5-Slot 扩展架构 · 插件矩阵表格 (Data Table Matrix)"
          subtitle="通过标准契约注册的内置功能与扩展插件，各模块严格遵循 Menu, Render, Event, CLI, Skill 五大插槽规范"
          style={{ marginBottom: 0 }}
          action={
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ position: 'relative', width: '220px' }}>
                <Search
                  size={14}
                  style={{
                    position: 'absolute',
                    left: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-subtle)',
                  }}
                />
                <input
                  type="text"
                  placeholder="搜索插件或插槽..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="input-field"
                  style={{ paddingLeft: '32px', height: '36px' }}
                />
              </div>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="input-field"
                style={{ width: '130px', height: '36px', cursor: 'pointer' }}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
          }
        />
      </div>

      {/* The Data Table Matrix */}
      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '280px' }}>插件 / 功能模块</th>
              <th style={{ width: '110px' }}>架构类型</th>
              <th style={{ width: '260px' }}>挂载插槽 (5-Slot)</th>
              <th style={{ width: '110px' }}>运行状态</th>
              <th>核心指标 / 契约特性</th>
              <th style={{ width: '160px', textAlign: 'right' }}>快捷操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredPlugins.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-subtle)' }}>
                  未检索到匹配的插件条目
                </td>
              </tr>
            ) : (
              filteredPlugins.map((plugin) => {
                const cat = CATEGORY_MAP[plugin.category] || { label: plugin.category || '内置核心', badgeClass: 'badge-neutral' };

                return (
                  <tr key={plugin.id}>
                    {/* Column 1: Name & ID */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '24px', flexShrink: 0 }}>
                          {PLUGIN_ICONS[plugin.id] || '🧩'}
                        </span>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '14px' }}>
                              {plugin.name}
                            </span>
                            <span className="badge badge-neutral" style={{ fontSize: '10px' }}>
                              {plugin.version}
                            </span>
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-subtle)', marginTop: '2px', lineHeight: 1.4 }}>
                            {plugin.description}
                          </div>
                          <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-subtle)', marginTop: '2px' }}>
                            id: {plugin.id}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Column 2: Category */}
                    <td>
                      <span className={`badge ${cat.badgeClass}`}>
                        {cat.label}
                      </span>
                    </td>

                    {/* Column 3: Slots */}
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {plugin.slots.map((s) => (
                          <SlotBadge key={s} slot={s} />
                        ))}
                      </div>
                    </td>

                    {/* Column 4: Status */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: plugin.status === 'active' ? 'var(--status-green)' : 'var(--text-subtle)',
                          }}
                        />
                        <span style={{ fontSize: '12px', color: plugin.status === 'active' ? 'var(--status-green)' : 'var(--text-subtle)', fontWeight: 600 }}>
                          {plugin.status === 'active' ? '静态编译就绪' : '待命'}
                        </span>
                      </div>
                    </td>

                    {/* Column 5: Stats / Metadata */}
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', fontSize: '11px' }}>
                        {plugin.metadata &&
                          Object.entries(plugin.metadata).map(([k, v]) => (
                            <span
                              key={k}
                              style={{
                                background: 'rgba(255, 255, 255, 0.04)',
                                border: '1px solid var(--border)',
                                borderRadius: '4px',
                                padding: '2px 6px',
                                color: 'var(--text-muted)',
                                fontFamily: 'var(--font-mono)',
                              }}
                            >
                              {k}: <strong style={{ color: 'var(--text-main)' }}>{String(v)}</strong>
                            </span>
                          ))}
                      </div>
                    </td>

                    {/* Column 6: Actions */}
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                        {renderActionButtons(plugin)}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 5-Slot Architecture Reference */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <SectionHeader
          icon={<ShieldCheck size={18} color="var(--mcd-gold)" />}
          title="五大扩展插槽契约说明 (5-Slot Architecture Specification)"
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
          {SLOT_SPECS.map((slot) => (
            <div
              key={slot.id}
              style={{
                background: 'var(--bg-card-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '14px',
              }}
            >
              <SlotBadge slot={slot.id} style={{ marginBottom: '6px' }} />
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
                {slot.num}. {slot.title}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-subtle)', lineHeight: 1.5 }}>
                {slot.desc}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PluginsView;
