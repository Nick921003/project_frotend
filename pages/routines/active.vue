<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

// ──────────────────────────────────────────────
// 型別
// ──────────────────────────────────────────────
interface RoutineItem {
	id: string
	day_of_week: number
	time_of_day: 'morning' | 'evening'
	sequence_order: number
	product_name: string
}

interface ActiveRoutine {
	id: string
	name: string
	items: RoutineItem[]
}

// ──────────────────────────────────────────────
// 取得活躍排程（伺服器端 SSR）
// ──────────────────────────────────────────────
const { data: fetchData, error } = await useFetch<{ success: boolean; data: ActiveRoutine | null }>(
	'/api/routines/active'
)

if (error.value?.statusCode === 401) {
	await navigateTo('/', { replace: true })
}

const routine = computed(() => fetchData.value?.data ?? null)
const routineId = computed(() => routine.value?.id ?? null)

// ──────────────────────────────────────────────
// 星期 tab
// ──────────────────────────────────────────────
const DAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']
const todayDow = new Date().getDay() // 0=Sun … 6=Sat
const selectedDow = ref(todayDow)

// 每個星期 tab 顯示幾個小點（最多 3 點）
const getTabDotCount = (dow: number): number => {
	if (dow === todayDow) return Math.min(totalToday.value, 3)
	const hasItems = (routine.value?.items ?? []).some(i => i.day_of_week === dow)
	return hasItems ? 2 : 0
}

// ──────────────────────────────────────────────
// 當天篩選項目
// ──────────────────────────────────────────────
const dayItems = computed(() =>
	(routine.value?.items ?? []).filter((i) => i.day_of_week === selectedDow.value)
)

const morningItems = computed(() =>
	dayItems.value
		.filter((i) => i.time_of_day === 'morning')
		.sort((a, b) => a.sequence_order - b.sequence_order)
)

const eveningItems = computed(() =>
	dayItems.value
		.filter((i) => i.time_of_day === 'evening')
		.sort((a, b) => a.sequence_order - b.sequence_order)
)

// ──────────────────────────────────────────────
// 今日進度計算
// ──────────────────────────────────────────────
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

// ──────────────────────────────────────────────
// 打卡狀態
// ──────────────────────────────────────────────
const todayStr = new Date().toISOString().slice(0, 10)
const checkedItemIds = ref(new Set<string>())

const loadCheckins = async () => {
	if (!routineId.value) return
	try {
		const res = await $fetch<{ success: boolean; data: { checked_ids: string[] } }>(
			`/api/routines/${routineId.value}/checkins`,
			{ query: { date: todayStr } }
		)
		checkedItemIds.value = new Set(res.data?.checked_ids ?? [])
	} catch {}
}

const handleToggleCheckin = async (itemId: string) => {
	try {
		const res = await $fetch<{ success: boolean; checked: boolean }>(
			'/api/routines/checkins/toggle',
			{ method: 'POST', body: { routine_item_id: itemId, checked_date: todayStr } }
		)
		if (res.checked) {
			checkedItemIds.value.add(itemId)
		} else {
			checkedItemIds.value.delete(itemId)
		}
		// 觸發響應性更新
		checkedItemIds.value = new Set(checkedItemIds.value)
	} catch {}
}

onMounted(loadCheckins)
</script>

<template>
	<div class="page-wrap">
		<!-- 無排程空狀態 -->
		<div v-if="!routine" class="empty-state">
			<p class="empty-text">目前沒有進行中的排程</p>
			<NuxtLink to="/beauty-plan" class="empty-link">前往保養規劃</NuxtLink>
		</div>

		<!-- 有排程主體 -->
		<template v-else>
			<!-- 標題列 -->
			<div class="header-row">
				<h1 class="routine-name">{{ routine.name }}</h1>
				<NuxtLink :to="`/routines/${routineId}`" class="edit-btn">編輯</NuxtLink>
			</div>

			<!-- 內容卡片 -->
			<div class="content-card">
			<!-- 星期 tab -->
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
					{{ label }}
				</button>
			</div>

			<!-- 當天內容 -->
			<div class="day-content">
				<!-- 空天訊息 -->
				<p v-if="!morningItems.length && !eveningItems.length" class="no-items-msg">
					這天沒有安排保養步驟
				</p>

				<!-- 早晨 -->
				<section v-if="morningItems.length" class="time-section">
					<div class="time-label">早晨</div>
					<div class="item-list">
						<div
							v-for="(item, idx) in morningItems"
							:key="item.id"
							class="item-row"
						>
							<span class="item-num">{{ idx + 1 }}</span>
							<span class="item-name">{{ item.product_name }}</span>
							<button
								class="checkin-btn"
								:class="{ 'checkin-btn--done': checkedItemIds.has(item.id) }"
								:aria-label="checkedItemIds.has(item.id) ? '取消打卡' : '打卡'"
								@click="handleToggleCheckin(item.id)"
							>
								<span class="checkin-icon" />
							</button>
						</div>
					</div>
				</section>

				<!-- 晚間 -->
				<section v-if="eveningItems.length" class="time-section">
					<div class="time-label">晚間</div>
					<div class="item-list">
						<div
							v-for="(item, idx) in eveningItems"
							:key="item.id"
							class="item-row"
						>
							<span class="item-num">{{ idx + 1 }}</span>
							<span class="item-name">{{ item.product_name }}</span>
							<button
								class="checkin-btn"
								:class="{ 'checkin-btn--done': checkedItemIds.has(item.id) }"
								:aria-label="checkedItemIds.has(item.id) ? '取消打卡' : '打卡'"
								@click="handleToggleCheckin(item.id)"
							>
								<span class="checkin-icon" />
							</button>
						</div>
					</div>
				</section>
			</div>
			</div><!-- /content-card -->
		</template>
	</div>
