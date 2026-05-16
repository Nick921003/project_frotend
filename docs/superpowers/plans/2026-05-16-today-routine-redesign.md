# Today Routine Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 將 `pages/routines/active.vue` 升級為「今日專注 + Timeline 步驟」設計，加入進度卡、小點 tab、timeline 清單與完成 banner。

**Architecture:** 純前端修改，僅異動 `active.vue` 一個檔案。新增 4 個 computed（進度計算），template 分三塊重構（progress-card、day-tabs 升級、timeline 列表），CSS 全部寫在 `<style scoped>`。不新增任何 API 呼叫，全用現有 `checkedItemIds`、`morningItems`、`eveningItems`。

**Tech Stack:** Nuxt 4 / Vue 3 Composition API、Tailwind 未使用（此頁維持 scoped CSS）、CSS 變數來自 `assets/css/main.css`

---

### Task 1：新增進度計算 computed

**Files:**
- Modify: `pages/routines/active.vue`（`<script setup>` 區）

- [ ] **Step 1: 在現有 `eveningItems` computed 後方插入下列 5 個 computed**

在 [pages/routines/active.vue:59](pages/routines/active.vue#L59)（`eveningItems` computed 結束行）之後插入：

```typescript
// ── 今日進度計算 ──
const totalToday = computed(() => dayItems.value.length)
const doneToday  = computed(() =>
	dayItems.value.filter(i => checkedItemIds.value.has(i.id)).length
)
const allDoneToday = computed(() =>
	totalToday.value > 0 && doneToday.value === totalToday.value
)
const morningDone = computed(() =>
	morningItems.value.filter(i => checkedItemIds.value.has(i.id)).length
)
const eveningDone = computed(() =>
	eveningItems.value.filter(i => checkedItemIds.value.has(i.id)).length
)
```

- [ ] **Step 2: 確認 computed 名稱不與現有變數衝突**

搜尋 `active.vue` 確認無 `totalToday`、`doneToday`、`allDoneToday`、`morningDone`、`eveningDone` 重複宣告。

- [ ] **Step 3: Commit**

```bash
git add pages/routines/active.vue
git commit -m "feat(routine/active): add today progress computed properties"
```

---

### Task 2：新增進度卡 template + CSS

**Files:**
- Modify: `pages/routines/active.vue`（`<template>` 與 `<style scoped>`）

- [ ] **Step 1: 在 `<template>` 的 `<!-- 標題列 -->` 區塊後、`<!-- 內容卡片 -->` 前插入進度卡**

現有位置在 [pages/routines/active.vue:108](pages/routines/active.vue#L108)（`<div class="header-row">` 下方），插入：

```html
<!-- 今日進度卡 -->
<div class="progress-card">
    <div class="progress-top">
        <span class="progress-label">今日進度</span>
        <span class="progress-count">
            {{ doneToday }}<span class="progress-count-total"> / {{ totalToday }} 步驟</span>
        </span>
    </div>
    <div class="progress-bar-bg">
        <div
            class="progress-bar-fill"
            :style="{ width: totalToday > 0 ? (doneToday / totalToday * 100) + '%' : '0%' }"
        />
    </div>
    <p class="progress-sub">
        早晨 {{ morningDone }}/{{ morningItems.length }} 完成・晚間 {{ eveningDone }}/{{ eveningItems.length }} 完成
    </p>
</div>
```

- [ ] **Step 2: 在 `<style scoped>` 末尾新增進度卡 CSS**

```css
/* ── 進度卡 ── */
.progress-card {
	background: var(--color-surface);
	border: 1px solid var(--color-border);
	border-radius: var(--radius-md);
	padding: var(--space-4) var(--space-5);
	margin-bottom: var(--space-4);
	box-shadow: 0 1px 4px rgba(0,0,0,0.05);
}

.progress-top {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: var(--space-2);
}

.progress-label {
	font-family: var(--font-body);
	font-size: 13px;
	color: var(--color-text-secondary);
}

.progress-count {
	font-family: var(--font-heading);
	font-size: 22px;
	font-weight: 700;
	color: var(--color-accent);
}

.progress-count-total {
	font-family: var(--font-body);
	font-size: 13px;
	font-weight: 400;
	color: var(--color-text-muted);
}

.progress-bar-bg {
	height: 8px;
	background: var(--color-surface-alt);
	border-radius: var(--radius-pill);
	overflow: hidden;
	margin-bottom: var(--space-2);
}

.progress-bar-fill {
	height: 100%;
	background: linear-gradient(90deg, var(--color-sage) 0%, var(--color-accent) 100%);
	border-radius: var(--radius-pill);
	transition: width 0.4s ease;
}

.progress-sub {
	font-family: var(--font-body);
	font-size: 11px;
	color: var(--color-text-muted);
}
```

- [ ] **Step 3: 啟動 dev server 確認進度卡顯示正確**

```bash
npm run dev
```

瀏覽 `http://localhost:3000/routines/active`，確認：
- 進度卡在標題列下方、星期 tab 上方
- 打卡後數字即時更新、進度條移動

- [ ] **Step 4: Commit**

```bash
git add pages/routines/active.vue
git commit -m "feat(routine/active): add today progress card with animated bar"
```

---

### Task 3：升級星期 tab（今日高亮 + 打卡小點）

**Files:**
- Modify: `pages/routines/active.vue`（`<template>` 的 `.day-tabs` 區塊 + `<style scoped>`）

- [ ] **Step 1: 將現有 `.day-tabs` 區塊替換為以下 template**

找到現有 [pages/routines/active.vue:116](pages/routines/active.vue#L116)（`<div class="day-tabs" role="tablist">`），整個 `<div class="day-tabs">...</div>` 替換為：

```html
<!-- 星期 tab（今日高亮 + 每天打卡小點） -->
<div class="day-tabs" role="tablist">
    <button
        v-for="(label, dow) in DAY_LABELS"
        :key="dow"
        class="day-tab"
        :class="{
            'day-tab--today': dow === todayDow,
            'day-tab--selected': dow === selectedDow,
        }"
        role="tab"
        :aria-selected="dow === selectedDow"
        @click="selectedDow = dow"
    >
        <span class="day-tab-label">{{ label }}</span>
        <!-- 小點：只有今天有真實打卡資料，其他天固定灰 -->
        <span class="day-dot-row" aria-hidden="true">
            <span
                v-for="n in getTabDotCount(dow)"
                :key="n"
                class="day-dot"
                :class="{ 'day-dot--done': dow === todayDow && n <= doneToday }"
            />
        </span>
    </button>
</div>
```

- [ ] **Step 2: 在 `<script setup>` 新增 `getTabDotCount` helper**

在 `selectedDow` 宣告後插入：

```typescript
// 每個星期 tab 顯示幾個小點（代表該天步驟數，最多 3 點以免擠）
const getTabDotCount = (dow: number): number => {
	if (dow === todayDow) return Math.min(totalToday.value, 3)
	// 非今天沒有精確資料，固定顯示 2 點作為佔位
	const hasItems = (routine.value?.items ?? []).some(i => i.day_of_week === dow)
	return hasItems ? 2 : 0
}
```

- [ ] **Step 3: 將 `<style scoped>` 中現有 `.day-tab` 相關 CSS 全部替換**

找到現有 `.day-tabs { ... }` 至 `.day-tab--today.day-tab--selected { ... }` 這段，整塊替換為：

```css
/* ── 星期 tab 列 ── */
.day-tabs {
	display: flex;
	gap: var(--space-1);
	margin-bottom: var(--space-5);
	border-bottom: 1px solid var(--color-border);
	padding-bottom: var(--space-3);
	align-items: flex-end;
}

.day-tab {
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 4px;
	padding: var(--space-2) 0;
	background: transparent;
	border: 1px solid transparent;
	border-radius: var(--radius-sm);
	cursor: pointer;
	transition: background 0.18s, color 0.18s, border-color 0.18s, box-shadow 0.18s;
}

.day-tab-label {
	font-family: var(--font-body);
	font-size: 13px;
	color: var(--color-text-secondary);
	font-weight: 400;
	transition: color 0.18s, font-size 0.18s;
}

/* 今日 tab：放大高亮 */
.day-tab--today {
	background: var(--color-accent);
	border-color: var(--color-accent);
	border-radius: var(--radius-sm);
	padding: var(--space-3) 0 var(--space-2);
	box-shadow: 0 2px 8px rgba(0,0,0,0.12);
}

.day-tab--today .day-tab-label {
	color: var(--color-surface);
	font-size: 14px;
	font-weight: 700;
}

/* 被選中但非今天 */
.day-tab--selected:not(.day-tab--today) {
	background: var(--color-surface-alt);
	border-color: var(--color-border);
}

.day-tab--selected:not(.day-tab--today) .day-tab-label {
	color: var(--color-text-primary);
	font-weight: 600;
}

/* 打卡小點 */
.day-dot-row {
	display: flex;
	gap: 2px;
}

.day-dot {
	width: 5px;
	height: 5px;
	border-radius: 50%;
	background: var(--color-border);
	transition: background 0.2s;
}

.day-dot--done {
	background: var(--color-sage);
}

/* 今日 tab 未完成的點用白色半透明 */
.day-tab--today .day-dot {
	background: rgba(255,255,255,0.35);
}

.day-tab--today .day-dot.day-dot--done {
	background: rgba(255,255,255,0.95);
}
```

- [ ] **Step 4: 視覺驗證**

瀏覽 `/routines/active`，確認：
- 今日 tab 明顯比其他天大且有 accent 背景
- 今日 tab 有小點，打卡後小點變白色
- 其他天有灰色小點佔位（有步驟的天）

- [ ] **Step 5: Commit**

```bash
git add pages/routines/active.vue
git commit -m "feat(routine/active): upgrade day tabs with today highlight and dot indicators"
```

---

### Task 4：早晨/晚間改為 Timeline 樣式

**Files:**
- Modify: `pages/routines/active.vue`（`<template>` 早晨/晚間區塊 + `<style scoped>`）

- [ ] **Step 1: 找到現有 `<!-- 早晨 -->` section，整段替換**

找到 [pages/routines/active.vue:141](pages/routines/active.vue#L141)（`<section v-if="morningItems.length" class="time-section">`），整個 `<section>` 替換為：

```html
<!-- 早晨 Timeline -->
<section v-if="morningItems.length" class="tl-section">
    <div class="tl-section-header morning-header">
        <div class="tl-section-icon morning-icon" aria-hidden="true" />
        <span class="tl-section-title">早晨</span>
        <span class="tl-section-count">{{ morningDone }} / {{ morningItems.length }}</span>
    </div>
    <div class="tl-list">
        <div
            v-for="(item, idx) in morningItems"
            :key="item.id"
            class="tl-item"
            :class="{ 'tl-item--done': checkedItemIds.has(item.id) }"
            @click="handleToggleCheckin(item.id)"
        >
            <div
                class="tl-node"
                :class="{ 'tl-node--done': checkedItemIds.has(item.id) }"
                :aria-label="checkedItemIds.has(item.id) ? '取消打卡' : '打卡'"
            >
                <span v-if="!checkedItemIds.has(item.id)" class="tl-node-num">{{ idx + 1 }}</span>
            </div>
            <div class="tl-body">
                <span class="tl-name">{{ item.product_name }}</span>
            </div>
        </div>
    </div>
</section>
```

- [ ] **Step 2: 找到現有 `<!-- 晚間 -->` section，整段替換**

找到緊接在 `</section>` 後的第二個 `<section v-if="eveningItems.length">`，整段替換為：

```html
<!-- 晚間 Timeline -->
<section v-if="eveningItems.length" class="tl-section">
    <div class="tl-section-header evening-header">
        <div class="tl-section-icon evening-icon" aria-hidden="true" />
        <span class="tl-section-title">晚間</span>
        <span class="tl-section-count">{{ eveningDone }} / {{ eveningItems.length }}</span>
    </div>
    <div class="tl-list">
        <div
            v-for="(item, idx) in eveningItems"
            :key="item.id"
            class="tl-item"
            :class="{ 'tl-item--done': checkedItemIds.has(item.id) }"
            @click="handleToggleCheckin(item.id)"
        >
            <div
                class="tl-node"
                :class="{ 'tl-node--done': checkedItemIds.has(item.id) }"
                :aria-label="checkedItemIds.has(item.id) ? '取消打卡' : '打卡'"
            >
                <span v-if="!checkedItemIds.has(item.id)" class="tl-node-num">{{ idx + 1 }}</span>
            </div>
            <div class="tl-body">
                <span class="tl-name">{{ item.product_name }}</span>
            </div>
        </div>
    </div>
</section>
```

- [ ] **Step 3: 在 `<style scoped>` 末尾新增 Timeline CSS（舊 `.time-section`、`.item-row` 等可保留不刪，避免破壞其他地方）**

```css
/* ── Timeline 步驟區塊 ── */
.tl-section {
	display: flex;
	flex-direction: column;
	gap: var(--space-3);
}

.tl-section-header {
	display: flex;
	align-items: center;
	gap: var(--space-2);
	padding: var(--space-1) var(--space-3);
	border-left: 3px solid var(--color-accent);
	background: var(--color-surface-alt);
	border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
}

.morning-header { border-left-color: var(--color-amber); }
.evening-header { border-left-color: var(--color-sage); }

.tl-section-icon {
	width: 10px;
	height: 10px;
	border-radius: 50%;
	flex-shrink: 0;
}

.morning-icon { background: var(--color-amber); }
.evening-icon { background: var(--color-sage); }

.tl-section-title {
	font-family: var(--font-heading);
	font-size: 13px;
	font-weight: 600;
	color: var(--color-text-secondary);
	flex: 1;
}

.tl-section-count {
	font-family: var(--font-body);
	font-size: 11px;
	color: var(--color-text-muted);
	background: var(--color-surface);
	border-radius: var(--radius-pill);
	padding: 1px 8px;
	border: 1px solid var(--color-border);
}

/* Timeline 列表：左側連接線 */
.tl-list {
	display: flex;
	flex-direction: column;
	gap: var(--space-2);
	position: relative;
	padding-left: 4px;
}

.tl-list::before {
	content: '';
	position: absolute;
	left: 19px; /* 4px padding + 15px (half of 30px node) */
	top: 15px;
	bottom: 15px;
	width: 2px;
	background: var(--color-border);
	border-radius: 1px;
}

/* 單一 item */
.tl-item {
	display: flex;
	align-items: center;
	gap: var(--space-3);
	cursor: pointer;
	position: relative;
}

.tl-node {
	width: 30px;
	height: 30px;
	border-radius: 50%;
	border: 2px solid var(--color-border);
	background: var(--color-surface);
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	z-index: 1;
	transition: background 0.2s, border-color 0.2s, transform 0.15s;
	position: relative;
}

.tl-item:hover .tl-node {
	border-color: var(--color-accent);
	transform: scale(1.08);
}

.tl-node--done {
	background: var(--color-sage);
	border-color: var(--color-sage);
}

/* 已完成節點的白色勾勾 */
.tl-node--done::after {
	content: '';
	position: absolute;
	top: 5px;
	left: 9px;
	width: 7px;
	height: 11px;
	border: 2px solid #fff;
	border-top: none;
	border-left: none;
	transform: rotate(45deg);
}

.tl-node-num {
	font-size: 11px;
	color: var(--color-text-muted);
	font-weight: 700;
	line-height: 1;
}

.tl-body {
	flex: 1;
	background: var(--color-surface-alt);
	border: 1px solid var(--color-border);
	border-radius: var(--radius-md);
	padding: var(--space-3) var(--space-4);
	transition: background 0.2s, border-color 0.2s, opacity 0.2s;
}

.tl-item:hover .tl-body {
	border-color: var(--color-accent);
	background: var(--color-accent-light);
}

.tl-item--done .tl-body {
	background: var(--color-sage-light);
	border-color: #c3d9c6;
	opacity: 0.72;
}

.tl-name {
	font-family: var(--font-body);
	font-size: 14px;
	color: var(--color-text-primary);
	font-weight: 500;
	transition: color 0.2s;
}

.tl-item--done .tl-name {
	text-decoration: line-through;
	color: var(--color-text-muted);
}
```

- [ ] **Step 4: 視覺驗證**

瀏覽 `/routines/active` → 今天的 tab，確認：
- 早晨/晚間顯示 timeline 節點 + 連接線
- 點擊節點後 → 填滿 sage 綠 + 白勾 + 名稱刪除線
- 再點一次 → 取消打卡，恢復未完成樣式
- 進度卡數字同步更新

- [ ] **Step 5: Commit**

```bash
git add pages/routines/active.vue
git commit -m "feat(routine/active): replace item list with timeline style checkin"
```

---

### Task 5：新增完成慶祝 banner

**Files:**
- Modify: `pages/routines/active.vue`（`<template>` 的 `.content-card` 後 + `<style scoped>`）

- [ ] **Step 1: 在 `</div><!-- /content-card -->` 後插入 banner**

找到 [pages/routines/active.vue:186](pages/routines/active.vue#L186)（`</div><!-- /content-card -->`），其後插入：

```html
<!-- 今日全部完成 banner -->
<div v-if="allDoneToday" class="done-banner">
    <p class="done-banner-title">今日保養完成</p>
    <p class="done-banner-sub">保持下去，好肌膚從習慣開始</p>
</div>
```

- [ ] **Step 2: 在 `<style scoped>` 末尾新增 banner CSS**

```css
/* ── 完成慶祝 banner ── */
.done-banner {
	margin-top: var(--space-4);
	padding: var(--space-4) var(--space-5);
	background: var(--color-sage-light);
	border: 1px solid var(--color-sage);
	border-radius: var(--radius-md);
	text-align: center;
}

.done-banner-title {
	font-family: var(--font-heading);
	font-size: 15px;
	font-weight: 600;
	color: var(--color-sage);
	margin-bottom: var(--space-1);
}

.done-banner-sub {
	font-family: var(--font-body);
	font-size: 12px;
	color: var(--color-text-secondary);
}
```

- [ ] **Step 3: 視覺驗證**

將今天所有步驟全部打卡，確認 banner 在 content-card 下方出現，取消一個打卡後 banner 消失。

- [ ] **Step 4: Commit**

```bash
git add pages/routines/active.vue
git commit -m "feat(routine/active): add completion banner when all today items checked"
```

---

## Self-Review

**Spec coverage：**
- [x] 進度卡（Task 2）
- [x] 星期 tab 升級（Task 3）
- [x] Timeline 列表（Task 4）
- [x] 完成 banner（Task 5）
- [x] 進度 computed（Task 1）
- [x] 不新增 API（所有 task 均只用現有 fetch）

**Placeholder scan：** 無 TBD / TODO。

**Type consistency：**
- `doneToday`、`morningDone`、`eveningDone`、`totalToday`、`allDoneToday` 在 Task 1 定義，Task 2–5 全部引用相同名稱。
- `getTabDotCount(dow: number)` 在 Task 3 定義並使用。
- `checkedItemIds`、`morningItems`、`eveningItems`、`handleToggleCheckin` 皆為現有符號，未更名。
