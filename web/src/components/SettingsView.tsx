import React, { useState } from 'react';
import {
  Palette,
  Maximize2,
  Volume2,
  VolumeX,
  Power,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { AppConfig, PetState } from '../types';
import { SectionHeader, CopySnippet } from './common';

interface SettingsViewProps {
  config: AppConfig;
  petState: PetState | null;
  onUpdateConfig: (newConfig: Partial<AppConfig>) => Promise<void>;
  onUpdatePetScale: (scale: number) => void;
  onGracefulShutdown: () => void;
}

const THEME_OPTIONS = [
  {
    id: 'mcdonalds' as const,
    name: '麦当劳限定主题',
    tag: 'mcdonalds (比赛默认)',
    emoji: '🍟',
    activeColor: 'var(--mcd-gold)',
    bgActive: 'rgba(255, 199, 44, 0.05)',
    badgeClass: 'badge-gold',
    desc: '以“麦当劳热敏小票”为拟物便签纸质，底部带锯齿撕纸边；右键菜单采用红黄点餐牌皮肤，融合趣味微音效与汉堡配饰。',
  },
  {
    id: 'pure' as const,
    name: '极简纯净主题',
    tag: 'pure (办公专注)',
    emoji: '✨',
    activeColor: 'var(--status-blue)',
    bgActive: 'rgba(59, 130, 246, 0.05)',
    badgeClass: 'badge-blue',
    desc: '回归纯粹的现代圆角办公便利贴，极简纯白卡片，平整边框收边，右键菜单采用毛玻璃卡片，零商业元素，清爽专注。',
  },
];

const SCALE_PRESETS = [
  { label: '60% 迷你', scale: 0.6 },
  { label: '80% 小巧', scale: 0.8 },
  { label: '100% 标准', scale: 1.0 },
  { label: '120% 醒目', scale: 1.2 },
  { label: '150% 特大', scale: 1.5 },
  { label: '200% 巨型', scale: 2.0 },
];

export const SettingsView: React.FC<SettingsViewProps> = ({
  config,
  petState,
  onUpdateConfig,
  onUpdatePetScale,
  onGracefulShutdown,
}) => {
  const [localVolume, setLocalVolume] = useState(config.volume ?? 80);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const currentScale = petState?.scale ?? config.pet_scale ?? 1.0;

  const handleThemeChange = async (theme: 'mcdonalds' | 'pure') => {
    if (config.theme === theme) return;
    try {
      await onUpdateConfig({ theme });
      setSaveStatus('主题已切换生效');
      setTimeout(() => setSaveStatus(null), 2500);
    } catch {
      // Fallback
    }
  };

  const handleScaleChange = (scale: number) => {
    onUpdatePetScale(scale);
    setSaveStatus('尺寸比例已调整');
    setTimeout(() => setSaveStatus(null), 2000);
  };

  const handleSoundToggle = async () => {
    const nextVal = !config.sound_enabled;
    await onUpdateConfig({ sound_enabled: nextVal });
  };

  const handleVolumeChange = async (val: number) => {
    setLocalVolume(val);
    await onUpdateConfig({ volume: val });
  };

  const handleAutoStartToggle = async () => {
    const nextVal = !config.auto_start;
    await onUpdateConfig({ auto_start: nextVal });
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '900px' }}>
      {/* Settings Header Banner */}
      <div
        className="glass-card"
        style={{
          padding: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontSize: '20px' }}>⚙️</span>
            <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
              偏好设置 (Preferences & Configuration)
            </h2>
          </div>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-subtle)' }}>
            实时调节桌宠外观主题、渲染体积、交互音效与系统运行参数
          </p>
        </div>

        {saveStatus && (
          <span className="badge badge-green animate-fade-in" style={{ padding: '6px 12px', fontSize: '12px' }}>
            <Check size={13} />
            <span>{saveStatus}</span>
          </span>
        )}
      </div>

      {/* Section 1: Appearance Theme Switcher */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <SectionHeader
          icon={<Palette size={18} color="var(--mcd-gold)" />}
          title="外观主题 (Appearance Theme)"
          subtitle="系统全面遵循“UI 元素骨架与视觉主题分离”规范，所有业务功能项与插槽完全保持一致，仅外观皮肤即时无缝换肤"
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          {THEME_OPTIONS.map((item) => {
            const isActive = config.theme === item.id;
            return (
              <div
                key={item.id}
                onClick={() => handleThemeChange(item.id)}
                style={{
                  borderRadius: 'var(--radius-md)',
                  border: isActive ? `2px solid ${item.activeColor}` : '1px solid var(--border)',
                  background: isActive ? item.bgActive : 'var(--bg-card-elevated)',
                  padding: '18px',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'all 0.18s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '22px' }}>{item.emoji}</span>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text-main)' }}>{item.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-subtle)' }}>{item.tag}</div>
                    </div>
                  </div>
                  {isActive && (
                    <span className={`badge ${item.badgeClass}`}>
                      <Check size={12} /> 当前激活
                    </span>
                  )}
                </div>

                <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
                  {item.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 2: Pet Scale */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <SectionHeader
          icon={<Maximize2 size={18} color="var(--mcd-gold)" />}
          title="桌宠显示比例 (Pet Scale)"
          action={
            <span className="badge badge-gold" style={{ fontSize: '13px', padding: '4px 10px' }}>
              {Math.round(currentScale * 100)}%
              <span style={{ fontSize: '11px', opacity: 0.8, marginLeft: '6px' }}>
                ({Math.round(320 * currentScale)} × {Math.round(320 * currentScale)} px)
              </span>
            </span>
          }
        />

        {/* Range Slider */}
        <div style={{ marginBottom: '18px' }}>
          <input
            type="range"
            min="50"
            max="200"
            step="5"
            value={Math.round(currentScale * 100)}
            onChange={(e) => handleScaleChange(Number(e.target.value) / 100)}
            style={{
              width: '100%',
              height: '6px',
              borderRadius: '4px',
              outline: 'none',
              cursor: 'pointer',
              accentColor: 'var(--mcd-gold)',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-subtle)', marginTop: '4px' }}>
            <span>50% (迷你 160px)</span>
            <span>100% (标准 320px)</span>
            <span>200% (巨型 640px)</span>
          </div>
        </div>

        {/* Preset Pills */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '8px' }}>
          {SCALE_PRESETS.map((p) => {
            const isSelected = Math.abs(currentScale - p.scale) < 0.04;
            return (
              <button
                key={p.scale}
                type="button"
                className="btn-secondary"
                style={{
                  background: isSelected ? 'var(--mcd-gold)' : undefined,
                  color: isSelected ? '#000' : undefined,
                  fontWeight: isSelected ? 700 : 500,
                  fontSize: '12px',
                  padding: '8px 0',
                }}
                onClick={() => handleScaleChange(p.scale)}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Section 3: Audio & Sound */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <SectionHeader
          icon={config.sound_enabled ? <Volume2 size={18} color="var(--mcd-gold)" /> : <VolumeX size={18} color="var(--text-subtle)" />}
          title="交互音效 (Audio FX)"
          subtitle="撕纸小票声、出餐印章声与桌宠互动音效"
          action={
            <button
              type="button"
              className="btn-secondary"
              onClick={handleSoundToggle}
              style={{
                background: config.sound_enabled ? 'var(--status-green-soft)' : undefined,
                color: config.sound_enabled ? 'var(--status-green)' : undefined,
                borderColor: config.sound_enabled ? 'rgba(16, 185, 129, 0.3)' : undefined,
              }}
            >
              {config.sound_enabled ? '已开启' : '已静音'}
            </button>
          }
        />

        {config.sound_enabled && (
          <div style={{ marginTop: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>
              <span>音量大小</span>
              <span>{localVolume}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={localVolume}
              onChange={(e) => handleVolumeChange(Number(e.target.value))}
              style={{
                width: '100%',
                height: '6px',
                borderRadius: '4px',
                outline: 'none',
                cursor: 'pointer',
                accentColor: 'var(--mcd-gold)',
              }}
            />
          </div>
        )}
      </div>

      {/* Section 4: System & Self-Healing */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <SectionHeader
          icon={<ShieldCheck size={18} color="var(--mcd-gold)" />}
          title="系统与自愈机制 (System & Environment)"
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--bg-card-elevated)', borderRadius: 'var(--radius-sm)' }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>开机自动启动</div>
              <div style={{ fontSize: '11px', color: 'var(--text-subtle)' }}>系统登录后自动在后台拉起中枢服务与桌宠本体</div>
            </div>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleAutoStartToggle}
              style={{
                background: config.auto_start ? 'var(--mcd-gold)' : undefined,
                color: config.auto_start ? '#000' : undefined,
              }}
            >
              {config.auto_start ? '已开启自启' : '未开启'}
            </button>
          </div>

          <div style={{ padding: '12px 14px', background: 'var(--bg-card-elevated)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '2px' }}>命令行软链接自愈 (Self-Healing PATH)</div>
            <div style={{ fontSize: '11px', color: 'var(--text-subtle)', marginBottom: '8px' }}>
              每次运行时自动校验物理路径，并在用户目录建立软链接，保证终端与 AI Agent 调用永不失效：
            </div>
            <CopySnippet text="~/.local/bin/mcd-desktop-pet → 当前执行二进制物理路径" />
          </div>
        </div>

        {/* Graceful Exit */}
        <div style={{ marginTop: '24px', paddingTop: '18px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--mcd-red)' }}>退出服务与桌宠</div>
            <div style={{ fontSize: '11px', color: 'var(--text-subtle)' }}>优雅终止 Go 中枢后台进程及 Godot 桌面渲染窗口</div>
          </div>
          <button
            type="button"
            onClick={onGracefulShutdown}
            className="btn-secondary"
            style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
          >
            <Power size={14} />
            <span>安全退出</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsView;
