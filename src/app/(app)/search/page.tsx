'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { SearchResult } from '@/lib/search';
import { useToast } from '@/components/ToastProvider';

function formatDuration(seconds: number | null): string {
  if (!seconds) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const searchRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Keyboard shortcut: '/' to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === 'Escape') {
        searchRef.current?.blur();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const performSearch = useCallback(async (q: string, p = 1) => {
    if (!q.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const params = new URLSearchParams({ q, page: String(p), limit: '20' });
      const res = await fetch(`/api/search?${params}`);
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      setResults(data.results);
      setTotal(data.total);
      setTotalPages(data.pagination?.pages ?? 1);
      setPage(p);
    } catch (err) {
      toast('Search failed. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(query, 1);
  };

  return (
    <div>
      {/* Page Hero */}
      {!searched && (
        <div style={{ textAlign: 'center', padding: '4rem 0 3rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎯</div>
          <h1 style={{ marginBottom: '0.75rem' }}>
            Search{' '}
            <span style={{ background: 'linear-gradient(135deg, var(--brand-from), var(--brand-to))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              YouTube Moments
            </span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', marginBottom: '2.5rem' }}>
            AI-powered hybrid search across all transcripts. Find any moment by topic, keyword, or meaning.
          </p>
        </div>
      )}

      {/* Search Bar */}
      <form onSubmit={handleSubmit} style={{ marginBottom: searched ? '2rem' : '0' }}>
        <div className="search-hero" style={{ margin: '0 auto', maxWidth: searched ? '100%' : '700px' }}>
          <span className="search-icon">🔍</span>
          <input
            ref={searchRef}
            id="search-input"
            type="text"
            className="search-input"
            placeholder="Search any topic, phrase, or idea..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />
          {!searched && <span className="search-shortcut">/</span>}
        </div>
      </form>

      {/* Results */}
      {loading && (
        <div className="empty-state">
          <div className="spinner" style={{ width: 36, height: 36 }} />
          <p style={{ color: 'var(--text-muted)' }}>Searching transcripts with AI...</p>
        </div>
      )}

      {searched && !loading && (
        <>
          {/* Results Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              {total > 0 ? (
                <>Found <strong style={{ color: 'var(--text-primary)' }}>{total}</strong> matching moments for <strong style={{ color: 'var(--brand-from)' }}>"{query}"</strong></>
              ) : (
                <>No results found for <strong>"{query}"</strong></>
              )}
            </p>
            {total > 0 && (
              <span style={{ fontSize: '0.813rem', color: 'var(--text-muted)' }}>
                Page {page} of {totalPages}
              </span>
            )}
          </div>

          {/* Result List */}
          {results.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🔍</div>
              <div className="empty-state-title">No matches found</div>
              <div className="empty-state-desc">
                Try different keywords, or add more YouTube channels and videos to your library.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              {results.map((result) => (
                <SearchResultCard key={result.segmentId} result={result} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '2rem' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => performSearch(query, page - 1)}
                disabled={page <= 1}
              >
                ← Previous
              </button>
              <span style={{ display: 'flex', alignItems: 'center', padding: '0 1rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                {page} / {totalPages}
              </span>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => performSearch(query, page + 1)}
                disabled={page >= totalPages}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}

      {/* Initial hints */}
      {!searched && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center', marginTop: '2rem' }}>
          {['machine learning', 'climate change', 'how to invest', 'productivity tips', 'web development'].map((hint) => (
            <button
              key={hint}
              className="filter-chip"
              onClick={() => { setQuery(hint); performSearch(hint, 1); }}
            >
              {hint}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SearchResultCard({ result }: { result: SearchResult }) {
  const channelInitial = result.channelName?.[0]?.toUpperCase() ?? '?';

  return (
    <div 
      className="result-card"
      onClick={() => window.open(result.youtubeUrl, '_blank', 'noopener,noreferrer')}
      style={{ cursor: 'pointer' }}
    >
      {/* Header: channel + video */}
      <div className="result-header">
        {result.channelThumbnail ? (
          <img src={result.channelThumbnail} alt={result.channelName ?? ''} className="channel-avatar" />
        ) : (
          <div className="channel-avatar-fallback">{channelInitial}</div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.813rem', color: 'var(--text-muted)', marginBottom: '2px' }}>
            {result.channelName ?? 'Unknown channel'}
            {result.isLivestream && (
              <span style={{ marginLeft: '0.5rem', background: 'var(--error-dim)', color: 'var(--error)', fontSize: '0.7rem', padding: '1px 6px', borderRadius: '100px', fontWeight: 700 }}>
                LIVE
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.875rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {result.videoTitle}
          </div>
        </div>
        {result.videoThumbnail && (
          <img src={result.videoThumbnail} alt={result.videoTitle} className="video-thumbnail" />
        )}
      </div>

      {/* Matched transcript text */}
      <p
        className="result-text"
        dangerouslySetInnerHTML={{ __html: result.highlightedText ?? result.text }}
      />

      {/* Footer: timestamp link + bookmark */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.875rem' }}>
        <a
          href={result.youtubeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="timestamp-badge"
          onClick={(e) => e.stopPropagation()}
        >
          ▶ {formatDuration(Math.floor(result.startTime))}
        </a>
        {result.publishedAt && (
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {new Date(result.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        )}
        <a
          href={result.youtubeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-ghost btn-sm"
          style={{ marginLeft: 'auto', fontSize: '0.8rem' }}
          onClick={(e) => e.stopPropagation()}
        >
          Open in YouTube ↗
        </a>
      </div>
    </div>
  );
}
