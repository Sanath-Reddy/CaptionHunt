'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/components/ToastProvider';

function formatDuration(seconds: number | null): string {
  if (!seconds) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  processing: 'Processing',
  completed: 'Indexed',
  failed: 'Failed',
  no_captions: 'No Captions',
};

const STATUS_CLASSES: Record<string, string> = {
  pending: 'badge-pending',
  processing: 'badge-processing',
  completed: 'badge-completed',
  failed: 'badge-failed',
  no_captions: 'badge-no-captions',
};

export default function VideosPage() {
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const { toast } = useToast();

  const fetchVideos = async (p = 1) => {
    setLoading(true);
    const res = await fetch(`/api/videos?page=${p}&limit=20`);
    if (res.ok) {
      const data = await res.json();
      setVideos(data.videos);
      setPage(p);
      setTotalPages(data.pagination.pages);
      setTotal(data.pagination.total);
    }
    setLoading(false);
  };

  useEffect(() => { fetchVideos(1); }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Video Library</h1>
          <p className="page-subtitle">{total} videos indexed across all channels</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + Add Video
        </button>
      </div>

      {loading ? (
        <div className="video-grid">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 240, borderRadius: 14 }} />
          ))}
        </div>
      ) : videos.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🎬</div>
          <div className="empty-state-title">No videos yet</div>
          <div className="empty-state-desc">
            Add channels to automatically index videos, or manually add specific videos by URL.
          </div>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>Add Video</button>
        </div>
      ) : (
        <>
          <div className="video-grid">
            {videos.map(({ video, channelName, channelThumbnail }) => (
              <VideoCard
                key={video.id}
                video={video}
                channelName={channelName}
                channelThumbnail={channelThumbnail}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '2rem' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => fetchVideos(page - 1)} disabled={page <= 1}>← Prev</button>
              <span style={{ display: 'flex', alignItems: 'center', padding: '0 1rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{page} / {totalPages}</span>
              <button className="btn btn-secondary btn-sm" onClick={() => fetchVideos(page + 1)} disabled={page >= totalPages}>Next →</button>
            </div>
          )}
        </>
      )}

      {showModal && (
        <AddVideoModal
          onClose={() => setShowModal(false)}
          onSuccess={(msg) => {
            setShowModal(false);
            fetchVideos(1);
            toast(msg, 'success');
          }}
        />
      )}
    </div>
  );
}

