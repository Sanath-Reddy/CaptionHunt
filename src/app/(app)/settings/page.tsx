'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/components/ToastProvider';
import { useTheme } from '@/components/ThemeProvider';

export default function SettingsPage() {
  const [youtubeKey, setYoutubeKey] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    // Load current settings from .env (read-only display)
    setWebhookUrl(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000');
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Configure CaptionHunt to your preferences</p>
        </div>
      </div>

      <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* Appearance */}
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>🎨 Appearance</h3>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Theme</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                Currently: {theme === 'dark' ? '🌙 Dark Mode' : '☀️ Light Mode'}
              </div>
            </div>
            <button className="btn btn-secondary" onClick={toggleTheme}>
              Switch to {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
          </div>
        </div>

        {/* YouTube API Key */}
        <div className="card">
          <h3 style={{ marginBottom: '0.5rem' }}>🎥 YouTube API</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1rem' }}>
            Required for fetching channel and video metadata. Get a free API key from{' '}
            <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand-from)' }}>
              Google Cloud Console
            </a>.
          </p>
          <div className="form-group">
            <label className="form-label">API Key</label>
            <input
              className="form-input"
              type="password"
              placeholder="AIza..."
              value={youtubeKey}
              onChange={(e) => setYoutubeKey(e.target.value)}
            />
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Set in your <code>.env.local</code> file as <code>YOUTUBE_API_KEY</code>
            </p>
          </div>
        </div>

        {/* Webhook */}
        <div className="card">
          <h3 style={{ marginBottom: '0.5rem' }}>🔔 Webhook (Auto-detect new uploads)</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1rem' }}>
            For real-time notifications when tracked channels upload new videos. Requires a public URL.
            Use <a href="https://ngrok.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand-from)' }}>ngrok</a> for local development.
          </p>
          <div className="form-group">
            <label className="form-label">Webhook Base URL</label>
            <input
              className="form-input"
              type="url"
              placeholder="https://your-domain.com"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
            />
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Set in <code>.env.local</code> as <code>WEBHOOK_BASE_URL</code>. Callback URL:
              <code style={{ marginLeft: 4, wordBreak: 'break-all' }}>{webhookUrl}/api/webhook/youtube</code>
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="card">
          <h3 style={{ marginBottom: '0.5rem' }}>🔍 Search Engine</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1rem' }}>
            CaptionHunt uses hybrid search: keyword matching (PostgreSQL FTS) + semantic similarity (local AI embeddings).
            The embedding model (<code>all-MiniLM-L6-v2</code>) is downloaded automatically on first use — no API key required.
          </p>
          <div style={{ background: 'var(--success-dim)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 10, padding: '0.75rem 1rem', fontSize: '0.875rem', color: 'var(--success)' }}>
            ✅ Semantic search: <strong>Free & Local</strong> — uses HuggingFace Transformers.js (~25MB model download)
          </div>
        </div>

        {/* Keyboard shortcuts */}
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>⌨️ Keyboard Shortcuts</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {[
              { key: '/', desc: 'Focus search bar' },
              { key: 'Esc', desc: 'Blur / close modal' },
              { key: 'Enter', desc: 'Submit search' },
            ].map(({ key, desc }) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <kbd style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 10px', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem', color: 'var(--text-primary)' }}>{key}</kbd>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{desc}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
