import {
  pgTable,
  text,
  varchar,
  boolean,
  integer,
  real,
  timestamp,
  pgEnum,
  index,
  unique,
  uuid,
  customType,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ─── Custom vector type for pgvector ──────────────────────────────────────────
const vector = customType<{ data: number[]; notNull: false; default: false }>({
  dataType() {
    return 'vector(384)'; // all-MiniLM-L6-v2 produces 384-dim embeddings
  },
  toDriver(value: number[]) {
    return `[${value.join(',')}]`;
  },
  fromDriver(value: unknown) {
    return (value as string)
      .slice(1, -1)
      .split(',')
      .map(Number);
  },
});

// ─── Enums ─────────────────────────────────────────────────────────────────────
export const userRoleEnum = pgEnum('user_role', ['admin', 'user']);
export const contentTypeEnum = pgEnum('content_type', ['all', 'videos_only', 'streams_only']);
export const transcriptStatusEnum = pgEnum('transcript_status', [
  'pending',
  'processing',
  'completed',
  'failed',
  'no_captions',
]);
export const jobStatusEnum = pgEnum('job_status', ['pending', 'processing', 'completed', 'failed']);

// ─── Users ────────────────────────────────────────────────────────────────────
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }),
  passwordHash: text('password_hash').notNull(),
  role: userRoleEnum('role').notNull().default('user'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── Channels ─────────────────────────────────────────────────────────────────
export const channels = pgTable(
  'channels',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    youtubeChannelId: varchar('youtube_channel_id', { length: 50 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    handle: varchar('handle', { length: 100 }),
    thumbnailUrl: text('thumbnail_url'),
    subscriberCount: integer('subscriber_count'),
    description: text('description'),
    autoProcess: boolean('auto_process').notNull().default(true),
    filterMinDuration: integer('filter_min_duration'), // seconds, null = no min
    filterMaxDuration: integer('filter_max_duration'), // seconds, null = no max
    filterContentType: contentTypeEnum('filter_content_type').notNull().default('all'),
    webhookSubscriptionExpiry: timestamp('webhook_subscription_expiry', { withTimezone: true }),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    addedByUserId: uuid('added_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('channels_youtube_channel_id_unique').on(t.youtubeChannelId)]
);

// ─── Videos ───────────────────────────────────────────────────────────────────
export const videos = pgTable(
  'videos',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    youtubeVideoId: varchar('youtube_video_id', { length: 20 }).notNull(),
    channelId: uuid('channel_id').references(() => channels.id, { onDelete: 'set null' }),
    addedByUserId: uuid('added_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    description: text('description'),
    thumbnailUrl: text('thumbnail_url'),
    durationSeconds: integer('duration_seconds'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    isLivestream: boolean('is_livestream').notNull().default(false),
    transcriptStatus: transcriptStatusEnum('transcript_status').notNull().default('pending'),
    transcriptError: text('transcript_error'),
    segmentCount: integer('segment_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('videos_youtube_video_id_unique').on(t.youtubeVideoId),
    index('videos_channel_id_idx').on(t.channelId),
    index('videos_status_idx').on(t.transcriptStatus),
  ]
);

// ─── Transcript Segments ──────────────────────────────────────────────────────
export const transcriptSegments = pgTable(
  'transcript_segments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    videoId: uuid('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    startTime: real('start_time').notNull(), // seconds
    endTime: real('end_time').notNull(),     // seconds
    text: text('text').notNull(),
    embedding: vector('embedding'),          // 384-dim, null until embedded
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('transcript_segments_video_id_idx').on(t.videoId),
    index('transcript_segments_start_time_idx').on(t.startTime),
  ]
);

// ─── Bookmarks ────────────────────────────────────────────────────────────────
export const bookmarks = pgTable(
  'bookmarks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    videoId: uuid('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    segmentId: uuid('segment_id')
      .references(() => transcriptSegments.id, { onDelete: 'set null' }),
    startTime: real('start_time').notNull(),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('bookmarks_user_id_idx').on(t.userId),
    index('bookmarks_video_id_idx').on(t.videoId),
  ]
);

// ─── Saved Searches ───────────────────────────────────────────────────────────
export const savedSearches = pgTable(
  'saved_searches',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    query: text('query').notNull(),
    notifyOnMatch: boolean('notify_on_match').notNull().default(false),
    lastMatchedAt: timestamp('last_matched_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('saved_searches_user_id_idx').on(t.userId)]
);

// ─── Search History ───────────────────────────────────────────────────────────
export const searchHistory = pgTable(
  'search_history',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    query: text('query').notNull(),
    resultCount: integer('result_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('search_history_user_id_idx').on(t.userId),
    index('search_history_created_at_idx').on(t.createdAt),
  ]
);

// ─── Processing Jobs ──────────────────────────────────────────────────────────
export const processingJobs = pgTable(
  'processing_jobs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    videoId: uuid('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    status: jobStatusEnum('status').notNull().default('pending'),
    errorMessage: text('error_message'),
    attempts: integer('attempts').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
  },
  (t) => [
    index('processing_jobs_status_idx').on(t.status),
    index('processing_jobs_video_id_idx').on(t.videoId),
  ]
);

// ─── Relations ────────────────────────────────────────────────────────────────
export const usersRelations = relations(users, ({ many }) => ({
  channels: many(channels),
  videos: many(videos),
  bookmarks: many(bookmarks),
  savedSearches: many(savedSearches),
  searchHistory: many(searchHistory),
}));

export const channelsRelations = relations(channels, ({ one, many }) => ({
  addedBy: one(users, { fields: [channels.addedByUserId], references: [users.id] }),
  videos: many(videos),
}));

export const videosRelations = relations(videos, ({ one, many }) => ({
  channel: one(channels, { fields: [videos.channelId], references: [channels.id] }),
  addedBy: one(users, { fields: [videos.addedByUserId], references: [users.id] }),
  segments: many(transcriptSegments),
  bookmarks: many(bookmarks),
  processingJobs: many(processingJobs),
}));

export const transcriptSegmentsRelations = relations(transcriptSegments, ({ one, many }) => ({
  video: one(videos, { fields: [transcriptSegments.videoId], references: [videos.id] }),
  bookmarks: many(bookmarks),
}));

export const bookmarksRelations = relations(bookmarks, ({ one }) => ({
  user: one(users, { fields: [bookmarks.userId], references: [users.id] }),
  video: one(videos, { fields: [bookmarks.videoId], references: [videos.id] }),
  segment: one(transcriptSegments, { fields: [bookmarks.segmentId], references: [transcriptSegments.id] }),
}));

export const savedSearchesRelations = relations(savedSearches, ({ one }) => ({
  user: one(users, { fields: [savedSearches.userId], references: [users.id] }),
}));

export const searchHistoryRelations = relations(searchHistory, ({ one }) => ({
  user: one(users, { fields: [searchHistory.userId], references: [users.id] }),
}));

export const processingJobsRelations = relations(processingJobs, ({ one }) => ({
  video: one(videos, { fields: [processingJobs.videoId], references: [videos.id] }),
}));

// ─── TypeScript types ─────────────────────────────────────────────────────────
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Channel = typeof channels.$inferSelect;
export type NewChannel = typeof channels.$inferInsert;
export type Video = typeof videos.$inferSelect;
export type NewVideo = typeof videos.$inferInsert;
export type TranscriptSegment = typeof transcriptSegments.$inferSelect;
export type NewTranscriptSegment = typeof transcriptSegments.$inferInsert;
export type Bookmark = typeof bookmarks.$inferSelect;
export type NewBookmark = typeof bookmarks.$inferInsert;
export type SavedSearch = typeof savedSearches.$inferSelect;
export type SearchHistoryEntry = typeof searchHistory.$inferSelect;
export type ProcessingJob = typeof processingJobs.$inferSelect;
