-- ================================================================
-- 皮膚科醫學文獻向量資料表 (PubMed RAG 知識庫)
-- 在 Supabase SQL Editor 執行此檔案
-- ================================================================

-- 啟用 pgvector 擴充（Supabase 免費版內建支援）
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS medical_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 來源追蹤
  source TEXT NOT NULL DEFAULT 'pubmed',         -- pubmed / cochrane / 其他
  source_id TEXT NOT NULL,                       -- PubMed PMID
  ingredient_query TEXT NOT NULL,                -- 觸發爬取的成分（e.g. 'retinol'）

  -- 內容
  title TEXT,
  abstract TEXT,
  authors TEXT,
  journal TEXT,
  publication_year INT,
  doi TEXT,

  -- 切塊資訊
  chunk_index INT NOT NULL DEFAULT 0,
  chunk_text TEXT NOT NULL,

  -- 向量（Gemini text-embedding-004 = 768 dim）
  embedding vector(768),

  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE (source, source_id, chunk_index)        -- 同一篇同一 chunk 不重複
);

-- ANN 索引（IVFFlat 適合 free tier，HNSW 較吃記憶體）
CREATE INDEX IF NOT EXISTS idx_medical_documents_embedding
  ON medical_documents USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_medical_documents_ingredient
  ON medical_documents (ingredient_query);

-- 與 cosmetic_regulations 一致：不啟用 RLS，授予 anon insert 權限
GRANT SELECT, INSERT, UPDATE, DELETE ON medical_documents TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON medical_documents TO authenticated;

-- 餘弦相似度檢索 RPC
CREATE OR REPLACE FUNCTION match_medical_documents(
  query_embedding vector(768),
  match_count INT DEFAULT 3,
  ingredient_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  abstract TEXT,
  chunk_text TEXT,
  journal TEXT,
  publication_year INT,
  doi TEXT,
  ingredient_query TEXT,
  similarity FLOAT
)
LANGUAGE sql STABLE AS $$
  SELECT
    md.id,
    md.title,
    md.abstract,
    md.chunk_text,
    md.journal,
    md.publication_year,
    md.doi,
    md.ingredient_query,
    1 - (md.embedding <=> query_embedding) AS similarity
  FROM medical_documents md
  WHERE md.embedding IS NOT NULL
    AND (ingredient_filter IS NULL OR md.ingredient_query = ingredient_filter)
  ORDER BY md.embedding <=> query_embedding
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION match_medical_documents(vector, int, text) TO anon;
GRANT EXECUTE ON FUNCTION match_medical_documents(vector, int, text) TO authenticated;
