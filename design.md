# Beauty Analyzer 設計系統

## 風格定義：文清風

乾淨、文學感、留白為主。莫蘭迪暖色系。無多餘裝飾，極少 icon，以文字和結構傳遞層次。

> **修改 UI 前必讀此檔**，所有設計決策以此為唯一真相。CSS 變數定義於 `assets/css/main.css`。

---

## 色彩系統

```css
/* 背景與表面 */
--color-bg:           #F5F0EB;   /* 米白背景 */
--color-surface:      #FFFFFF;   /* 卡片/面板背景 */
--color-surface-alt:  #EDE7E0;   /* 次要表面 */
--color-border:       #E0D6CC;   /* 邊框、分隔線 */
--color-border-light: #EAE4DE;   /* 淡邊框 */

/* 文字層次 */
--color-text-primary:   #3D3530;   /* 主要文字 */
--color-text-secondary: #7A6E68;   /* 次要文字、標籤 */
--color-text-muted:     #B0A49C;   /* 灰暗說明文字 */

/* 主強調色：霧玫 */
--color-accent:       #C4958A;   /* primary CTA */
--color-accent-hover: #A87B71;
--color-accent-light: #F7EDEB;   /* focus ring / hover bg */

/* 輔助色：暖米 */
--color-warm:      #E8DDD0;
--color-warm-dark: #C4B5A5;

/* 語意色（莫蘭迪調） */
--color-sage:         #8FA89C;   /* 霧綠：安全、成功 */
--color-sage-light:   #EBF1EF;
--color-amber:        #C49A6A;   /* 即將到期警告 */
--color-amber-light:  #FAF0E5;
--color-red:          #B86B6B;   /* 錯誤 / 禁用 / 過期 */
--color-red-light:    #FAF0F0;
--color-gold:         #C9A96E;   /* 金色提示 */
--color-gold-light:   #FAF5EA;
```

---

## 字體

```css
--font-heading: 'Noto Serif TC', Georgia, serif;
--font-body:    'Noto Sans TC', system-ui, sans-serif;
```

| 用途 | 字型 | 大小 |
|------|------|------|
| 頁面標題 | `font-heading` | 22px |
| 區塊標題 | `font-heading` | 20px |
| 小標題 | `font-heading` | 16px |
| 內文 / 操作 / 表單 | `font-body` | 15px |
| 輔助說明 | `font-body` | 12–14px，`--color-text-muted` |

---

## 間距

```css
--space-1:  4px;
--space-2:  8px;
--space-3:  12px;
--space-4:  16px;
--space-5:  20px;
--space-6:  24px;
--space-8:  32px;
--space-10: 40px;
--space-12: 48px;
```

> **注意：`--space-sm` 不存在**，用 `--space-2`（8px）。`--space-xs/md/lg/xl` 亦已廢棄。

---

## 圓角 & 陰影

```css
--radius-sm:   4px;
--radius-md:   8px;
--radius-lg:   12px;
--radius-pill: 20px;

--shadow-sm: 0 1px 3px rgba(58, 50, 45, 0.08);
--shadow-md: 0 4px 12px rgba(58, 50, 45, 0.10);
--shadow-lg: 0 8px 24px rgba(58, 50, 45, 0.12);
```

---

## 元件規範

### 卡片（`.card`）

```css
background:    var(--color-surface);
border:        1px solid var(--color-border-light);
border-radius: var(--radius-lg);   /* 12px */
box-shadow:    var(--shadow-sm);
padding:       var(--space-6);
```

### 按鈕

| Class | 樣式 |
|-------|------|
| `.btn-primary` | 霧玫底（`--color-accent`），白字 |
| `.btn-ghost` | 透明底，霧玫邊框和文字 |
| `.btn-secondary` | `--color-surface-alt` 底，`--color-text-secondary` 字 |
| `.btn-danger` | `--color-red-light` 底，`--color-red` 字 |
| `.btn-sm` | padding 縮小，13px |
| `.btn-lg` | padding 放大，16px |

### 徽章（`.badge`）

| Class | 背景 | 文字 |
|-------|------|------|
| `.badge-sage` | `--color-sage-light` | `--color-sage` |
| `.badge-amber` | `--color-amber-light` | `--color-amber` |
| `.badge-red` | `--color-red-light` | `--color-red` |
| `.badge-gold` | `--color-gold-light` | `--color-gold` |
| `.badge-muted` | `--color-surface-alt` | `--color-text-secondary` |

### Alert 區塊（`.alert-block`）

左側 4px 色條 + 淡色背景。
Classes：`.alert-red` / `.alert-orange` / `.alert-yellow` / `.alert-green` / `.alert-gold`

### 狀態區塊（`.status-box`）

Classes：`.status-loading` / `.status-error` / `.status-success`

### 表單

- `label` → `.form-label`（14px, `--color-text-secondary`）
- `input` → `.form-input`（focus ring 用 `--color-accent-light`）
- 欄位包裝 → `.form-group`（下方 `--space-5` 間距）

---

## 版面原則

1. **留白優先** — 區塊間距至少 `--space-6`，重要分隔用 `--space-8`
2. **禁用 emoji 作為 icon** — 跨平台渲染不一致，改用 CSS 形狀或 SVG
3. **單欄為主** — 手機優先；桌機最多雙欄（`.page-container` max-width 720px，wide 版 1200px）
4. **不寫死顏色** — 一律用 CSS 變數
5. **無 `--border` 快捷變數** — 直接寫 `1px solid var(--color-border)`

---

## CSS 入口

`assets/css/main.css` — 全域變數與基礎元件定義於此，Nuxt 自動載入。

Tailwind 橋接 token，新元件可用：`bg-surface`、`text-accent`、`border-border`、`font-heading`、`font-body`。設定檔：`tailwind.config.ts`（`preflight: false`）。

---

## 工作流程

1. **改 UI 前先讀此檔** — 確認用正確的 token 和 class
2. 設計有更動 → 先更新 `design.md`，再動 CSS / Vue
3. 新 token 要先加進 `main.css`，再在此文件同步
