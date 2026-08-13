/**
 * Hybrid Search Engine
 * Combines PostgreSQL full-text search (tsvector) with pgvector semantic search
 * using Reciprocal Rank Fusion (RRF) to produce the best combined ranking.
 */
import { db } from '@/db';
import { generateEmbedding, formatVector } from './embeddings';
import { sql } from 'drizzle-orm';

export interface SearchFilters {
  channelIds?: string[];
  minDuration?: number; // seconds
  maxDuration?: number; // seconds
  contentType?: 'all' | 'videos_only' | 'streams_only';
  dateFrom?: Date;
  dateTo?: Date;
}

export interface SearchResult {
  segmentId: string;
  videoId: string;
  youtubeVideoId: string;
  channelId: string | null;
  channelName: string | null;
  channelThumbnail: string | null;
  videoTitle: string;
  videoThumbnail: string | null;
  durationSeconds: number | null;
  publishedAt: Date | null;
  isLivestream: boolean;
  startTime: number;
  endTime: number;
  text: string;
  score: number;
  youtubeUrl: string; // link with timestamp
  highlightedText?: string;
}

const RRF_K = 60; // RRF constant — standard value

/**
 * Highlight search terms in text by wrapping matches in <mark> tags.
 */
function highlightText(text: string, query: string): string {
  const words = query
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

  if (words.length === 0) return text;

  const pattern = new RegExp(`(${words.join('|')})`, 'gi');
  return text.replace(pattern, '<mark>$1</mark>');
}

/**
 * Build the YouTube timestamp URL for a specific start time.
 */
function buildTimestampUrl(youtubeVideoId: string, startTime: number): string {
  const seconds = Math.floor(startTime);
  return `https://www.youtube.com/watch?v=${youtubeVideoId}&t=${seconds}s`;
}

/**
 * Main hybrid search function.
 * Runs keyword + semantic search in parallel and fuses results with RRF.
 */
