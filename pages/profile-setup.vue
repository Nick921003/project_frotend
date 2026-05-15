<template>
  <div class="page-container">
    <div class="setup-wrapper">

      <!-- Header -->
      <div class="text-center mb-8">
        <h1 class="page-heading">個人膚況設定</h1>
        <p class="text-text-secondary text-sm mt-1">
          設定越精準，AI 的成分分析與保養建議就越切合你的肌膚狀況
        </p>
      </div>

      <div v-if="submitError" class="status-box status-error mb-5">{{ submitError }}</div>

      <!-- ── Step 1: 基礎膚質 ───────────────────────────── -->
      <div class="card mb-4">
        <div class="step-header">
          <span class="step-badge">1</span>
          <h2 class="step-title">你的基礎膚質 <span class="required-mark">*</span></h2>
        </div>

        <div class="skin-type-grid">
          <button
            v-for="st in SKIN_TYPES"
            :key="st.value"
            type="button"
            class="skin-type-card"
            :class="{ 'skin-type-card--active': skinType === st.value }"
            @click="skinType = st.value"
          >
            <span class="skin-type-card__label">{{ st.label }}</span>
            <span class="skin-type-card__desc">{{ st.desc }}</span>
          </button>
        </div>
      </div>

      <!-- ── Step 2: 肌膚困擾 ───────────────────────────── -->
      <div class="card mb-4">
        <div class="step-header">
          <span class="step-badge">2</span>
          <h2 class="step-title">主要肌膚困擾</h2>
          <span class="count-badge" :class="{ 'count-badge--limit': totalConcerns >= MAX_CONCERNS }">
            {{ totalConcerns }}/{{ MAX_CONCERNS }}
          </span>
        </div>
        <p class="text-text-secondary text-sm mb-4">
          AI 分析時會特別注意這些面向的成分風險與功效缺口
        </p>

        <!-- 超過上限提示 -->
        <div v-if="totalConcerns >= MAX_CONCERNS" class="limit-notice mb-3">
          已達上限 {{ MAX_CONCERNS }} 項，請先取消一項再新增
        </div>

        <!-- 預設 tags -->
        <div class="flex flex-wrap gap-2 mb-3">
          <button
            v-for="opt in SKIN_CONCERNS_OPTIONS"
            :key="opt.value"
            type="button"
            class="concern-pill"
            :class="{
              'concern-pill--active':   skinConcerns.includes(opt.value),
              'concern-pill--disabled': !skinConcerns.includes(opt.value) && totalConcerns >= MAX_CONCERNS,
            }"
            :disabled="!skinConcerns.includes(opt.value) && totalConcerns >= MAX_CONCERNS"
            @click="toggleConcern(opt.value)"
          >
            {{ opt.label }}
          </button>
        </div>

        <!-- 自訂困擾 tags -->
        <div v-if="customConcerns.length > 0" class="flex flex-wrap gap-2 mb-3">
          <span
            v-for="tag in customConcerns"
            :key="tag"
            class="custom-tag"
          >
            {{ tag }}
            <button type="button" class="custom-tag__remove" @click="removeCustomConcern(tag)">×</button>
          </span>
        </div>

        <!-- 次要：自行新增入口 -->
        <div class="custom-input-area">
          <template v-if="!showConcernInput">
            <button
              type="button"
              class="add-custom-btn"
              :disabled="totalConcerns >= MAX_CONCERNS"
              @click="showConcernInput = true"
            >
              + 找不到符合的？自行新增
            </button>
          </template>
          <template v-else>
            <div class="custom-input-row">
              <input
                ref="concernInputRef"
                v-model="newConcernText"
                type="text"
                class="form-input text-sm flex-1"
                placeholder="輸入困擾（如：眼周乾紋）"
                maxlength="20"
                @keydown.enter.prevent="addCustomConcern"
                @keydown.escape="cancelConcernInput"
              />
              <button type="button" class="btn btn-sm btn-secondary" @click="addCustomConcern">新增</button>
              <button type="button" class="btn btn-sm btn-ghost" @click="cancelConcernInput">取消</button>
            </div>
            <p class="text-text-secondary text-xs mt-1.5">按 Enter 新增，Esc 取消</p>
          </template>
        </div>
      </div>

      <!-- ── Step 3: 日常習慣 ───────────────────────────── -->
      <div class="card mb-7">
        <div class="step-header">
          <span class="step-badge">3</span>
          <h2 class="step-title">日常習慣與生活環境</h2>
        </div>
        <p class="text-text-secondary text-sm mb-4">
          幫助 AI 判斷清潔強度、刺激耐受度與保濕需求
        </p>

        <!-- 預設 checkboxes -->
        <div class="habit-list mb-3">
          <label
            v-for="habit in DAILY_HABITS_OPTIONS"
            :key="habit.value"
            class="habit-row"
            :class="{ 'habit-row--active': dailyHabits.includes(habit.value) }"
          >
            <input
              v-model="dailyHabits"
              type="checkbox"
              :value="habit.value"
              class="habit-checkbox"
            />
            <div>
              <p class="habit-row__label">{{ habit.label }}</p>
              <p class="habit-row__desc">{{ habit.desc }}</p>
            </div>
          </label>
        </div>

        <!-- 自訂習慣 tags -->
        <div v-if="customHabits.length > 0" class="flex flex-wrap gap-2 mb-3">
          <span
            v-for="tag in customHabits"
            :key="tag"
            class="custom-tag"
          >
            {{ tag }}
            <button type="button" class="custom-tag__remove" @click="removeCustomHabit(tag)">×</button>
          </span>
        </div>

        <!-- 次要：自行新增入口 -->
        <div class="custom-input-area">
          <template v-if="!showHabitInput">
            <button
              type="button"
              class="add-custom-btn"
              @click="showHabitInput = true"
            >
              + 找不到符合的？自行新增
            </button>
          </template>
          <template v-else>
            <div class="custom-input-row">
              <input
                ref="habitInputRef"
                v-model="newHabitText"
                type="text"
                class="form-input text-sm flex-1"
                placeholder="輸入習慣（如：每日飲酒）"
                maxlength="20"
                @keydown.enter.prevent="addCustomHabit"
                @keydown.escape="cancelHabitInput"
              />
              <button type="button" class="btn btn-sm btn-secondary" @click="addCustomHabit">新增</button>
              <button type="button" class="btn btn-sm btn-ghost" @click="cancelHabitInput">取消</button>
            </div>
            <p class="text-text-secondary text-xs mt-1.5">按 Enter 新增，Esc 取消</p>
          </template>
        </div>
      </div>

      <!-- Submit -->
      <button
        class="btn btn-primary btn-lg w-full"
        :disabled="!skinType || loading"
        @click="handleSubmit"
      >
        {{ loading ? '儲存中...' : '儲存並開始分析' }}
      </button>

      <div v-if="saveSuccess" class="status-box status-success mt-4">
        ✅ 個人資料已儲存，正在跳轉...
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, watch } from 'vue'
import { useUserProfile, SKIN_CONCERNS_OPTIONS, DAILY_HABITS_OPTIONS } from '~/stores/useUserProfile'

