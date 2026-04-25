/**
 * 台灣 TFDA 化粧品法規資料集上傳腳本
 * 執行前請先在 Supabase SQL Editor 執行 create-cosmetic-regulations.sql
 *
 * 執行方式：node scripts/upload-regulations.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { parse } from 'csv-parse/sync'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(__dirname, '..')
const datasetDir = path.join(rootDir, 'dataset')

// 從環境變數讀取（支援 .env 格式）
function loadEnv() {
  const envPath = path.join(rootDir, '.env')
  if (!fs.existsSync(envPath)) return
  const lines = fs.readFileSync(envPath, 'utf8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    const key = trimmed.slice(0, idx).trim()
    const val = trimmed.slice(idx + 1).trim()
    if (!process.env[key]) process.env[key] = val
  }
}

loadEnv()

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('缺少 SUPABASE_URL 或 SUPABASE_ANON_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// 色素使用範圍編碼解碼
const COLOR_SCOPE_MAP = {
  '1': '所有化粧品',
  '2': '除眼部周圍產品外之所有化粧品',
  '3': '化粧品（不得接觸黏膜）',
  '4': '僅供沖洗性化粧品',
}

function readCsv(filename) {
  const filepath = path.join(datasetDir, filename)
  const content = fs.readFileSync(filepath, 'utf8')
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
    trim: true,
  })
}

function cleanText(val) {
  if (!val || val.trim() === '') return null
  return val.trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

// ── 1. 禁止使用成分 ──────────────────────────────────────────
function parseBanned() {
  const rows = readCsv('化粧品禁止使用成分資料集.csv')
  return rows.map((r) => ({
    regulation_type: 'banned',
    source_id: cleanText(r['編號']),
    ingredient_name: cleanText(r['成分名稱']) || '(未命名)',
    inci_name: null,
    cas_number: cleanText(r['CAS_Number']),
    aliases: null,
    color_index_number: null,
    product_scope: null,
    limit_standard: null,
    restriction_rules: null,
    warning_labels: null,
    notes: cleanText(r['備註']),
  }))
}

// ── 2. 使用限制成分 ──────────────────────────────────────────
function parseRestricted() {
  const rows = readCsv('化粧品成分使用限制資料集.csv')
  return rows.map((r) => ({
    regulation_type: 'restricted',
    source_id: cleanText(r['編號']),
    ingredient_name: cleanText(r['成分名']) || cleanText(r['INCI名']) || '(未命名)',
    inci_name: cleanText(r['INCI名']),
    cas_number: cleanText(r['CAS_NO.']),
    aliases: null,
    color_index_number: null,
    product_scope: cleanText(r['產品類型／使用範圍']),
    limit_standard: cleanText(r['限量標準']),
    restriction_rules: cleanText(r['限制規定']),
    warning_labels: cleanText(r['應刊載之注意事項']),
    notes: null,
  }))
}

// ── 3. 防腐劑成分 ──────────────────────────────────────────
function parsePreservatives() {
  const rows = readCsv('化粧品防腐劑成分名稱及使用限制資料集.csv')
  return rows.map((r) => {
    // INCI名可能有多個，用 / 或換行分隔，統一存為單一字串
    const inciRaw = cleanText(r['INCI名'])
    const inciName = inciRaw
      ? inciRaw.replace(/\n/g, ' / ').replace(/\s{2,}/g, ' ').trim()
      : null

    const casRaw = cleanText(r['CAS_No.'])
    const casNumber = casRaw
      ? casRaw.replace(/\n/g, ' / ').replace(/\s{2,}/g, ' ').trim()
      : null

    return {
      regulation_type: 'preservative',
      source_id: cleanText(r['編號']),
      ingredient_name: cleanText(r['成分名']) || inciName || '(未命名)',
      inci_name: inciName,
      cas_number: casNumber,
      aliases: null,
      color_index_number: null,
      product_scope: cleanText(r['產品類型／使用範圍']),
      limit_standard: cleanText(r['限量標準']),
      restriction_rules: cleanText(r['限制規定']),
      warning_labels: cleanText(r['應刊載之注意事項']),
      notes: null,
    }
  })
}

// ── 4. 色素成分 ──────────────────────────────────────────────
function parseColorants() {
  const rows = readCsv('化粧品色素成分使用限制資料集.csv')
  return rows.map((r) => {
    const ciName = cleanText(r['Color_Index_Number／成分名'])
    // 判斷是否為 CI 號（以 CI 開頭）
    const isCI = ciName && ciName.toUpperCase().startsWith('CI ')
    const colorIndexNumber = isCI ? ciName : null
    const ingredientName = isCI ? (cleanText(r['別名'])?.split('\n')[0] || ciName) : (ciName || '(未命名)')

    const scopeCode = cleanText(r['使用範圍'])
    const productScope = scopeCode ? (COLOR_SCOPE_MAP[scopeCode] || `範圍代碼：${scopeCode}`) : null

    const aliasesRaw = cleanText(r['別名'])
    const aliases = aliasesRaw ? aliasesRaw.replace(/\n/g, ' | ') : null

    return {
      regulation_type: 'colorant',
      source_id: cleanText(r['編號']),
      ingredient_name: ingredientName,
      inci_name: null,
      cas_number: null,
      aliases,
      color_index_number: colorIndexNumber,
      product_scope: productScope,
      limit_standard: null,
      restriction_rules: cleanText(r['限制規定']),
      warning_labels: null,
      notes: cleanText(r['備註']),
    }
  })
}

// ── 批次插入 ─────────────────────────────────────────────────
async function batchInsert(rows, label, batchSize = 100) {
  let successCount = 0
  let errorCount = 0

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)
    const { error } = await supabase.from('cosmetic_regulations').insert(batch)
    if (error) {
      console.error(`  ✗ ${label} batch ${i}~${i + batch.length} 失敗:`, error.message)
      errorCount += batch.length
    } else {
      successCount += batch.length
      process.stdout.write(`  ${label}: ${successCount}/${rows.length}\r`)
    }
  }
  console.log(`  ✓ ${label}: ${successCount} 筆成功, ${errorCount} 筆失敗`)
  return { successCount, errorCount }
}

// ── 主程序 ───────────────────────────────────────────────────
async function main() {
  console.log('=== 台灣 TFDA 化粧品法規資料集上傳 ===\n')

  // 先確認表存在
  const { error: checkError } = await supabase
    .from('cosmetic_regulations')
    .select('id')
    .limit(1)

  if (checkError) {
    console.error('無法連接 cosmetic_regulations 表。請先在 Supabase SQL Editor 執行 create-cosmetic-regulations.sql')
    console.error('錯誤:', checkError.message)
    process.exit(1)
  }

  const datasets = [
    { label: '禁止使用成分 (banned)', parse: parseBanned },
    { label: '使用限制成分 (restricted)', parse: parseRestricted },
    { label: '防腐劑成分 (preservative)', parse: parsePreservatives },
    { label: '色素成分 (colorant)', parse: parseColorants },
  ]

  let totalSuccess = 0
  let totalError = 0

  for (const { label, parse } of datasets) {
    console.log(`\n[${label}]`)
    let rows
    try {
      rows = parse()
      console.log(`  解析完成：${rows.length} 筆`)
    } catch (err) {
      console.error(`  解析失敗:`, err.message)
      continue
    }

    const { successCount, errorCount } = await batchInsert(rows, label)
    totalSuccess += successCount
    totalError += errorCount
  }

  console.log(`\n=== 完成 ===`)
  console.log(`總計成功：${totalSuccess} 筆`)
  console.log(`總計失敗：${totalError} 筆`)

  if (totalError > 0) {
    console.log('\n若有失敗，可能原因：')
    console.log('1. INSERT 權限不足 → 確認已執行 SQL: GRANT INSERT ON cosmetic_regulations TO anon;')
    console.log('2. 表不存在 → 執行 create-cosmetic-regulations.sql')
  }
}

main().catch(console.error)
