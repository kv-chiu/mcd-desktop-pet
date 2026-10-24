import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar, NavTab } from './components/Sidebar';
import { Overview } from './components/Overview';
import { NotesView } from './components/NotesView';
import { PluginsView } from './components/PluginsView';
import { SettingsView } from './components/SettingsView';
import { NoteItem, AppConfig, PetState } from './types';
import { RotateCw, Plus } from 'lucide-react';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [config, setConfig] = useState<AppConfig>({
    theme: 'mcdonalds',
    port: 23301,
    auto_start: false,
    sound_enabled: true,
    volume: 80,
    pet_scale: 1.0,
  });
  const [petState, setPetState] = useState<PetState | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Sync tab from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    if (tabParam === 'notes' || tabParam === 'plugins' || tabParam === 'settings') {
      setActiveTab(tabParam as NavTab);
    }
    if (params.get('openSettings') === '1' || window.location.hash === '#settings') {
      setActiveTab('settings');
    }
  }, []);

  const fetchNotes = useCallback(async () => {
    try {
      const res = await fetch('/api/notes?status=all');
      if (res.ok) {
        const data = await res.json();
        setNotes(Array.isArray(data) ? data : []);
      }
    } catch {
      // offline or disconnected
    }
  }, []);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
      }
    } catch {
      // offline
    }
  }, []);

  const fetchPetState = useCallback(async () => {
    try {
      const res = await fetch('/api/pet/state');
      if (res.ok) {
        const data = await res.json();
        setPetState(data);
        setIsConnected(true);
      } else {
        setIsConnected(false);
      }
    } catch {
      setIsConnected(false);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([fetchNotes(), fetchConfig(), fetchPetState()]);
    setTimeout(() => setIsRefreshing(false), 300);
  }, [fetchNotes, fetchConfig, fetchPetState]);

  useEffect(() => {
    refreshAll();
    const interval = setInterval(fetchPetState, 4000);
    return () => clearInterval(interval);
  }, [refreshAll, fetchPetState]);

  const handleCreateNote = async (title: string, content: string) => {
    const res = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content }),
    });
    if (res.ok) {
      await fetchNotes();
    }
  };

  const handleArchiveNote = async (id: string) => {
    const res = await fetch(`/api/notes/${id}/archive`, { method: 'POST' });
    if (res.ok) {
      await fetchNotes();
    }
  };

  const handleRestoreNote = async (id: string) => {
    const res = await fetch(`/api/notes/${id}/restore`, { method: 'POST' });
    if (res.ok) {
      await fetchNotes();
    }
  };

  const handleDeleteNote = async (id: string) => {
    const res = await fetch(`/api/notes/${id}`, { method: 'DELETE' });
    if (res.ok) {
      await fetchNotes();
    }
  };

  const handleTriggerPetAction = async (action: string) => {
    await fetch('/api/pet/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    await fetchPetState();
  };

  const handleTogglePetVisibility = async () => {
    await fetch('/api/pet/visibility/toggle', { method: 'POST' });
    await fetchPetState();
  };

  const handleUpdateConfig = async (newConfig: Partial<AppConfig>) => {
    if (newConfig.theme) {
      await fetch('/api/config/theme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: newConfig.theme }),
      });
    }

    const merged = { ...config, ...newConfig };
    await fetch('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(merged),
    });

    setConfig(merged);
  };

  const handleToggleTheme = async () => {
    const nextTheme = config.theme === 'mcdonalds' ? 'pure' : 'mcdonalds';
    await handleUpdateConfig({ theme: nextTheme });
  };

  const handleUpdatePetScale = async (scale: number) => {
    await fetch('/api/pet/scale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scale }),
    });
    setPetState((prev) => (prev ? { ...prev, scale } : null));
    setConfig((prev) => ({ ...prev, pet_scale: scale }));
  };

  const handleGracefulShutdown = async () => {
    if (window.confirm('确认要退出桌面宠物与中枢后台服务吗？')) {
      await fetch('/api/system/exit', { method: 'POST' });
      alert('服务正在安全退出...');
    }
  };

  const getPageTitle = () => {
    switch (activeTab) {
      case 'overview':
        return { title: '系统概览工作台', subtitle: '实时状态监控 · 桌面宠物控制舱 · 快速记事' };
      case 'notes':
        return { title: '历史便签盒 (Sticky Notes)', subtitle: '桌面悬浮便利贴 · 历史归档流水 · 快速检索' };
      case 'plugins':
        return { title: '插件与插槽矩阵 (5-Slot Matrix)', subtitle: '五大插槽规范 · 模块契约 · 规范静态编译' };
      case 'settings':
        return { title: '偏好设置 (Preferences)', subtitle: '外观主题装配 · 桌宠缩放 · 音效 · 运行环境' };
    }
  };

  const { title, subtitle } = getPageTitle();

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-base)' }}>
      {/* Sidebar on the Left */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        petState={petState}
        notes={notes}
        isConnected={isConnected}
        onTogglePetVisibility={handleTogglePetVisibility}
        onTriggerQuickAction={handleTriggerPetAction}
      />

      {/* Main Content Area */}
      <div
        style={{
          marginLeft: '260px',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
        }}
      >
        {/* Top Header Bar */}
        <header
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 40,
            background: 'var(--bg-glass)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderBottom: '1px solid var(--border)',
            padding: '16px 36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
              {title}
            </h1>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-subtle)' }}>
              {subtitle}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              className={`badge ${isConnected ? 'badge-green' : 'badge-red'}`}
              style={{ fontSize: '11px', padding: '4px 10px' }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: isConnected ? 'var(--status-green)' : 'var(--mcd-red)',
                }}
              />
              <span>{isConnected ? '中枢在线 :23301' : '中枢离线'}</span>
            </span>

            <button
              type="button"
              onClick={refreshAll}
              className="btn-secondary"
              style={{ padding: '6px 12px', fontSize: '12px' }}
              title="刷新全部数据"
            >
              <RotateCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
              <span>刷新</span>
            </button>

            {activeTab !== 'notes' && (
              <button
                type="button"
                onClick={() => setActiveTab('notes')}
                className="btn-primary"
                style={{ padding: '6px 14px', fontSize: '12px' }}
              >
                <Plus size={14} />
                <span>便签盒</span>
              </button>
            )}
          </div>
        </header>

        {/* View Content */}
        <main style={{ flex: 1, padding: '28px 36px 60px' }}>
          {activeTab === 'overview' && (
            <Overview
              notes={notes}
              config={config}
              petState={petState}
              onNavigateToTab={setActiveTab}
              onCreateNote={handleCreateNote}
              onTriggerPetAction={handleTriggerPetAction}
              onToggleTheme={handleToggleTheme}
              onUpdatePetScale={handleUpdatePetScale}
              onTogglePetVisibility={handleTogglePetVisibility}
            />
          )}

          {activeTab === 'notes' && (
            <NotesView
              notes={notes}
              config={config}
              onRefresh={fetchNotes}
              onCreateNote={handleCreateNote}
              onArchiveNote={handleArchiveNote}
              onRestoreNote={handleRestoreNote}
              onDeleteNote={handleDeleteNote}
            />
          )}

          {activeTab === 'plugins' && (
            <PluginsView
              onTriggerQuickAction={handleTriggerPetAction}
              onNavigateToNotes={() => setActiveTab('notes')}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              config={config}
              petState={petState}
              onUpdateConfig={handleUpdateConfig}
              onUpdatePetScale={handleUpdatePetScale}
              onGracefulShutdown={handleGracefulShutdown}
            />
          )}
        </main>

        {/* Footer */}
        <footer
          style={{
            padding: '20px 36px',
            borderTop: '1px solid var(--border)',
            background: 'var(--bg-sidebar)',
            fontSize: '12px',
            color: 'var(--text-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            <span>麦当劳便利贴桌面宠物 (Sticky Note Desktop Pet)</span>
            <span style={{ margin: '0 8px' }}>·</span>
            <span>5-Slot 扩展架构规范</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Go 1.24 宿主</span>
            <span>·</span>
            <span>React 19 SPA</span>
            <span>·</span>
            <span>Godot 4.x 表现层</span>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default App;
