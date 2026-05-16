# 今日排程頁面重設計

**日期：** 2026-05-16  
**目標檔案：** `pages/routines/active.vue`  
**狀態：** 已核准，待實作

---

## 設計目標

將今日排程頁從「基本清單」升級為有「今日專注感」與「儀式感」的頁面，結合進度視覺化（方向 A）與 Timeline 步驟樣式（方向 B）。

---

## 變更範圍

### 1. 頂部進度卡（新增）

- 位於標題列與星期 tab 之間
- 顯示今日總步驟數與已完成數（如 `3 / 6 步驟`）
- 橫向進度條：fill 為 sage→accent 漸層，圓角 pill
- 副文字：早晨 X/Y 完成・晚間 X/Y 完成
- CSS class：`.progress-card`，用 `<style scoped>` 加在 `active.vue`

### 2. 星期 tab 升級（修改現有）

- 保留 7 個 tab，但每個 tab 新增「打卡小點」：該天有步驟則顯示，已全部打卡為 sage 色，部分完成為 muted，未打卡為 border 色
- 今日 tab：`background: var(--color-accent)`，字體加大加粗，`padding` 略高，box-shadow
- 其他天 tab：維持目前尺寸
- **注意**：小點資料只在「今天」有實際 checkin 資料（來自 API）；其他天無 checkin 資料，點固定顯示為 border 色（灰），不呼叫額外 API

### 3. 步驟列表 → Timeline 樣式（修改現有）

取代 `.item-row`，改為 `.tl-item` Timeline 結構：

```
[tl-node] ─── [tl-body]
     |
[tl-node] ─── [tl-body]
     |
[tl-node] ─── [tl-body]
```

- `tl-node`：32px 圓形，未完成顯示序號（灰），完成填 sage + 白勾
- 連接線：`.timeline::before` 偽元素，`left: 36px`（20px padding + 16px half-node），2px `var(--color-border)`
- `tl-body`：`var(--color-surface-alt)` 背景，1px border，`border-radius: var(--radius-md)`
  - 主行：產品名稱（15px）
  - 副行：功效標籤（暫用空字串或省略，避免需要額外 API）
- 已完成狀態（`.done-item`）：`tl-body` 改 `sage-light` 背景，名稱加刪除線，opacity 0.75

**打卡行為不變**：`handleToggleCheckin()` 邏輯與現有相同，只是 UI 改為點擊 `tl-node` 觸發

### 4. 完成慶祝 banner（新增）

- 條件：`computed` → 今天所有步驟（`dayItems`）全部打卡完成
- `v-if="allDoneToday"` 顯示在 Timeline 卡片下方
- 內容：「今日保養完成」標題 + 靜態說明文字（不做連續天數，避免新增 API）
- 樣式：`sage-light` 背景、`sage` 色邊框、`border-radius: var(--radius-md)`

---

## 資料流

**不新增任何 API 呼叫。** 所有變更純前端，使用現有：
- `dayItems`（今天的 routine items）
- `morningItems` / `eveningItems`（現有 computed）
- `checkedItemIds`（現有 Set，toggleCheckin 現有 API）
- `loadCheckins()` on mount（不變）

進度計算：
```ts
const totalToday = computed(() => dayItems.value.length)
const doneToday  = computed(() => dayItems.value.filter(i => checkedItemIds.value.has(i.id)).length)
const allDoneToday = computed(() => totalToday.value > 0 && doneToday.value === totalToday.value)
const morningDone = computed(() => morningItems.value.filter(i => checkedItemIds.value.has(i.id)).length)
const eveningDone = computed(() => eveningItems.value.filter(i => checkedItemIds.value.has(i.id)).length)
```

---

## 不在範圍內

- 連續打卡天數 streak（需新 API）
- 步驟副文字功效標籤（需擴充 RoutineItem 型別 + API）
- 其他星期的 checkin 小點（只顯示今天，其他灰）
- 動畫 / confetti（文清風，保持克制）

---

## 設計 token 對照

| 用途 | Token |
|------|-------|
| 進度條 fill | `var(--color-sage)` → `var(--color-accent)` |
| 今日 tab 背景 | `var(--color-accent)` |
| Timeline 節點已完成 | `var(--color-sage)` |
| 完成 item 背景 | `var(--color-sage-light)` |
| 完成 banner 背景 | `var(--color-sage-light)` |
