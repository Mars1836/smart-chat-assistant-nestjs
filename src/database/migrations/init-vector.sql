CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS document_vectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  content text,
  metadata jsonb,
  embedding vector(768), -- Gemini Embedding defaults to 768 dimensions
  created_at timestamp DEFAULT now()
);

CREATE INDEX ON document_vectors USING hnsw (embedding vector_cosine_ops);
