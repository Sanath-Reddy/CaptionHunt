'use client';

import { useState, useEffect } from 'react';

function formatDuration(totalSeconds: number): string {
  if (!totalSeconds) return '0h';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  completed:   { label: 'Indexed',      color: 'var(--success)' },
  processing:  { label: 'Processing',   color: 'var(--info)' },
  pending:     { label: 'Pending',      color: 'var(--warning)' },
  failed:      { label: 'Failed',       color: 'var(--error)' },
  no_captions: { label: 'No Captions',  color: 'var(--text-muted)' },
};

export default function AnalyticsPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/analytics')
      .then((r) => r.json())
      .then((data) => { setStats(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const statusBreakdown: { status: string; count: number }[] = stats?.statusBreakdown ?? [];
  const topSearches: { query: string; count: number; lastSearched: string }[] = stats?.topSearches ?? [];
  const totalVideos = statusBreakdown.reduce((s, b) => s + b.count, 0) || 1;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Analytics</h1>
          <p className="page-subtitle">Insights across your indexed content</p>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 120, borderRadius: 16 }} />
          ))}
        </div>
      ) : (
        <>
          {/* Stats tiles */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            <div className="stat-tile">
              <div className="stat-tile-icon">📺</div>
              <div className="stat-tile-value">{stats?.channelCount ?? 0}</div>
              <div className="stat-tile-label">Tracked Channels</div>
            </div>
            <div className="stat-tile">
              <div className="stat-tile-icon">🎬</div>
              <div className="stat-tile-value">{stats?.videoCount ?? 0}</div>
              <div className="stat-tile-label">Indexed Videos</div>
            </div>
            <div className="stat-tile">
              <div className="stat-tile-icon">📝</div>
              <div className="stat-tile-value">{(stats?.segmentCount ?? 0).toLocaleString()}</div>
              <div className="stat-tile-label">Transcript Segments</div>
            </div>
            <div className="stat-tile">
              <div className="stat-tile-icon">🔍</div>
              <div className="stat-tile-value">{(stats?.searchCount ?? 0).toLocaleString()}</div>
              <div className="stat-tile-label">Searches Performed</div>
            </div>
            <div className="stat-tile">
              <div className="stat-tile-icon">⏱️</div>
              <div className="stat-tile-value">{formatDuration(stats?.totalIndexedSeconds ?? 0)}</div>
              <div className="stat-tile-label">Content Indexed</div>
            </div>
          </div>

          {/* Two-column grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>

            {/* Video Status Breakdown */}
            <div className="card">
              <h3 style={{ marginBottom: '1.25rem', fontSize: '1rem', fontWeight: 700 }}>📊 Video Status Breakdown</h3>
              {statusBreakdown.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No videos yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                  {statusBreakdown.map((item) => {
                    const meta = STATUS_META[item.status] ?? { label: item.status, color: 'var(--text-muted)' };
                    const pct = Math.round((item.count / totalVideos) * 100);
                    return (
                      <div key={item.status}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.3rem' }}>
                          <span style={{ color: meta.color, fontWeight: 600 }}>{meta.label}</span>
                          <span style={{ color: 'var(--text-secondary)' }}>{item.count} · {pct}%</span>
                        </div>
                        <div style={{ height: 6, borderRadius: 99, background: 'var(--bg-elevated)', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: meta.color, borderRadius: 99, transition: 'width 0.6s ease' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Top Searches */}
            <div className="card">
              <h3 style={{ marginBottom: '1.25rem', fontSize: '1rem', fontWeight: 700 }}>🔥 Top Searches (30 days)</h3>
              {topSearches.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No searches recorded yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                  {topSearches.map((item, idx) => (
                    <div
                      key={item.query}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.6rem 0',
                        borderBottom: idx < topSearches.length - 1 ? '1px solid var(--border)' : 'none',
                      }}
                    >
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', width: 20, textAlign: 'right', flexShrink: 0 }}>
                        {idx + 1}
                      </span>
                      <span
                        style={{ flex: 1, fontSize: '0.875rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        title={item.query}
                      >
                        {item.query}
                      </span>
                      <span
                        style={{
                          fontSize: '0.8rem',
                          background: 'var(--bg-elevated)',
                          border: '1px solid var(--border)',
                          borderRadius: 99,
                          padding: '1px 8px',
                          color: 'var(--text-secondary)',
                          flexShrink: 0,
                        }}
                      >
                        ×{item.count}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </>
      )}
    </div>
  );
}
