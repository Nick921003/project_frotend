/**
 * PubMed 皮膚科醫學文獻爬取與向量化腳本
 *
 * 流程：成分 → PubMed esearch (取 PMID) → efetch (取 abstract)
 *      → chunking → Gemini text-embedding-004 → Supabase pgvector
 *
 * 執行前請先在 Supabase SQL Editor 執行 scripts/create-medical-documents.sql
 *
 * 執行方式：
 *   node scripts/scrape-pubmed.mjs                       # 全部 15 種成分
 *   node scripts/scrape-pubmed.mjs retinol niacinamide   # 指定成分
 *
 * 環境變數：
 *   SUPABASE_URL, SUPABASE_ANON_KEY  (必要)
 *   GEMINI_API_KEY                   (必要)
 *   NCBI_API_KEY                     (選填，提速到 10 RPS)
 */

import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { XMLParser } from 'fast-xml-parser'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(__dirname, '..')

// ── 環境變數載入（沿用 upload-regulations.mjs 模式）─────────────
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
const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const NCBI_API_KEY = process.env.NCBI_API_KEY || ''

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('缺少 SUPABASE_URL 或 SUPABASE_ANON_KEY')
  process.exit(1)
}
if (!GEMINI_API_KEY) {
  console.error('缺少 GEMINI_API_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)
const embedModel = genAI.getGenerativeModel({ model: 'text-embedding-004' })

// ── 種子成分（15 種高人氣活性）────────────────────────────────
const INGREDIENT_SEEDS = [
  'retinol', 'retinoic acid', 'niacinamide', 'salicylic acid', 'glycolic acid',
  'lactic acid', 'hyaluronic acid', 'ascorbic acid', 'azelaic acid',
  'alpha arbutin', 'tranexamic acid', 'ceramide', 'peptide',
  'benzoyl peroxide', 'adapalene',
]

// ── 設定 ──────────────────────────────────────────────────────
const PUBMED_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils'
const PER_INGREDIENT_LIMIT = 20            // 每成分抓 20 篇 review
const RECENT_YEARS = 5                     // 近 5 年
const CHUNK_SIZE = 500                     // 每個 chunk ~500 字
const CHUNK_OVERLAP = 50                   // overlap 50 字
const EMBED_RPM_DELAY_MS = 700             // ~85 RPM，安全低於 100 RPM 上限
const PUBMED_DELAY_MS = NCBI_API_KEY ? 110 : 350  // 有 key 9 RPS，無 key 3 RPS

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ── 重試包裝（exponential backoff）────────────────────────────
async function withRetry(fn, label, maxAttempts = 4) {
  let lastErr
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      const status = err?.status || err?.response?.status
      const isRateLimited = status === 429 || (status >= 500 && status < 600)
      if (attempt === maxAttempts || !isRateLimited) throw err
      const wait = 2 ** attempt * 1000
      console.warn(`  ⚠ ${label} 失敗 (${status})，${wait}ms 後重試 (${attempt}/${maxAttempts - 1})`)
      await sleep(wait)
    }
  }
  throw lastErr
}

// ── PubMed esearch：拿 PMID 列表 ──────────────────────────────
async function searchPubMed(ingredient) {
  const term = encodeURIComponent(`${ingredient}[Title/Abstract] AND skin[MeSH] AND review[Publication Type]`)
  const minDate = new Date().getFullYear() - RECENT_YEARS
  const url = `${PUBMED_BASE}/esearch.fcgi?db=pubmed&term=${term}&retmax=${PER_INGREDIENT_LIMIT}&retmode=json&mindate=${minDate}&datetype=pdat${NCBI_API_KEY ? `&api_key=${NCBI_API_KEY}` : ''}`

  return withRetry(async () => {
    const res = await fetch(url)
    if (!res.ok) {
      const e = new Error(`esearch HTTP ${res.status}`)
      e.status = res.status
      throw e
    }
    const json = await res.json()
    return json?.esearchresult?.idlist || []
  }, `esearch[${ingredient}]`)
}

