/**
 * Database migration script.
 * Run: npx tsx src/db/migrate.ts
 * 
 * This creates all tables and enables the pgvector + pg_trgm extensions.
 * Must be run once before starting the application.
 */
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function main() {
  console.log('🚀 Starting database migration...');

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    // Enable required PostgreSQL extensions
    console.log('📦 Enabling PostgreSQL extensions...');
    await pool.query('CREATE EXTENSION IF NOT EXISTS vector;');
    await pool.query('CREATE EXTENSION IF NOT EXISTS pg_trgm;');
    console.log('  ✓ pgvector enabled');
    console.log('  ✓ pg_trgm enabled');

    const db = drizzle(pool);

    // Run Drizzle migrations
    console.log('🔄 Running schema migrations...');
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('  ✓ Migrations complete');

    // Create full-text search index (not expressible in Drizzle schema directly)
    console.log('🔍 Creating full-text search indexes...');
    await pool.query(`
      CREATE INDEX IF NOT EXISTS transcript_segments_fts_idx 
      ON transcript_segments USING GIN (to_tsvector('english', text));
    `);
    console.log('  ✓ FTS GIN index created');

    // Create vector similarity index (HNSW for approximate nearest neighbor)
    console.log('🧠 Creating vector similarity index...');
    await pool.query(`
      CREATE INDEX IF NOT EXISTS transcript_segments_embedding_idx 
      ON transcript_segments USING hnsw (embedding vector_cosine_ops);
    `);
    console.log('  ✓ HNSW vector index created');

    console.log('\n✅ Database setup complete! You can now start the application.');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
