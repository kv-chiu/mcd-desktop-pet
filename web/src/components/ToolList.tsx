import React, { useState, useMemo } from 'react';
import { CATEGORIES, OFFICIAL_TOOLS } from '../services/toolRegistry';
import { ToolCategory, ToolMetadata } from '../types/mcp';
import { Icon } from './Icon';

interface ToolListProps {
  selectedToolId: string;
  onSelectTool: (tool: ToolMetadata) => void;
}

export const ToolList: React.FC<ToolListProps> = ({ selectedToolId, onSelectTool }) => {
  const [activeCategory, setActiveCategory] = useState<ToolCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTools = useMemo(() => {
    return OFFICIAL_TOOLS.filter((tool) => {
      const matchCategory = activeCategory === 'all' || tool.category === activeCategory;
      const query = searchQuery.trim().toLowerCase();
      const matchSearch =
        !query ||
        tool.name.toLowerCase().includes(query) ||
        tool.nameEn.toLowerCase().includes(query) ||
        tool.id.toLowerCase().includes(query) ||
        tool.description.toLowerCase().includes(query);

      return matchCategory && matchSearch;
    });
  }, [activeCategory, searchQuery]);

  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="font-l" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
            全部官方工具库
          </span>
          <span className="apple-badge apple-badge-gold">
            共 33 个接口
          </span>
        </div>

        <div style={{ width: '260px', position: 'relative' }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索工具名称 / ID / 描述..."
            className="apple-input font-s"
            style={{ paddingLeft: '30px' }}
          />
          <div style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }}>
            <Icon name="search" size={13} />
          </div>
        </div>
      </div>

      <div style={{ marginBottom: '16px', overflowX: 'auto', paddingBottom: '4px' }}>
        <div className="segmented-control">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              type="button"
              className={`segmented-item ${activeCategory === cat.key ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat.key)}
            >
              <Icon name={cat.icon} size={13} />
              <span>{cat.nameZh}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid-tools">
        {filteredTools.map((tool) => {
          const isSelected = selectedToolId === tool.id;
          return (
            <div
              key={tool.id}
              onClick={() => onSelectTool(tool)}
              className={`frosted-card-interactive ${isSelected ? 'active' : ''}`}
              style={{
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '12px',
                minHeight: '130px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '6px',
                      background: isSelected ? 'rgba(245, 158, 11, 0.2)' : 'var(--bg-surface-elevated)',
                      color: isSelected ? 'var(--accent-gold)' : 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Icon name={tool.icon} size={15} />
                  </div>
                  <div>
                    <div className="font-m" style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                      {tool.name}
                    </div>
                    <div className="font-s" style={{ color: 'var(--text-tertiary)', fontSize: '11px' }}>
                      {tool.nameEn}
                    </div>
                  </div>
                </div>

                <span className="apple-badge font-mono" style={{ fontSize: '11px', padding: '1px 5px' }}>
                  {tool.params.length} 参数
                </span>
              </div>

              <div
                className="font-s"
                style={{
                  color: 'var(--text-secondary)',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  lineHeight: '1.4',
                }}
              >
                {tool.description}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: '8px' }}>
                <span className="font-s font-mono" style={{ color: 'var(--text-tertiary)', fontSize: '11px' }}>
                  {tool.id}
                </span>
                <span className="apple-badge apple-badge-gold" style={{ fontSize: '11px' }}>
                  {tool.categoryZh}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {filteredTools.length === 0 && (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
          <Icon name="search" size={24} style={{ opacity: 0.4, marginBottom: '8px' }} />
          <div className="font-m">未找到匹配的 MCP 工具</div>
          <div className="font-s" style={{ marginTop: '4px' }}>
            尝试更改搜索词或切换分类
          </div>
        </div>
      )}
    </section>
  );
};
