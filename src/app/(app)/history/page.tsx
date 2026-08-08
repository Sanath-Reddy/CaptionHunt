'use client';

import { useState, useEffect } from 'react';

export default function HistoryPage() {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/search-history')
      .then((r) => r.json())
      .then((data) => { setHistory(data.history ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Search History</h1>
          <p className="page-subtitle">Your recent searches with result counts</p>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {[...Array(8)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 56, borderRadius: 12 }} />
          ))}
        </div>
      ) : history.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🕐</div>
          <div className="empty-state-title">No search history</div>
          <div className="empty-state-desc">Your searches will appear here as you use CaptionHunt.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {history.map((entry: any) => (
            <a
              key={entry.id}
              href={`/search?q=${encodeURIComponent(entry.query)}`}
              style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.875rem 1.25rem', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, textDecoration: 'none', transition: 'all 0.2s' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-hover)'; (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.background = 'var(--bg-surface)'; }}
            >
              <span style={{ fontSize: '1rem', opacity: 0.6 }}>🔍</span>
              <span style={{ flex: 1, fontWeight: 500, fontSize: '0.9rem' }}>{entry.query}</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{entry.resultCount} results</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {new Date(entry.createdAt).toLocaleDateString()}
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
