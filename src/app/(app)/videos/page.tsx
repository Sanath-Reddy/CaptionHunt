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
          onSuccess={() => {
            setShowModal(false);
            fetchVideos(1);
            toast('Video added and queued for indexing!', 'success');
          }}
        />
      )}
    </div>
  );
}

function VideoCard({ video, channelName, channelThumbnail }: { video: any; channelName: string | null; channelThumbnail: string | null }) {
  const isProcessing = video.transcriptStatus === 'processing';
  const isCompleted = video.transcriptStatus === 'completed';

  return (
    <div className="video-card">
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
          href={`https://youtube.com/watch?v=${video.youtubeVideoId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-ghost btn-sm"
          style={{ marginTop: '0.75rem', width: '100%', justifyContent: 'center', fontSize: '0.8rem' }}
        >
          Open on YouTube ↗
        </a>
      </div>
    </div>
  );
}

function AddVideoModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to add video');
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add video');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">Add Video</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">YouTube Video URL</label>
            <input
              className="form-input"
              type="text"
              placeholder="https://youtube.com/watch?v=..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
            />
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Supports: regular videos, shorts, live streams, and youtu.be links
            </p>
          </div>
          {error && <p className="form-error" style={{ marginTop: '0.75rem' }}>⚠ {error}</p>}
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Adding...</> : 'Add & Index'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