function VideoCard({ video, channelName, channelThumbnail }: { video: any; channelName: string | null; channelThumbnail: string | null }) {
  const isProcessing = video.transcriptStatus === 'processing';
  const isCompleted = video.transcriptStatus === 'completed';
  const youtubeUrl = `https://youtube.com/watch?v=${video.youtubeVideoId}`;

  return (
    <div
      className="video-card"
      onClick={() => window.open(youtubeUrl, '_blank', 'noopener,noreferrer')}
      style={{ cursor: 'pointer' }}
    >
      <div className="video-card-thumb">
        {video.thumbnailUrl ? (
          <img src={video.thumbnailUrl} alt={video.title} loading="lazy" />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', background: 'var(--bg-elevated)' }}>🎬</div>
        )}
        {video.durationSeconds && (
          <span className="video-duration">{formatDuration(video.durationSeconds)}</span>
        )}
        {isProcessing && (
          <div style={{ position: 'absolute', top: 6, left: 6 }}>
            <span className="processing-dot" />
          </div>
        )}
      </div>
      <div className="video-card-body">
        <div className="video-card-title">{video.title}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginTop: '0.5rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{channelName ?? 'Manual add'}</span>
          <span className={`badge ${STATUS_CLASSES[video.transcriptStatus] ?? 'badge-pending'}`}>
            {isProcessing && <span className="processing-dot" style={{ width: 6, height: 6 }} />}
            {STATUS_LABELS[video.transcriptStatus] ?? video.transcriptStatus}
          </span>
        </div>
        {isCompleted && (
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            {video.segmentCount} segments indexed
          </div>
        )}
        <a
          href={youtubeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-ghost btn-sm"
          style={{ marginTop: '0.75rem', width: '100%', justifyContent: 'center', fontSize: '0.8rem' }}
          onClick={(e) => e.stopPropagation()}
        >
          Open on YouTube ↗
        </a>
      </div>
    </div>
  );
}


function AddVideoModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (msg: string) => void }) {
  const [tab, setTab] = useState<'video' | 'playlist'>('video');

  // ── Single video state ──────────────────────────────────────────
  const [videoUrl, setVideoUrl] = useState('');
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoError, setVideoError] = useState('');

  const handleVideoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setVideoError('');
    setVideoLoading(true);
    try {
      const res = await fetch('/api/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: videoUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to add video');
      onSuccess('Video added and queued for indexing!');
    } catch (err) {
      setVideoError(err instanceof Error ? err.message : 'Failed to add video');
    } finally {
      setVideoLoading(false);
    }
  };

  // ── Playlist state ──────────────────────────────────────────────
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [playlistPreview, setPlaylistPreview] = useState<null | {
    id: string; title: string; channelTitle: string; itemCount: number; thumbnailUrl: string;
  }>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [playlistError, setPlaylistError] = useState('');
  const [importResult, setImportResult] = useState<null | { added: number; skipped: number; total: number }>(null);

  const handlePreview = async (e: React.FormEvent) => {
    e.preventDefault();
    setPlaylistError('');
    setPlaylistPreview(null);
    setImportResult(null);
    setPreviewLoading(true);
    try {
      const res = await fetch(`/api/playlist?url=${encodeURIComponent(playlistUrl)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to fetch playlist');
      setPlaylistPreview(data.playlist);
    } catch (err) {
      setPlaylistError(err instanceof Error ? err.message : 'Failed to fetch playlist');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleImport = async () => {
    setPlaylistError('');
    setImportLoading(true);
    try {
      const res = await fetch('/api/playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: playlistUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Import failed');
      setImportResult(data);
      onSuccess(`Imported ${data.added} videos from playlist! (${data.skipped} already existed)`);
    } catch (err) {
      setPlaylistError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImportLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <h2 className="modal-title">Add to Library</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.5rem', background: 'var(--bg-elevated)', borderRadius: 10, padding: '4px' }}>
          {(['video', 'playlist'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              style={{
                flex: 1, padding: '0.5rem 1rem', borderRadius: 8, border: 'none',
                fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', transition: 'all 0.15s',
                background: tab === t ? 'var(--bg-surface)' : 'transparent',
                color: tab === t ? 'var(--text-primary)' : 'var(--text-muted)',
                boxShadow: tab === t ? 'var(--shadow-sm)' : 'none',
              }}
            >
              {t === 'video' ? '🎬 Single Video' : '📋 Playlist'}
            </button>
          ))}
        </div>

        {/* ── Single Video Tab ── */}
        {tab === 'video' && (
          <form onSubmit={handleVideoSubmit}>
            <div className="form-group">
              <label className="form-label">YouTube Video URL</label>
              <input
                className="form-input"
                type="text"
                placeholder="https://youtube.com/watch?v=..."
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                required
              />
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.375rem' }}>
                Supports: regular videos, shorts, live streams, and youtu.be links
              </p>
            </div>
            {videoError && <p className="form-error" style={{ marginTop: '0.75rem' }}>⚠ {videoError}</p>}
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={videoLoading}>
                {videoLoading ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Adding...</> : 'Add & Index'}
              </button>
            </div>
          </form>
        )}

        {/* ── Playlist Tab ── */}
        {tab === 'playlist' && (
          <div>
            {!playlistPreview ? (
              <form onSubmit={handlePreview}>
                <div className="form-group">
                  <label className="form-label">YouTube Playlist URL</label>
                  <input
                    className="form-input"
                    type="text"
                    placeholder="https://youtube.com/playlist?list=PL..."
                    value={playlistUrl}
                    onChange={(e) => setPlaylistUrl(e.target.value)}
                    required
                  />
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.375rem' }}>
                    Supports: /playlist?list=..., watch?v=...&list=..., or bare PL... IDs
                  </p>
                </div>
                {playlistError && <p className="form-error" style={{ marginTop: '0.75rem' }}>⚠ {playlistError}</p>}
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={previewLoading}>
                    {previewLoading ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Fetching...</> : 'Preview Playlist'}
                  </button>
                </div>
              </form>
            ) : (
              <div>
                {/* Playlist Preview Card */}
                <div style={{
                  display: 'flex', gap: '1rem', alignItems: 'flex-start',
                  background: 'var(--bg-elevated)', borderRadius: 12,
                  padding: '1rem', marginBottom: '1.25rem',
                  border: '1px solid var(--border)',
                }}>
                  {playlistPreview.thumbnailUrl && (
                    <img
                      src={playlistPreview.thumbnailUrl}
                      alt={playlistPreview.title}
                      style={{ width: 80, height: 56, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }}
                    />
                  )}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {playlistPreview.title}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                      {playlistPreview.channelTitle}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <span style={{
                        fontSize: '0.75rem', fontWeight: 600,
                        background: 'var(--brand-glow)', color: 'var(--brand-from)',
                        borderRadius: 6, padding: '2px 8px',
                      }}>
                        {playlistPreview.itemCount} videos
                      </span>
                    </div>
                  </div>
                </div>

                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
                  All <strong>{playlistPreview.itemCount}</strong> videos will be added to your library and queued for transcript indexing.
                  Videos already in your library will be skipped.
                </p>

                {playlistError && <p className="form-error" style={{ marginBottom: '1rem' }}>⚠ {playlistError}</p>}

                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => { setPlaylistPreview(null); setPlaylistError(''); }}
                    disabled={importLoading}
                  >
                    ← Change URL
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleImport}
                    disabled={importLoading}
                  >
                    {importLoading
                      ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Importing...</>
                      : `Import ${playlistPreview.itemCount} Videos`
                    }
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


