/**
 * YouTube Data API v3 Service
 * Handles all interactions with the YouTube API for channel/video metadata.
 * Keeps the API key server-side only.
 */

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

function getApiKey(): string {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error('YOUTUBE_API_KEY is not configured');
  return key;
}

async function ytFetch<T>(endpoint: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${YOUTUBE_API_BASE}/${endpoint}`);
  url.searchParams.set('key', getApiKey());
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), { next: { revalidate: 300 } }); // cache 5 min
  if (!res.ok) {
    const error = await res.json();
    throw new Error(`YouTube API error: ${error.error?.message ?? res.statusText}`);
  }
  return res.json() as T;
}

// ─── Types ────────────────────────────────────────────────────────────────────
export interface YouTubeChannelInfo {
  id: string;
  name: string;
  handle: string;
  description: string;
  thumbnailUrl: string;
  subscriberCount: number;
  uploadsPlaylistId: string;
}

export interface YouTubeVideoInfo {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  durationSeconds: number;
  publishedAt: Date;
  isLivestream: boolean;
  channelId: string;
  channelTitle: string;
}

// ─── Channel Resolution ───────────────────────────────────────────────────────

/**
 * Resolve various YouTube channel URL formats to a channel ID.
 * Supports: channel IDs, @handles, /c/ slugs, /user/ slugs
 */
export async function resolveChannelUrl(input: string): Promise<string> {
  const trimmed = input.trim();

  // Already a channel ID (starts with UC)
  if (/^UC[\w-]{22}$/.test(trimmed)) return trimmed;

  // Extract from various URL formats
  const patterns = [
    /youtube\.com\/channel\/(UC[\w-]{22})/,
    /youtube\.com\/@([\w.-]+)/,
    /youtube\.com\/c\/([\w.-]+)/,
    /youtube\.com\/user\/([\w.-]+)/,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match) {
      const identifier = match[1];
      if (/^UC[\w-]{22}$/.test(identifier)) return identifier;
      return searchChannelByIdentifier(identifier);
    }
  }

  // Treat as a handle or search term
  return searchChannelByIdentifier(trimmed.replace(/^@/, ''));
}

async function searchChannelByIdentifier(identifier: string): Promise<string> {
  // Try handle lookup first
  try {
    const data = await ytFetch<{ items?: { id: string }[] }>('channels', {
      part: 'id',
      forHandle: identifier.startsWith('@') ? identifier : `@${identifier}`,
    });
    if (data.items?.[0]?.id) return data.items[0].id;
  } catch {}

  // Fall back to search
  const searchData = await ytFetch<{ items?: { snippet: { channelId: string } }[] }>('search', {
    part: 'snippet',
    type: 'channel',
    q: identifier,
    maxResults: '1',
  });

  const channelId = searchData.items?.[0]?.snippet?.channelId;
  if (!channelId) throw new Error(`Could not find YouTube channel: "${identifier}"`);
  return channelId;
}

// ─── Channel Info ─────────────────────────────────────────────────────────────
export async function getChannelInfo(channelId: string): Promise<YouTubeChannelInfo> {
  const data = await ytFetch<{
    items?: {
      id: string;
      snippet: {
        title: string;
        description: string;
        customUrl: string;
        thumbnails: { high: { url: string } };
      };
      statistics: { subscriberCount: string };
      contentDetails: { relatedPlaylists: { uploads: string } };
    }[];
  }>('channels', {
    part: 'snippet,statistics,contentDetails',
    id: channelId,
  });

  const item = data.items?.[0];
  if (!item) throw new Error(`Channel not found: ${channelId}`);

  return {
    id: item.id,
    name: item.snippet.title,
    handle: item.snippet.customUrl ?? '',
    description: item.snippet.description,
    thumbnailUrl: item.snippet.thumbnails.high?.url ?? '',
    subscriberCount: parseInt(item.statistics.subscriberCount ?? '0', 10),
    uploadsPlaylistId: item.contentDetails.relatedPlaylists.uploads,
  };
}

// ─── Video Info ───────────────────────────────────────────────────────────────
export async function getVideoInfo(videoId: string): Promise<YouTubeVideoInfo> {
  const data = await ytFetch<{
    items?: {
      id: string;
      snippet: {
        title: string;
        description: string;
        thumbnails: { high: { url: string }; maxres?: { url: string } };
        publishedAt: string;
        channelId: string;
        channelTitle: string;
        liveBroadcastContent: string;
      };
      contentDetails: { duration: string };
    }[];
  }>('videos', {
    part: 'snippet,contentDetails',
    id: videoId,
  });

  const item = data.items?.[0];
  if (!item) throw new Error(`Video not found: ${videoId}`);

  return {
    id: item.id,
    title: item.snippet.title,
    description: item.snippet.description,
    thumbnailUrl:
      item.snippet.thumbnails.maxres?.url ?? item.snippet.thumbnails.high?.url ?? '',
    durationSeconds: parseISO8601Duration(item.contentDetails.duration),
    publishedAt: new Date(item.snippet.publishedAt),
    isLivestream: item.snippet.liveBroadcastContent === 'live' || item.snippet.liveBroadcastContent === 'completed',
    channelId: item.snippet.channelId,
    channelTitle: item.snippet.channelTitle,
  };
}

// ─── Channel Videos ───────────────────────────────────────────────────────────
export interface VideoListItem {
  videoId: string;
  title: string;
  publishedAt: Date;
}

export async function getChannelVideos(
  uploadsPlaylistId: string,
  maxResults = 50,
  pageToken?: string
): Promise<{ videos: VideoListItem[]; nextPageToken?: string }> {
  const params: Record<string, string> = {
    part: 'snippet',
    playlistId: uploadsPlaylistId,
    maxResults: String(Math.min(maxResults, 50)),
  };
  if (pageToken) params.pageToken = pageToken;

  const data = await ytFetch<{
    nextPageToken?: string;
    items?: {
      snippet: {
        resourceId: { videoId: string };
        title: string;
        publishedAt: string;
      };
    }[];
  }>('playlistItems', params);

  return {
    videos: (data.items ?? []).map((item) => ({
      videoId: item.snippet.resourceId.videoId,
      title: item.snippet.title,
      publishedAt: new Date(item.snippet.publishedAt),
    })),
    nextPageToken: data.nextPageToken,
  };
}

// ─── Playlist Videos ─────────────────────────────────────────────────────────
export async function getPlaylistVideos(playlistId: string): Promise<VideoListItem[]> {
  const all: VideoListItem[] = [];
  let pageToken: string | undefined;

  do {
    const result = await getChannelVideos(playlistId, 50, pageToken);
    all.push(...result.videos);
    pageToken = result.nextPageToken;
  } while (pageToken);

  return all;
}

// ─── Video ID Extraction ──────────────────────────────────────────────────────
export function extractVideoId(urlOrId: string): string | null {
  const trimmed = urlOrId.trim();

  // Already a video ID
  if (/^[\w-]{11}$/.test(trimmed)) return trimmed;

  // Various YouTube URL patterns
  const patterns = [
    /youtube\.com\/watch\?v=([\w-]{11})/,
    /youtu\.be\/([\w-]{11})/,
    /youtube\.com\/embed\/([\w-]{11})/,
    /youtube\.com\/shorts\/([\w-]{11})/,
    /youtube\.com\/live\/([\w-]{11})/,
    /youtube\.com\/v\/([\w-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match) return match[1];
  }

  return null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function parseISO8601Duration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] ?? '0', 10);
  const minutes = parseInt(match[2] ?? '0', 10);
  const seconds = parseInt(match[3] ?? '0', 10);
  return hours * 3600 + minutes * 60 + seconds;
}