const store = useUserProfile()
const { profile, loading, saveSuccess } = store
const storeError = computed(() => store.error)

const MAX_CONCERNS = 4

const SKIN_TYPES = [
  { value: 'oily',             label: '油性肌',  desc: '容易出油、毛孔粗大' },
  { value: 'dry',              label: '乾性肌',  desc: '緊繃、脫屑、乾紋多' },
  { value: 'combination_oily', label: '混合偏油', desc: 'T字出油、兩頰中性' },
  { value: 'combination_dry',  label: '混合偏乾', desc: 'T字中性、兩頰偏乾' },
  { value: 'sensitive',        label: '敏感肌',  desc: '易泛紅、刺痛、過敏' },
] as const

// ── Local state ─────────────────────────────────────────────────

const skinType      = ref('')
const skinConcerns  = ref<string[]>([])
const customConcerns= ref<string[]>([])
const dailyHabits   = ref<string[]>([])
const customHabits  = ref<string[]>([])

const showConcernInput = ref(false)
const showHabitInput   = ref(false)
const newConcernText   = ref('')
const newHabitText     = ref('')
const submitError      = ref('')

const concernInputRef = ref<HTMLInputElement | null>(null)
const habitInputRef   = ref<HTMLInputElement | null>(null)

const totalConcerns = computed(() => skinConcerns.value.length + customConcerns.value.length)

// ── Concern helpers ───────────────────────────────────────────

const toggleConcern = (value: string) => {
  const idx = skinConcerns.value.indexOf(value)
  if (idx !== -1) {
    skinConcerns.value.splice(idx, 1)
  } else if (totalConcerns.value < MAX_CONCERNS) {
    skinConcerns.value.push(value)
  }
}

const addCustomConcern = () => {
  const tag = newConcernText.value.trim()
  if (!tag) return
  if (totalConcerns.value >= MAX_CONCERNS) return
  if (customConcerns.value.includes(tag)) return
  customConcerns.value.push(tag)
  newConcernText.value = ''
  showConcernInput.value = false
}

const removeCustomConcern = (tag: string) => {
  customConcerns.value = customConcerns.value.filter(t => t !== tag)
}

const cancelConcernInput = () => {
  newConcernText.value   = ''
  showConcernInput.value = false
}

// ── Habit helpers ─────────────────────────────────────────────

const addCustomHabit = () => {
  const tag = newHabitText.value.trim()
  if (!tag) return
  if (customHabits.value.includes(tag)) return
  customHabits.value.push(tag)
  newHabitText.value   = ''
  showHabitInput.value = false
}

const removeCustomHabit = (tag: string) => {
  customHabits.value = customHabits.value.filter(t => t !== tag)
}

const cancelHabitInput = () => {
  newHabitText.value   = ''
  showHabitInput.value = false
}

// ── Auto-focus when input opens ───────────────────────────────

