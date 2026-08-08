'use client';

import { useState, useEffect } from 'react';
import type { Channel } from '@/db/schema';
import { useToast } from '@/components/ToastProvider';

function formatSubscribers(count: number | null): string {
  if (!count) return 'Unknown';
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}

export default function ChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const { toast } = useToast();

  const fetchChannels = async () => {
    const res = await fetch('/api/channels');
    if (res.ok) {
      const data = await res.json();
      setChannels(data.channels);
    }
    setLoading(false);
  };

  useEffect(() => { fetchChannels(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this channel? Videos will remain in your library.')) return;
    const res = await fetch(`/api/channels/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setChannels((prev) => prev.filter((c) => c.id !== id));
      toast('Channel removed', 'success');
    } else {
      toast('Failed to remove channel', 'error');
    }
  };

  const handleToggleAutoProcess = async (channel: Channel) => {
    const res = await fetch(`/api/channels/${channel.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ autoProcess: !channel.autoProcess }),
    });
    if (res.ok) {
      const data = await res.json();
      setChannels((prev) => prev.map((c) => c.id === channel.id ? data.channel : c));
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Channels</h1>
          <p className="page-subtitle">Manage tracked YouTube channels and their processing settings</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + Add Channel
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 160, borderRadius: 16 }} />
          ))}
        </div>
      ) : channels.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📺</div>
          <div className="empty-state-title">No channels yet</div>
          <div className="empty-state-desc">
            Add a YouTube channel to start indexing its transcripts and searching through its content.
          </div>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>Add Your First Channel</button>
        </div>
      ) : (
        <div className="channel-grid">
          {channels.map((channel) => (
            <ChannelCard
              key={channel.id}
              channel={channel}
              onDelete={() => handleDelete(channel.id)}
              onToggleAutoProcess={() => handleToggleAutoProcess(channel)}
            />
          ))}
        </div>
      )}

      {showModal && (
        <AddChannelModal
          onClose={() => setShowModal(false)}
          onSuccess={(channel) => {
            setChannels((prev) => [...prev, channel]);
            setShowModal(false);
            toast('Channel added successfully!', 'success');
          }}
        />
      )}
    </div>
  );
}

function ChannelCard({
  channel,
  onDelete,
  onToggleAutoProcess,
}: {
  channel: Channel;
  onDelete: () => void;
  onToggleAutoProcess: () => void;
}) {
  const initial = channel.name[0]?.toUpperCase() ?? '?';

  return (
    <div className="channel-card">
      <div className="channel-card-header">
        {channel.thumbnailUrl ? (
          <img src={channel.thumbnailUrl} alt={channel.name} className="channel-thumb" />
        ) : (
          <div className="channel-avatar-fallback" style={{ width: 48, height: 48, fontSize: '1.1rem' }}>{initial}</div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {channel.name}
          </div>
          {channel.handle && (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{channel.handle}</div>
          )}
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            {formatSubscribers(channel.subscriberCount)} subscribers
          </div>
        </div>
        <button className="btn btn-ghost btn-icon" onClick={onDelete} title="Remove channel" style={{ fontSize: '1rem' }}>
          🗑️
        </button>
      </div>

      {/* Stats */}
      <div className="channel-card-stats">
        <div className="channel-stat">
          <div className="channel-stat-value" style={{ fontSize: '0.9rem' }}>
            {channel.filterContentType === 'all' ? 'All' : channel.filterContentType === 'videos_only' ? 'Videos' : 'Streams'}
          </div>
          <div className="channel-stat-label">Content</div>
        </div>
        <div className="channel-stat">
          <div className="channel-stat-value" style={{ fontSize: '0.9rem' }}>
            {channel.filterMinDuration ? `${Math.floor(channel.filterMinDuration / 60)}m+` : 'Any'}
          </div>
          <div className="channel-stat-label">Min Length</div>
        </div>
        <div className="channel-stat">
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <label className="toggle" title="Auto-process new uploads">
              <input
                type="checkbox"
                checked={channel.autoProcess}
                onChange={onToggleAutoProcess}
              />
              <span className="toggle-slider" />
            </label>
          </div>
          <div className="channel-stat-label">Auto-index</div>
        </div>
      </div>
    </div>
  );
}

function AddChannelModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: (channel: Channel) => void;
}) {
  const [url, setUrl] = useState('');
  const [autoProcess, setAutoProcess] = useState(true);
  const [filterContentType, setFilterContentType] = useState<'all' | 'videos_only' | 'streams_only'>('all');
  const [filterMinDuration, setFilterMinDuration] = useState('');
  const [filterMaxDuration, setFilterMaxDuration] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          autoProcess,
          filterContentType,
          filterMinDuration: filterMinDuration ? parseInt(filterMinDuration, 10) * 60 : undefined,
          filterMaxDuration: filterMaxDuration ? parseInt(filterMaxDuration, 10) * 60 : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to add channel');
      onSuccess(data.channel);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add channel');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">Add YouTube Channel</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="form-group">
              <label className="form-label">Channel URL or Handle</label>
              <input
                className="form-input"
                type="text"
                placeholder="https://youtube.com/@channelname or @handle"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
              />
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Supports: @handles, /c/ slugs, channel IDs, and full URLs
              </p>
            </div>

            <div className="form-group">
              <label className="form-label">Content Type</label>
              <select
                className="form-select"
                value={filterContentType}
                onChange={(e) => setFilterContentType(e.target.value as typeof filterContentType)}
              >
                <option value="all">All content (videos + streams)</option>
                <option value="videos_only">Videos only</option>
                <option value="streams_only">Live streams only</option>
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label">Min Duration (minutes)</label>
                <input
                  className="form-input"
                  type="number"
                  min="0"
                  placeholder="No minimum"
                  value={filterMinDuration}
                  onChange={(e) => setFilterMinDuration(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Max Duration (minutes)</label>
                <input
                  className="form-input"
                  type="number"
                  min="0"
                  placeholder="No maximum"
                  value={filterMaxDuration}
                  onChange={(e) => setFilterMaxDuration(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={autoProcess}
                  onChange={(e) => setAutoProcess(e.target.checked)}
                />
                <span className="toggle-slider" />
              </label>
              <div>
                <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>Auto-index new uploads</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Automatically process transcripts when new videos are uploaded
                </div>
              </div>
            </div>

            {error && <p className="form-error">⚠ {error}</p>}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Adding...</> : 'Add Channel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
