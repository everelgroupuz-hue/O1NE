-- Add GIN indexes for JSONB full-text search performance
-- and create search_products RPC function

-- Enable trigram extension for ILIKE optimization
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN-индексы для быстрого текстового поиска по JSONB
CREATE INDEX IF NOT EXISTS idx_products_name_ru_gin
  ON products USING gin ((name->>'ru') gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_name_uz_gin
  ON products USING gin ((name->>'uz') gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_desc_ru_gin
  ON products USING gin ((description->>'ru') gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_desc_uz_gin
  ON products USING gin ((description->>'uz') gin_trgm_ops);

-- RPC-функция для поиска товаров (обходит проблему с PostgREST .or() фильтром)
CREATE OR REPLACE FUNCTION search_products(p_query text)
RETURNS SETOF products
LANGUAGE sql STABLE
AS $$
  SELECT * FROM products
  WHERE is_active = true
    AND (
      name->>'ru' ILIKE '%' || p_query || '%'
      OR name->>'uz' ILIKE '%' || p_query || '%'
      OR description->>'ru' ILIKE '%' || p_query || '%'
      OR description->>'uz' ILIKE '%' || p_query || '%'
    )
  ORDER BY created_at DESC
  LIMIT 20;
$$;
