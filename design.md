# Beauty Analyzer 設計系統

## 風格定義：文清風

乾淨、文學感、留白為主。莫蘭迪暖色系。無多餘裝飾，極少 icon，以文字和結構傳遞層次。

---

## 色彩系統

```css
/* 背景層次 */
--color-bg:         #F5F0EB;   /* 米白背景 */
--color-surface:    #EDE7DF;   /* 卡片/面板背景 */
--color-border:     #D4C8BC;   /* 邊框、分隔線 */

/* 文字層次 */
--color-text-primary:   #3D3530;   /* 主要文字 */
--color-text-secondary: #7A6E68;   /* 次要文字、標籤 */
--color-text-muted:     #A89F98;   /* 灰暗說明文字 */

/* 語意色（莫蘭迪調） */
--color-sage:       #8FA89C;   /* 霧綠：安全、成功 */
--color-rose:       #C4958A;   /* 霧玫：警告、注意 */
--color-amber:      #C4A882;   /* 暖琥珀：提示 */
--color-critical:   #B07070;   /* 深玫紅：禁用成分 */

/* 互動 */
--color-primary:       #8FA89C;
--color-primary-hover: #7A9690;
```

---

## 字體

```css
--font-serif: 'Noto Serif TC', 'Georgia', serif;
--font-sans:  'Noto Sans TC', 'system-ui', sans-serif;
```

- 頁面標題、區塊標題：serif
- 內文、操作文字、表單：sans
- INCI 成分名稱可用 monospace（選用）

---

## 間距與圓角

```css
--space-xs:  4px;
--space-sm:  8px;
--space-md:  16px;
--space-lg:  24px;
--space-xl:  40px;

--radius-sm: 4px;
--radius-md: 8px;

--border: 1px solid var(--color-border);
```

---

## 元件規範

### 卡片
```css
background: var(--color-surface);
border: var(--border);
border-radius: var(--radius-md);
padding: var(--space-md) var(--space-lg);
/* 無 box-shadow，層次靠背景色差異 */
```

### 按鈕
| 類型 | 樣式 |
|------|------|
| 主要 | 霧綠底 `#8FA89C`，白字，無邊框 |
| 次要 | 透明底，`--color-border` 邊框，深棕字 |
| 危險 | 透明底，`--color-critical` 邊框和文字 |

### 標籤（Tag）
純文字，無 icon，小圓角背景。

| 類型 | 背景 | 文字 |
|------|------|------|
| 安全 | `#DFF0EA` | `#4A7C6F` |
| 警告 | `#F5EAE0` | `#8C5C40` |
| 禁用 | `#F0DEDE` | `#7C4040` |
| 功效 | `#EAE8F0` | `#5C5080` |

---

## 版面原則

1. **留白優先** — 區塊間距至少 `--space-lg`，重要分隔用 `--space-xl`
2. **無 icon 原則** — 能用文字的不加 icon；只保留功能性符號（× 關閉、▾ 展開）
3. **單欄為主** — 手機優先；桌機最多雙欄
4. **字級層次**
   - 頁面標題：`22px` serif
   - 區塊標題：`16px` serif
   - 內文：`14px` sans
   - 輔助說明：`12px` sans，`--color-text-muted`

---

## 工作流程

**改 UI 前先更新此檔**，確認設計決策後再動 CSS/Vue。
design.md 是設計唯一真相來源。

## CSS 入口

`assets/css/main.css` — 全域變數定義在此，Nuxt 已自動載入。

## 套用優先順序（第 4 週）

1. `pages/products/[id]/edit.vue`
2. `pages/index.vue`（Cabinet 列表）
3. `pages/routines/[id].vue`
4. `pages/profile.vue`
