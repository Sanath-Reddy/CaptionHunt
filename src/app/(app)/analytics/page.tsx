'use client';

import { useState, useEffect } from 'react';

export default function AnalyticsPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/analytics')
      .then((r) => r.json())
      .then((data) => { setStats(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

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
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 120, borderRadius: 16 }} />
          ))}
        </div>
      ) : (
        <>
          {/* Stats tiles */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
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
              <div className="stat-tile-value">{stats?.searchCount ?? 0}</div>
              <div className="stat-tile-label">Searches Performed</div>
            </div>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: '1rem' }}>📊 More analytics coming soon</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Topic clustering, channel coverage analysis, content frequency graphs, and cross-channel topic overlap will be available here.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