watch(showConcernInput, async (v) => {
  if (v) { await nextTick(); concernInputRef.value?.focus() }
})
watch(showHabitInput, async (v) => {
  if (v) { await nextTick(); habitInputRef.value?.focus() }
})

// ── Load from store ───────────────────────────────────────────

const loadFromProfile = () => {
  if (!profile.value) return
  const p = profile.value
  skinType.value      = p.base_skin_type || ''

  const parse = (raw: string | null) => {
    if (!raw) return []
    try { return JSON.parse(raw) } catch { return [] }
  }

  skinConcerns.value   = parse(p.issues)
  customConcerns.value = parse(p.custom_skin_concerns)
  dailyHabits.value    = parse(p.daily_habits)
  customHabits.value   = parse(p.custom_daily_habits)
}

// ── Submit ────────────────────────────────────────────────────

const route = useRoute()

const handleSubmit = async () => {
  submitError.value = ''
  if (!skinType.value) {
    submitError.value = '請先選擇你的基礎膚質'
    return
  }

  await store.saveSkinProfile(
    skinType.value,
    skinConcerns.value,
    customConcerns.value,
    dailyHabits.value,
    customHabits.value,
  )

  if (storeError.value) {
    submitError.value = storeError.value || '儲存失敗，請重試'
    return
  }

  // from=profile 時回個人資料頁，其餘回首頁
  const redirect = route.query.from === 'profile' ? '/profile' : '/'
  setTimeout(() => navigateTo(redirect), 1200)
}

onMounted(async () => {
  if (!profile.value) await store.fetchUserProfile()
  loadFromProfile()
})
</script>

<style scoped>
.setup-wrapper {
  max-width: 640px;
  margin: 0 auto;
}

.page-heading {
  font-size: 24px;
  margin-bottom: 0;
}

/* ── Step header ── */
.step-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
}

.step-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--color-accent);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}

.step-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
}

.required-mark {
  color: #f87171;
  font-size: 14px;
}

.count-badge {
  margin-left: auto;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-muted);
  background: var(--color-surface-alt);
  border: 1px solid var(--color-border-light);
  border-radius: 9999px;
  padding: 2px 10px;
}

.count-badge--limit {
  color: #92400e;
  background: #fef3c7;
  border-color: #fde68a;
}

/* ── Skin type cards ── */
.skin-type-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: var(--space-2);
}

@media (max-width: 600px) {
  .skin-type-grid { grid-template-columns: repeat(2, 1fr); }
}

.skin-type-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: var(--space-3) var(--space-2);
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  text-align: center;
}

.skin-type-card:hover { border-color: var(--color-sage); }
.skin-type-card--active {
  border-color: var(--color-accent);
  background: var(--color-surface-alt);
}

.skin-type-card__label {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}
.skin-type-card--active .skin-type-card__label { color: var(--color-accent); }

.skin-type-card__desc {
  font-size: 11px;
  color: var(--color-text-muted);
  line-height: 1.4;
}

/* ── Concern pills ── */
.concern-pill {
  padding: 6px 16px;
  border-radius: 9999px;
  border: 1.5px solid var(--color-border);
  background: var(--color-surface);
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s, color 0.15s;
}

.concern-pill:hover:not(:disabled) { border-color: var(--color-sage); }

.concern-pill--active {
  border-color: var(--color-accent);
  background: var(--color-accent);
  color: #fff;
}

.concern-pill--disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

/* ── Custom tags ── */
.custom-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 12px;
  border-radius: 9999px;
  border: 1.5px dashed var(--color-accent);
  background: var(--color-surface-alt);
  font-size: 13px;
  font-weight: 500;
  color: var(--color-accent);
}

.custom-tag__remove {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  color: var(--color-accent);
  opacity: 0.6;
  transition: opacity 0.1s;
}
.custom-tag__remove:hover { opacity: 1; }

/* ── Custom input area ── */
.custom-input-area {
  padding-top: var(--space-2);
  border-top: 1px dashed var(--color-border-light);
}

.add-custom-btn {
  font-size: 13px;
  color: var(--color-text-muted);
  background: none;
  border: none;
  cursor: pointer;
  padding: var(--space-1) 0;
  transition: color 0.15s;
}
.add-custom-btn:hover:not(:disabled) { color: var(--color-accent); }
.add-custom-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.custom-input-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

/* ── Limit notice ── */
.limit-notice {
  font-size: 13px;
  color: #92400e;
  background: #fef3c7;
  border: 1px solid #fde68a;
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
}

/* ── Habit rows ── */
.habit-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.habit-row {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.habit-row:hover         { border-color: var(--color-sage); }
.habit-row--active       { border-color: var(--color-accent); background: var(--color-surface-alt); }

.habit-checkbox {
  margin-top: 2px;
  accent-color: var(--color-accent);
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  cursor: pointer;
}

.habit-row__label {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary);
  margin: 0 0 2px;
}

.habit-row__desc {
  font-size: 12px;
  color: var(--color-text-muted);
  margin: 0;
}
</style>
