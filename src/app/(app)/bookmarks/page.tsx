'use client';

import { useState, useEffect } from 'react';

function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function BookmarksPage() {
  const [bookmarks, setBookmarks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/bookmarks')
      .then((r) => r.json())
      .then((data) => { setBookmarks(data.bookmarks ?? []); setLoading(false); });
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Bookmarks</h1>
          <p className="page-subtitle">Your saved timestamped moments</p>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 100, borderRadius: 14 }} />
          ))}
        </div>
      ) : bookmarks.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🔖</div>
          <div className="empty-state-title">No bookmarks yet</div>
          <div className="empty-state-desc">
            Search for content and bookmark specific moments to find them quickly later.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {bookmarks.map(({ bookmark, segmentText, videoTitle, youtubeVideoId }) => (
            <div 
              key={bookmark.id} 
              className="card" 
              style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', cursor: 'pointer' }}
              onClick={() => window.open(`https://youtube.com/watch?v=${youtubeVideoId}&t=${Math.floor(bookmark.startTime)}s`, '_blank', 'noopener,noreferrer')}
            >
              <div style={{ fontSize: '1.5rem' }}>🔖</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, marginBottom: '0.25rem', fontSize: '0.875rem' }}>{videoTitle}</div>
                {segmentText && (
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.6, marginBottom: '0.5rem' }}>
                    {segmentText}
                  </p>
                )}
                {bookmark.note && (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.813rem', fontStyle: 'italic', marginBottom: '0.5rem' }}>
                    "{bookmark.note}"
                  </p>
                )}
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <a
                    href={`https://youtube.com/watch?v=${youtubeVideoId}&t=${Math.floor(bookmark.startTime)}s`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="timestamp-badge"
                    onClick={(e) => e.stopPropagation()}
                  >
                    ▶ {formatTimestamp(bookmark.startTime)}
                  </a>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {new Date(bookmark.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