// ── PubMed efetch：拿 abstract XML，解析後回傳結構化資料 ──────
async function fetchAbstracts(pmids) {
  if (pmids.length === 0) return []
  const url = `${PUBMED_BASE}/efetch.fcgi?db=pubmed&id=${pmids.join(',')}&rettype=abstract&retmode=xml${NCBI_API_KEY ? `&api_key=${NCBI_API_KEY}` : ''}`

  const xmlText = await withRetry(async () => {
    const res = await fetch(url)
    if (!res.ok) {
      const e = new Error(`efetch HTTP ${res.status}`)
      e.status = res.status
      throw e
    }
    return res.text()
  }, `efetch[${pmids.length} pmids]`)

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    parseAttributeValue: false,
  })
  const parsed = parser.parse(xmlText)
  const articles = parsed?.PubmedArticleSet?.PubmedArticle
  if (!articles) return []
  const list = Array.isArray(articles) ? articles : [articles]

  return list.map((a) => extractArticleFields(a)).filter(Boolean)
}

function joinTextNodes(node) {
  if (node == null) return ''
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(joinTextNodes).join(' ')
  if (typeof node === 'object') {
    if ('#text' in node) return joinTextNodes(node['#text'])
    return Object.entries(node)
      .filter(([k]) => !k.startsWith('@_'))
      .map(([, v]) => joinTextNodes(v))
      .join(' ')
  }
  return ''
}

function extractArticleFields(article) {
  try {
    const citation = article.MedlineCitation
    if (!citation) return null
    const pmid = joinTextNodes(citation.PMID).trim()
    const art = citation.Article || {}

    const title = joinTextNodes(art.ArticleTitle).trim()

    // AbstractText 可能是字串、物件、或陣列（多段）
    const abstractRaw = art.Abstract?.AbstractText
    const abstractText = joinTextNodes(abstractRaw).replace(/\s+/g, ' ').trim()
    if (!abstractText) return null

    const journal = joinTextNodes(art.Journal?.Title).trim() || joinTextNodes(art.Journal?.ISOAbbreviation).trim()

    // 出版年：嘗試 Journal.JournalIssue.PubDate.Year，再退而求其次 MedlineDate
    let year = null
    const pubDate = art.Journal?.JournalIssue?.PubDate
    if (pubDate?.Year) {
      year = parseInt(joinTextNodes(pubDate.Year), 10)
    } else if (pubDate?.MedlineDate) {
      const m = joinTextNodes(pubDate.MedlineDate).match(/\d{4}/)
      if (m) year = parseInt(m[0], 10)
    }

    // DOI：在 PubmedData.ArticleIdList.ArticleId 找 IdType=doi
    let doi = null
    const ids = article.PubmedData?.ArticleIdList?.ArticleId
    if (ids) {
      const idArr = Array.isArray(ids) ? ids : [ids]
      const doiNode = idArr.find((id) => id?.['@_IdType'] === 'doi')
      if (doiNode) doi = joinTextNodes(doiNode).trim() || null
    }

    // 作者：取前 3 位
    let authors = null
    const authorList = art.AuthorList?.Author
    if (authorList) {
      const arr = Array.isArray(authorList) ? authorList : [authorList]
      authors = arr.slice(0, 3).map((au) => {
        const last = joinTextNodes(au.LastName).trim()
        const initials = joinTextNodes(au.Initials).trim()
        return [last, initials].filter(Boolean).join(' ')
      }).filter(Boolean).join(', ') || null
    }

    return { pmid, title, abstract: abstractText, journal: journal || null, year, doi, authors }
  } catch (err) {
    console.warn('  ⚠ 解析單篇文獻失敗:', err.message)
    return null
  }
}

// ── Text chunking（簡單字元切片 + overlap）────────────────────
function chunkText(text, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (cleaned.length <= size) return [cleaned]
  const chunks = []
  let start = 0
  while (start < cleaned.length) {
    const end = Math.min(start + size, cleaned.length)
    chunks.push(cleaned.slice(start, end))
    if (end === cleaned.length) break
    start = end - overlap
  }
  return chunks
}

// ── Gemini Embedding ──────────────────────────────────────────
async function embedChunk(text) {
  return withRetry(async () => {
    const result = await embedModel.embedContent(text)
    const values = result?.embedding?.values
    if (!Array.isArray(values) || values.length !== 768) {
      throw new Error(`embedding 長度異常: ${values?.length}`)
    }
    return values
  }, 'embed', 4)
}

// 偵測 Gemini quota / rate limit 錯誤訊息
function isQuotaError(err) {
  const msg = (err?.message || '').toLowerCase()
  return msg.includes('quota') || msg.includes('exhausted') || msg.includes('resource_exhausted') || err?.status === 429
}

