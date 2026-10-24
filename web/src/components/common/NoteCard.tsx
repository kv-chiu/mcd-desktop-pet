import React from 'react';
import { Archive, RotateCcw, Trash2 } from 'lucide-react';
import { NoteItem } from '../../types';

interface NoteCardProps {
  note: NoteItem;
  isMcD: boolean;
  onSelect: (note: NoteItem) => void;
  onArchive: (id: string) => void;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
}

export const NoteCard: React.FC<NoteCardProps> = ({
  note,
  isMcD,
  onSelect,
  onArchive,
  onRestore,
  onDelete,
}) => {
  const isArchived = note.status === 'archived';

  return (
    <div
      style={{
        background: isMcD ? '#FFFDF8' : '#FFFFFF',
        color: '#27251F',
        borderRadius: '14px',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        transition: 'transform 0.18s ease, box-shadow 0.18s ease',
        border: isMcD ? '1px solid #EBE5D6' : '1px solid #E2E8F0',
      }}
    >
      {/* Note Header */}
      <div
        style={{
          padding: '14px 16px 10px',
          borderBottom: isMcD ? '1px dashed #E5DEC9' : '1px solid #F1F5F9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              background: isMcD ? '#DA291C' : '#F1F5F9',
              color: isMcD ? '#FFC72C' : '#475569',
              fontWeight: 900,
              fontSize: '11px',
              padding: '2px 6px',
              borderRadius: '4px',
              letterSpacing: isMcD ? '0.04em' : 'normal',
            }}
          >
            {note.order_number || '#001'}
          </span>

          <span style={{ fontSize: '11px', color: '#8C827A' }}>
            {new Date(note.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        <span
          style={{
            fontSize: '11px',
            fontWeight: 700,
            color: isArchived ? '#9CA3AF' : '#10B981',
            background: isArchived ? 'rgba(156, 163, 175, 0.15)' : 'rgba(16, 185, 129, 0.12)',
            padding: '2px 8px',
            borderRadius: '999px',
          }}
        >
          {isArchived ? '已出餐归档' : '桌面活动'}
        </span>
      </div>

      {/* Note Body */}
      <div
        style={{
          padding: '16px',
          flex: 1,
          cursor: 'pointer',
        }}
        onClick={() => onSelect(note)}
      >
        {note.title && (
          <div style={{ fontWeight: 800, fontSize: '15px', color: '#1F2937', marginBottom: '8px' }}>
            {note.title}
          </div>
        )}
        <div
          style={{
            fontSize: '13px',
            lineHeight: 1.6,
            color: '#374151',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            maxHeight: '140px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {note.content}
        </div>
      </div>

      {/* Stamp overlay if archived */}
      {isArchived && (
        <div
          style={{
            position: 'absolute',
            right: '18px',
            bottom: '50px',
            border: isMcD ? '3px solid #DA291C' : '3px solid #64748B',
            color: isMcD ? '#DA291C' : '#64748B',
            padding: '4px 10px',
            borderRadius: '8px',
            fontWeight: 900,
            fontSize: '14px',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            transform: 'rotate(-12deg)',
            pointerEvents: 'none',
            opacity: 0.85,
          }}
        >
          {isMcD ? 'DONE 已出餐' : 'COMPLETED ✓'}
        </div>
      )}

      {/* Note Footer Actions */}
      <div
        style={{
          padding: '10px 16px',
          background: isMcD ? '#FAF6EC' : '#F8FAFC',
          borderTop: isMcD ? '1px dashed #E5DEC9' : '1px solid #F1F5F9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ fontSize: '10px', color: '#9CA3AF', fontFamily: 'var(--font-mono)' }}>
          pos: [{note.position[0]}, {note.position[1]}]
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {isArchived ? (
            <button
              type="button"
              onClick={() => onRestore(note.id)}
              style={{
                background: '#E0F2FE',
                color: '#0284C7',
                border: 'none',
                borderRadius: '6px',
                padding: '4px 8px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <RotateCcw size={12} />
              <span>贴回桌面</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onArchive(note.id)}
              style={{
                background: '#FEF3C7',
                color: '#D97706',
                border: 'none',
                borderRadius: '6px',
                padding: '4px 8px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Archive size={12} />
              <span>出餐归档</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onDelete(note.id)}
            style={{
              background: '#FEE2E2',
              color: '#DC2626',
              border: 'none',
              borderRadius: '6px',
              padding: '4px 8px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
            title="彻底删除"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* McDonald's Tear Zigzag Effect */}
      {isMcD && (
        <div
          style={{
            height: '6px',
            background: 'repeating-linear-gradient(45deg, #FAF6EC, #FAF6EC 4px, #DA291C 4px, #DA291C 8px)',
            opacity: 0.8,
          }}
        />
      )}
    </div>
  );
};

export default NoteCard;
