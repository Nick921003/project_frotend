-- ================================================================
-- 台灣 TFDA 化粧品法規資料表
-- 在 Supabase SQL Editor 執行此檔案
-- ================================================================

CREATE TABLE IF NOT EXISTS cosmetic_regulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 成分識別
  ingredient_name TEXT NOT NULL,
  inci_name TEXT,
  cas_number TEXT,
  aliases TEXT,
  color_index_number TEXT,

  -- 分類：banned | restricted | preservative | colorant
  regulation_type TEXT NOT NULL
    CHECK (regulation_type IN ('banned', 'restricted', 'preservative', 'colorant')),

  -- 限制資訊
  product_scope TEXT,
  limit_standard TEXT,
  restriction_rules TEXT,
  warning_labels TEXT,
  notes TEXT,

  -- 來源追蹤
  source_id TEXT,

  created_at TIMESTAMPTZ DEFAULT now()
);

-- 查詢效能索引
CREATE INDEX IF NOT EXISTS idx_regulations_inci ON cosmetic_regulations (inci_name);
CREATE INDEX IF NOT EXISTS idx_regulations_name ON cosmetic_regulations (ingredient_name);
CREATE INDEX IF NOT EXISTS idx_regulations_type ON cosmetic_regulations (regulation_type);
CREATE INDEX IF NOT EXISTS idx_regulations_cas ON cosmetic_regulations (cas_number);

-- 不啟用 RLS（公開參考資料，與 official_ingredients 相同策略）
-- 授予 anon 讀寫權限（讓上傳腳本可以用 anon key 插入）
GRANT SELECT, INSERT ON cosmetic_regulations TO anon;
GRANT SELECT, INSERT ON cosmetic_regulations TO authenticated;
