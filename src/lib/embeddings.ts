/**
 * Local embedding service using @huggingface/transformers.
 * Runs the all-MiniLM-L6-v2 model locally — no API key, completely free.
 * Produces 384-dimensional embeddings.
 */

// @huggingface/transformers is loaded dynamically to avoid issues with
// Next.js server components and to lazy-load the model only when needed.

let pipelineInstance: ((text: string, options: object) => Promise<{ data: Float32Array }>) | null = null;

async function getPipeline() {
  if (pipelineInstance) return pipelineInstance;

  console.log('[Embeddings] Loading all-MiniLM-L6-v2 model...');
  const { pipeline } = await import('@huggingface/transformers');

  const pipe = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
    // Use quantized model for faster inference
    dtype: 'q8',
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pipelineInstance = pipe as any;
  console.log('[Embeddings] Model loaded ✓');
  return pipelineInstance!;
}

/**
 * Generate a 384-dimensional embedding for a piece of text.
 * The embedding is normalized (unit vector) for cosine similarity comparisons.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const pipe = await getPipeline();

  const output = await pipe(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

/**
 * Generate embeddings for multiple texts in one call.
 * More efficient than calling generateEmbedding in a loop for large batches.
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  return Promise.all(texts.map((t) => generateEmbedding(t)));
}

/**
 * Format a vector array into PostgreSQL's vector literal format.
 * e.g. [0.1, 0.2, 0.3] → '[0.1,0.2,0.3]'
 */
export function formatVector(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}