</template>

<style scoped>
/* ── 頁面容器 ── */
.page-wrap {
	max-width: 720px;
	margin: 0 auto;
	padding: var(--space-6) var(--space-5);
	background: var(--color-bg);
	min-height: 60vh;
}

/* ── 空狀態 ── */
.empty-state {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: var(--space-4);
	padding: var(--space-12) 0;
}

.empty-text {
	font-family: var(--font-body);
	font-size: 15px;
	color: var(--color-text-secondary);
}

.empty-link {
	font-family: var(--font-body);
	font-size: 14px;
	color: var(--color-accent);
	text-decoration: none;
	padding: var(--space-2) var(--space-4);
	border: 1px solid var(--color-accent);
	border-radius: var(--radius-md);
	transition: background 0.18s, color 0.18s;
}

.empty-link:hover {
	background: var(--color-accent);
	color: var(--color-surface);
}

/* ── 標題列 ── */
.header-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: var(--space-5);
}

.routine-name {
	font-family: var(--font-heading);
	font-size: 20px;
	font-weight: 600;
	color: var(--color-text-primary);
	margin: 0;
}

/* 與 app.vue nav-routine-btn 相同風格 */
.edit-btn {
	font-family: var(--font-body);
	font-size: 14px;
	color: var(--color-text-secondary);
	text-decoration: none;
	padding: var(--space-2) var(--space-3);
	border: 1px solid var(--color-border);
	border-radius: var(--radius-md);
	transition: border-color 0.18s, color 0.18s;
}

.edit-btn:hover {
	border-color: var(--color-accent);
	color: var(--color-accent);
}

/* ── 內容卡片 ── */
.content-card {
	background: var(--color-surface);
	border: 1px solid var(--color-border);
	border-radius: var(--radius-md);
	padding: var(--space-5);
}

/* ── 星期 tab 列 ── */
.day-tabs {
	display: flex;
	gap: var(--space-2);
	margin-bottom: var(--space-5);
	border-bottom: 1px solid var(--color-border);
	padding-bottom: var(--space-3);
}

.day-tab {
	flex: 1;
	padding: var(--space-2) 0;
	background: transparent;
	border: 1px solid transparent;
	border-radius: var(--radius-sm);
	font-family: var(--font-body);
	font-size: 14px;
	color: var(--color-text-secondary);
	cursor: pointer;
	transition: background 0.18s, color 0.18s, border-color 0.18s;
}

/* 今天標記（未被選中時加底線提示） */
.day-tab--today:not(.day-tab--selected) {
	color: var(--color-accent);
	border-color: var(--color-accent);
}

/* 被選中的 tab */
.day-tab--selected {
	background: var(--color-surface-alt);
	color: var(--color-text-primary);
	border-color: var(--color-border);
	font-weight: 600;
}

/* 今天且被選中 */
.day-tab--today.day-tab--selected {
	background: var(--color-accent);
	color: var(--color-surface);
	border-color: var(--color-accent);
}

/* ── 當天內容 ── */
.day-content {
	display: flex;
	flex-direction: column;
	gap: var(--space-6);
}

.no-items-msg {
	font-family: var(--font-body);
	font-size: 14px;
	color: var(--color-text-secondary);
	text-align: center;
	padding: var(--space-8) 0;
}

/* ── 早晨 / 晚間區塊 ── */
.time-section {
	display: flex;
	flex-direction: column;
	gap: var(--space-3);
}

.time-label {
	font-family: var(--font-heading);
	font-size: 13px;
	font-weight: 600;
	color: var(--color-text-secondary);
	padding: var(--space-1) var(--space-3);
	border-left: 3px solid var(--color-accent);
	background: var(--color-surface-alt);
	border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
}

/* ── 項目列 ── */
.item-list {
	display: flex;
	flex-direction: column;
	gap: var(--space-2);
}

.item-row {
	display: flex;
	align-items: center;
	gap: var(--space-3);
	padding: var(--space-3) var(--space-4);
	background: var(--color-surface);
	border: 1px solid var(--color-border);
	border-radius: var(--radius-md);
	transition: box-shadow 0.18s;
}

.item-row:hover {
	box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}

.item-num {
	font-family: var(--font-body);
	font-size: 12px;
	color: var(--color-text-secondary);
	min-width: 18px;
	text-align: center;
}

.item-name {
	font-family: var(--font-body);
	font-size: 15px;
	color: var(--color-text-primary);
	flex: 1;
}

/* ── 打卡按鈕（CSS 圓形，避免 emoji 跨平台渲染差異）── */
.checkin-btn {
	background: transparent;
	border: none;
	cursor: pointer;
	padding: 2px;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	transition: transform 0.15s;
}

.checkin-btn:hover {
	transform: scale(1.1);
}

.checkin-icon {
	display: block;
	width: 22px;
	height: 22px;
	border-radius: 50%;
	border: 2px solid var(--color-border);
	background: transparent;
	transition: background 0.18s, border-color 0.18s;
	position: relative;
}

/* 打卡完成：填滿 sage 綠 + 白色勾 */
.checkin-btn--done .checkin-icon {
	background: var(--color-sage);
	border-color: var(--color-sage);
}

.checkin-btn--done .checkin-icon::after {
	content: '';
	position: absolute;
	top: 4px;
	left: 6px;
	width: 6px;
	height: 10px;
	border: 2px solid #fff;
	border-top: none;
	border-left: none;
	transform: rotate(45deg);
}
</style>
