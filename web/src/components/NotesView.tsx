import React, { useState } from 'react';
import {
  Search,
  Plus,
  Archive,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { NoteItem, AppConfig } from '../types';
import {
  Modal,
  NoteCard,
  FilterTabs,
  FilterTabItem,
  EmptyState,
} from './common';

interface NotesViewProps {
  notes: NoteItem[];
  config: AppConfig;
  onRefresh: () => void;
  onCreateNote: (title: string, content: string) => Promise<void>;
  onArchiveNote: (id: string) => Promise<void>;
  onRestoreNote: (id: string) => Promise<void>;
  onDeleteNote: (id: string) => Promise<void>;
}

type FilterType = 'all' | 'active' | 'archived';

export const NotesView: React.FC<NotesViewProps> = ({
  notes,
  config,
  onRefresh,
  onCreateNote,
  onArchiveNote,
  onRestoreNote,
  onDeleteNote,
}) => {
  const [filter, setFilter] = useState<FilterType>('all');
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedNote, setSelectedNote] = useState<NoteItem | null>(null);

  const isMcD = config.theme === 'mcdonalds';
  const safeNotes = Array.isArray(notes) ? notes : [];
  const activeCount = safeNotes.filter((n) => n.status === 'active').length;
  const archivedCount = safeNotes.filter((n) => n.status === 'archived').length;

  const filterTabs: FilterTabItem<FilterType>[] = [
    { id: 'all', label: '全部便签', count: safeNotes.length },
    { id: 'active', label: '桌面活动', count: activeCount },
    { id: 'archived', label: '已归档', count: archivedCount },
  ];

  const filteredNotes = safeNotes.filter((note) => {
    const matchFilter = filter === 'all' || note.status === filter;
    const q = search.toLowerCase();
    const matchSearch =
      (note.title || '').toLowerCase().includes(q) ||
      (note.content || '').toLowerCase().includes(q) ||
      (note.order_number || '').toLowerCase().includes(q);
    return matchFilter && matchSearch;
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim() || isSubmitting) return;

    try {
      setIsSubmitting(true);
      await onCreateNote(newTitle.trim(), newContent.trim());
      setNewTitle('');
      setNewContent('');
      setShowCreateModal(false);
      onRefresh();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Filter & Action Bar */}
      <div
        className="glass-card"
        style={{
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        {/* Left: Segmented Filter Tabs */}
        <FilterTabs
          tabs={filterTabs}
          activeId={filter}
          onChange={setFilter}
        />

        {/* Right: Search & New Note Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
              placeholder="搜索流水号、标题或内容..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field"
              style={{ paddingLeft: '32px', height: '36px' }}
            />
          </div>

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="btn-primary"
            style={{ height: '36px' }}
          >
            <Plus size={16} />
            <span>新建便利贴</span>
          </button>
        </div>
      </div>

      {/* Notes Grid or Empty State */}
      {filteredNotes.length === 0 ? (
        <div className="glass-card">
          <EmptyState
            icon="📦"
            title="没有匹配的便利贴"
            description={
              search
                ? '尝试调整搜索关键词，或者清除筛选条件'
                : '你的便签盒目前是空的，点击右上角新建第一张桌面便利贴吧！'
            }
            action={
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn-primary"
              >
                <Plus size={15} />
                <span>新建便利贴</span>
              </button>
            }
          />
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '20px',
          }}
        >
          {filteredNotes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              isMcD={isMcD}
              onSelect={setSelectedNote}
              onArchive={onArchiveNote}
              onRestore={onRestoreNote}
              onDelete={onDeleteNote}
            />
          ))}
        </div>
      )}

      {/* Create Note Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="新建便利贴 (New Note)"
        icon="📝"
        maxWidth="500px"
      >
        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
              便签标题 (可选)
            </label>
            <input
              type="text"
              placeholder="例如：明日开会备忘 / 麦麦特惠餐"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="input-field"
              autoFocus
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
              正文内容 <span style={{ color: 'var(--mcd-red)' }}>*</span>
            </label>
            <textarea
              placeholder="写下备忘内容... 将直接悬浮显示在桌面屏幕上"
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              rows={5}
              className="input-field"
              style={{ resize: 'vertical' }}
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="btn-secondary"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={!newContent.trim() || isSubmitting}
              className="btn-primary"
            >
              <Plus size={15} />
              <span>{isSubmitting ? '正在出餐...' : '出餐并贴到桌面'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Note Detail Modal */}
      <Modal
        isOpen={Boolean(selectedNote)}
        onClose={() => setSelectedNote(null)}
        title={
          selectedNote && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="badge badge-gold">{selectedNote.order_number}</span>
              <span style={{ fontSize: '16px' }}>{selectedNote.title || '便签备忘'}</span>
            </div>
          )
        }
        maxWidth="540px"
      >
        {selectedNote && (
          <div>
            <div
              style={{
                background: 'var(--bg-base)',
                borderRadius: 'var(--radius-sm)',
                padding: '16px',
                fontSize: '14px',
                lineHeight: 1.7,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                color: 'var(--text-main)',
                maxHeight: '300px',
                overflowY: 'auto',
                marginBottom: '16px',
                border: '1px solid var(--border)',
              }}
            >
              {selectedNote.content}
            </div>

            <div style={{ fontSize: '11px', color: 'var(--text-subtle)', display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '20px' }}>
              <div>便签 ID: <code style={{ color: 'var(--text-muted)' }}>{selectedNote.id}</code></div>
              <div>创建时间: {new Date(selectedNote.created_at).toLocaleString()}</div>
              <div>更新时间: {new Date(selectedNote.updated_at).toLocaleString()}</div>
              {selectedNote.archived_at && <div>归档时间: {new Date(selectedNote.archived_at).toLocaleString()}</div>}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              {selectedNote.status === 'active' ? (
                <button
                  onClick={async () => {
                    await onArchiveNote(selectedNote.id);
                    setSelectedNote(null);
                  }}
                  className="btn-secondary"
                >
                  <Archive size={14} />
                  <span>出餐归档</span>
                </button>
              ) : (
                <button
                  onClick={async () => {
                    await onRestoreNote(selectedNote.id);
                    setSelectedNote(null);
                  }}
                  className="btn-secondary"
                >
                  <RotateCcw size={14} />
                  <span>贴回桌面</span>
                </button>
              )}

              <button
                onClick={async () => {
                  await onDeleteNote(selectedNote.id);
                  setSelectedNote(null);
                }}
                className="btn-secondary"
                style={{ color: '#ef4444' }}
              >
                <Trash2 size={14} />
                <span>彻底删除</span>
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default NotesView;