export async function searchTranscripts(
  query: string,
  filters: SearchFilters = {},
  limit = 20,
  offset = 0
): Promise<{ results: SearchResult[]; total: number }> {
  if (!query.trim()) return { results: [], total: 0 };

  // Build filter conditions for SQL
  const filterClauses: string[] = ['v.transcript_status = \'completed\''];

  if (filters.channelIds && filters.channelIds.length > 0) {
    const ids = filters.channelIds.map((id) => `'${id}'`).join(',');
    filterClauses.push(`v.channel_id IN (${ids})`);
  }
  if (filters.minDuration !== undefined) {
    filterClauses.push(`v.duration_seconds >= ${filters.minDuration}`);
  }
  if (filters.maxDuration !== undefined) {
    filterClauses.push(`v.duration_seconds <= ${filters.maxDuration}`);
  }
  if (filters.contentType === 'videos_only') {
    filterClauses.push(`v.is_livestream = false`);
  } else if (filters.contentType === 'streams_only') {
    filterClauses.push(`v.is_livestream = true`);
  }
  if (filters.dateFrom) {
    filterClauses.push(`v.published_at >= '${filters.dateFrom.toISOString()}'`);
  }
  if (filters.dateTo) {
    filterClauses.push(`v.published_at <= '${filters.dateTo.toISOString()}'`);
  }

  const whereClause = filterClauses.join(' AND ');

  // ── 1. Full-Text Search (keyword) ──────────────────────────────────────────
  const ftsQuery = query
    .trim()
    .split(/\s+/)
    .map((w) => `${w}:*`) // prefix matching
    .join(' & ');

  const ftsResults = await db.execute(sql.raw(`
    SELECT
      ts.id AS segment_id,
      ts.video_id,
      ts.start_time,
      ts.end_time,
      ts.text,
      ts_rank_cd(to_tsvector('english', ts.text), to_tsquery('english', '${ftsQuery.replace(/'/g, "''")}')) AS rank
    FROM transcript_segments ts
    JOIN videos v ON ts.video_id = v.id
    WHERE ${whereClause}
      AND to_tsvector('english', ts.text) @@ to_tsquery('english', '${ftsQuery.replace(/'/g, "''")}')
    ORDER BY rank DESC
    LIMIT 100
  `));

  // ── 2. Semantic Search (vector) ────────────────────────────────────────────
  const embedding = await generateEmbedding(query);
  const vectorLiteral = formatVector(embedding);

  const vectorResults = await db.execute(sql.raw(`
    SELECT
      ts.id AS segment_id,
      ts.video_id,
      ts.start_time,
      ts.end_time,
      ts.text,
      1 - (ts.embedding <=> '${vectorLiteral}'::vector) AS similarity
    FROM transcript_segments ts
    JOIN videos v ON ts.video_id = v.id
    WHERE ${whereClause}
      AND ts.embedding IS NOT NULL
    ORDER BY ts.embedding <=> '${vectorLiteral}'::vector
    LIMIT 100
  `));

  // ── 3. Reciprocal Rank Fusion ──────────────────────────────────────────────
  const rrfScores = new Map<string, { score: number; ftsRank?: number; vecRank?: number }>();

  ((ftsResults as any).rows || ftsResults).forEach((row: any, idx: number) => {
    const existing = rrfScores.get(row.segment_id) ?? { score: 0 };
    existing.score += 1 / (RRF_K + idx + 1);
    existing.ftsRank = idx + 1;
    rrfScores.set(row.segment_id, existing);
  });

  ((vectorResults as any).rows || vectorResults).forEach((row: any, idx: number) => {
    const existing = rrfScores.get(row.segment_id) ?? { score: 0 };
    existing.score += 1 / (RRF_K + idx + 1);
    existing.vecRank = idx + 1;
    rrfScores.set(row.segment_id, existing);
  });

  // Sort by RRF score
  const sortedIds = [...rrfScores.entries()]
    .sort((a, b) => b[1].score - a[1].score)
    .map(([id]) => id);

  const total = sortedIds.length;
  const pageIds = sortedIds.slice(offset, offset + limit);

  if (pageIds.length === 0) return { results: [], total: 0 };

  // ── 4. Fetch full data for top results ────────────────────────────────────
  const idList = pageIds.map((id) => `'${id}'`).join(',');
  const fullResults = await db.execute(sql.raw(`
    SELECT
      ts.id AS segment_id,
      ts.video_id,
      ts.start_time,
      ts.end_time,
      ts.text,
      v.youtube_video_id,
      v.title AS video_title,
      v.thumbnail_url AS video_thumbnail,
      v.duration_seconds,
      v.published_at,
      v.is_livestream,
      v.channel_id,
      c.name AS channel_name,
      c.thumbnail_url AS channel_thumbnail
    FROM transcript_segments ts
    JOIN videos v ON ts.video_id = v.id
    LEFT JOIN channels c ON v.channel_id = c.id
    WHERE ts.id IN (${idList})
  `)) as unknown as {
    segment_id: string;
    video_id: string;
    start_time: number;
    end_time: number;
    text: string;
    youtube_video_id: string;
    video_title: string;
    video_thumbnail: string | null;
    duration_seconds: number | null;
    published_at: Date | null;
    is_livestream: boolean;
    channel_id: string | null;
    channel_name: string | null;
    channel_thumbnail: string | null;
  }[];

  // Map back in RRF order
  const resultMap = new Map(((fullResults as any).rows || fullResults).map((r: any) => [r.segment_id, r]));

  const results: SearchResult[] = pageIds
    .map((id) => {
      const r = resultMap.get(id) as any;
      if (!r) return null;

      return {
        segmentId: r.segment_id,
        videoId: r.video_id,
        youtubeVideoId: r.youtube_video_id,
        channelId: r.channel_id,
        channelName: r.channel_name,
        channelThumbnail: r.channel_thumbnail,
        videoTitle: r.video_title,
        videoThumbnail: r.video_thumbnail,
        durationSeconds: r.duration_seconds,
        publishedAt: r.published_at,
        isLivestream: r.is_livestream,
        startTime: r.start_time,
        endTime: r.end_time,
        text: r.text,
        score: rrfScores.get(id)!.score,
        youtubeUrl: buildTimestampUrl(r.youtube_video_id, r.start_time),
        highlightedText: highlightText(r.text, query),
      };
    })
    .filter(Boolean) as SearchResult[];

  return { results, total };
}

/**
 * Format seconds into MM:SS or HH:MM:SS display string.
 */
export function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}