// ── Supabase upsert ──────────────────────────────────────────
async function upsertChunk(row) {
  const { error } = await supabase
    .from('medical_documents')
    .upsert(row, { onConflict: 'source,source_id,chunk_index' })
  if (error) throw new Error(error.message)
}

// ── 單一成分 pipeline ─────────────────────────────────────────
async function processIngredient(ingredient) {
  console.log(`\n[${ingredient}]`)

  let pmids
  try {
    pmids = await searchPubMed(ingredient)
  } catch (err) {
    console.error(`  ✗ esearch 失敗，跳過:`, err.message)
    return { ingredient, success: 0, failed: 0, skipped: true }
  }
  if (pmids.length === 0) {
    console.log(`  (無結果)`)
    return { ingredient, success: 0, failed: 0, skipped: false }
  }
  console.log(`  esearch 命中 ${pmids.length} 篇 PMID`)
  await sleep(PUBMED_DELAY_MS)

  let articles
  try {
    articles = await fetchAbstracts(pmids)
  } catch (err) {
    console.error(`  ✗ efetch 失敗，跳過:`, err.message)
    return { ingredient, success: 0, failed: 0, skipped: true }
  }
  console.log(`  efetch 拿到 ${articles.length} 篇有效 abstract`)

  let successChunks = 0
  let failedChunks = 0

  for (const art of articles) {
    const chunks = chunkText(art.abstract)
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      try {
        const embedding = await embedChunk(chunk)
        await upsertChunk({
          source: 'pubmed',
          source_id: art.pmid,
          ingredient_query: ingredient,
          title: art.title,
          abstract: art.abstract,
          authors: art.authors,
          journal: art.journal,
          publication_year: art.year,
          doi: art.doi,
          chunk_index: i,
          chunk_text: chunk,
          embedding,
        })
        successChunks++
        process.stdout.write(`  embed+upsert: ${successChunks}\r`)
      } catch (err) {
        failedChunks++
        if (isQuotaError(err)) {
          console.error(`\n  ✗ Gemini quota 用盡，停止此成分後續：`, err.message)
          return { ingredient, success: successChunks, failed: failedChunks, skipped: true, quotaExhausted: true }
        }
        console.warn(`\n  ⚠ chunk ${art.pmid}#${i} 失敗:`, err.message)
      }
      await sleep(EMBED_RPM_DELAY_MS)
    }
  }
  console.log(`  ✓ ${ingredient}: ${successChunks} chunks 成功, ${failedChunks} chunks 失敗`)
  return { ingredient, success: successChunks, failed: failedChunks, skipped: false }
}

// ── 主程序 ───────────────────────────────────────────────────
async function main() {
  console.log('=== PubMed 皮膚科文獻向量化 ===')

  // 確認表存在
  const { error: checkError } = await supabase
    .from('medical_documents')
    .select('id')
    .limit(1)
  if (checkError) {
    console.error('無法連接 medical_documents 表。請先執行 scripts/create-medical-documents.sql')
    console.error('錯誤:', checkError.message)
    process.exit(1)
  }

  const argv = process.argv.slice(2).map((s) => s.toLowerCase().trim()).filter(Boolean)
  const targets = argv.length > 0 ? argv : INGREDIENT_SEEDS
  console.log(`目標成分（${targets.length}）：${targets.join(', ')}`)
  if (NCBI_API_KEY) console.log('使用 NCBI API key（10 RPS）')

  const summary = []
  let quotaHit = false

  for (const ing of targets) {
    if (quotaHit) {
      console.log(`\n[${ing}] 跳過（先前已觸發 Gemini quota）`)
      summary.push({ ingredient: ing, success: 0, failed: 0, skipped: true })
      continue
    }
    const r = await processIngredient(ing)
    summary.push(r)
    if (r.quotaExhausted) quotaHit = true
  }

  console.log('\n=== 總結 ===')
  for (const r of summary) {
    const flag = r.skipped ? ' (跳過)' : ''
    console.log(`  ${r.ingredient}: 成功 ${r.success}, 失敗 ${r.failed}${flag}`)
  }
  const totalSuccess = summary.reduce((s, r) => s + r.success, 0)
  console.log(`\n總計成功 chunks: ${totalSuccess}`)
  if (quotaHit) {
    console.log('⚠ 觸發 Gemini 免費層每日 quota，請隔日重跑剩餘成分。')
  }
}

main().catch((err) => {
  console.error('未捕獲錯誤:', err)
  process.exit(1)
})
