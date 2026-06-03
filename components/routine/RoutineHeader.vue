<template>
  <div class="header">
    <!-- 排程名稱顯示：點擊展開編輯 -->
    <div v-if="routine" class="routine-title-area">
      <h1
        class="routine-title"
        :class="{ editing: showMetaEditor }"
        @click="canEdit !== false && (showMetaEditor = !showMetaEditor)"
        :title="showMetaEditor ? '收合' : '點擊編輯名稱'"
      >{{ routine.name || '未命名排程' }}</h1>
      <p v-if="routine.description && !showMetaEditor" class="routine-desc">{{ routine.description }}</p>
    </div>

    <div v-if="routine && showMetaEditor && canEdit !== false" class="routine-meta-editor">
      <input
        v-model="routineNameDraft"
        class="meta-name-input"
        type="text"
        maxlength="60"
        placeholder="請輸入排程名稱"
        autofocus
      />
      <textarea
        v-model="routineDescriptionDraft"
        class="meta-description-input"
        rows="2"
        placeholder="排程描述（可選）"
      ></textarea>
      <div class="meta-actions">
        <button @click="saveRoutineMeta" class="btn-save-meta" :disabled="savingMeta || !routineNameDraft.trim()">
          {{ savingMeta ? '保存中...' : '保存名稱' }}
        </button>
        <button @click="showMetaEditor = false; resetRoutineMetaDraft()" class="btn-reset-meta" :disabled="savingMeta">
          取消
        </button>
      </div>

      <button class="theme-merge-toggle" @click="showThemeEditor = !showThemeEditor">
        {{ showThemeEditor ? '收合主題' : '編輯主題' }}
      </button>

      <div v-if="showThemeEditor" class="themes-section inline-merged">
        <div class="themes-header">
          <h2>排程主題</h2>
          <p class="themes-subtitle">主題設定已合併到上方名稱區，保存後立即生效</p>
        </div>

        <div class="themes-grid">
          <div
            v-for="theme in AVAILABLE_ROUTINE_THEMES"
            :key="theme.id"
            class="theme-checkbox"
            :class="{ selected: isThemeSelected(theme.id) }"
            role="button"
            tabindex="0"
            :aria-pressed="isThemeSelected(theme.id)"
            @click="toggleTheme(theme.id)"
            @keydown.enter.prevent="toggleTheme(theme.id)"
            @keydown.space.prevent="toggleTheme(theme.id)"
          >
            <div class="theme-icon">{{ theme.icon }}</div>
            <div class="theme-info">
              <div class="theme-label">{{ theme.label }}</div>
              <div class="theme-desc">{{ theme.description }}</div>
            </div>
            <div v-if="isThemeSelected(theme.id)" class="checkmark">✓</div>
          </div>
        </div>

        <div class="custom-themes">
          <label>新增自定義主題</label>
          <div class="custom-input-group">
            <input
              v-model="currentCustomTheme"
              type="text"
              placeholder="例如：快速護膚、密集修護等"
              @keydown.enter="addCustomTheme"
            />
            <button @click="addCustomTheme" class="btn-add-theme">新增</button>
          </div>

          <div v-if="selectedCustomThemes.length > 0" class="custom-themes-list">
            <div
              v-for="(customTheme, idx) in selectedCustomThemes"
              :key="`custom-${idx}`"
              class="custom-theme-badge"
            >
              {{ customTheme }}
              <button @click="removeCustomTheme(idx)" class="btn-remove">✕</button>
            </div>
          </div>
        </div>

        <button @click="saveThemes" class="btn-save-themes" :disabled="savingThemes">
          {{ savingThemes ? '儲存中...' : '儲存主題設定' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { AVAILABLE_ROUTINE_THEMES } from '~/types/routine';
import type { WeeklyRoutine } from '~/types/routine';

const props = withDefaults(defineProps<{
  routine: WeeklyRoutine | null;
  routineId: string;
  canEdit?: boolean;
}>(), { canEdit: true });

const emit = defineEmits<{
  (e: 'meta-saved', name: string, description: string): void;
  (e: 'themes-saved', themes: string[], customThemes: string[]): void;
  (e: 'message', success: boolean, text: string): void;
}>();

// Meta 狀態
const showMetaEditor = ref(false);
const routineNameDraft = ref('');
const routineDescriptionDraft = ref('');
const savingMeta = ref(false);

// 主題狀態
const showThemeEditor = ref(false);
const selectedThemes = ref<string[]>([]);
const selectedCustomThemes = ref<string[]>([]);
const currentCustomTheme = ref('');
const savingThemes = ref(false);

// 同步初始值
watch(() => props.routine, (val) => {
  if (val) {
    routineNameDraft.value = val.name || '';
    routineDescriptionDraft.value = val.description || '';
    selectedThemes.value = Array.isArray(val.themes) ? [...val.themes] : [];
    selectedCustomThemes.value = Array.isArray(val.custom_themes) ? [...val.custom_themes] : [];
  }
}, { immediate: true });

const resetRoutineMetaDraft = () => {
  if (!props.routine) return;
  routineNameDraft.value = props.routine.name || '';
  routineDescriptionDraft.value = props.routine.description || '';
};

const saveRoutineMeta = async () => {
  const nextName = routineNameDraft.value.trim();
  if (!nextName) {
    emit('message', false, '❌ 排程名稱不可為空');
    return;
  }

  savingMeta.value = true;
  try {
    const response = await $fetch<{ success: boolean; data: { name: string; description: string | null } }>(
      `/api/routines/${props.routineId}/meta`,
      {
        method: 'PUT',
        body: {
          name: nextName,
          description: routineDescriptionDraft.value.trim()
        }
      }
    );

    if (response.success) {
      emit('meta-saved', response.data.name, response.data.description || '');
      emit('message', true, '排程名稱已更新');
      showMetaEditor.value = false;
    }
  } catch (err: any) {
    emit('message', false, `❌ 更新失敗: ${err.data?.message || err.message || '未知錯誤'}`);
  } finally {
    savingMeta.value = false;
  }
};

const isThemeSelected = (themeId: string) => selectedThemes.value.includes(themeId);

const toggleTheme = (themeId: string) => {
  const idx = selectedThemes.value.indexOf(themeId);
  if (idx >= 0) selectedThemes.value.splice(idx, 1);
  else selectedThemes.value.push(themeId);
};

const addCustomTheme = () => {
  const trimmed = currentCustomTheme.value.trim();
  if (trimmed && !selectedCustomThemes.value.includes(trimmed)) {
    selectedCustomThemes.value.push(trimmed);
    currentCustomTheme.value = '';
  }
};

const removeCustomTheme = (idx: number) => {
  selectedCustomThemes.value.splice(idx, 1);
};

const saveThemes = async () => {
  savingThemes.value = true;
  try {
    const response = await $fetch<any>('/api/routines/update-themes', {
      method: 'POST',
      body: {
        routine_id: props.routineId,
        themes: selectedThemes.value,
        custom_themes: selectedCustomThemes.value
      }
    });

    if (response.success) {
      emit('themes-saved', [...selectedThemes.value], [...selectedCustomThemes.value]);
      emit('message', true, '✅ 主題設定已保存');
    }
  } catch (err: any) {
    emit('message', false, `❌ 保存失敗: ${err.data?.message || err.message || '未知錯誤'}`);
  } finally {
    savingThemes.value = false;
  }
};
</script>

<style scoped>
.header {
  margin: 0 auto var(--space-6);
  text-align: center;
}

.routine-title-area {
  margin-bottom: var(--space-4);
}

.routine-title {
  font-family: var(--font-heading);
  font-size: 24px;
  color: var(--color-text-primary);
  margin: 0 0 var(--space-2);
  cursor: pointer;
  display: inline-block;
  border-bottom: 1px dashed transparent;
  transition: border-color 0.18s, color 0.18s;
}

.routine-title:hover,
.routine-title.editing {
  color: var(--color-accent);
  border-bottom-color: var(--color-accent);
}

.routine-desc {
  font-size: 14px;
  color: var(--color-text-secondary);
  margin: 0;
}

.routine-meta-editor {
  max-width: 720px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.meta-name-input,
.meta-description-input {
  width: 100%;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 0.6rem 0.75rem;
  font-size: 15px;
  font-family: var(--font-body);
  background: var(--color-surface);
  color: var(--color-text-primary);
  outline: none;
  transition: border-color 0.18s, box-shadow 0.18s;
}

.meta-name-input { font-weight: 600; font-size: 16px; }

.meta-name-input:focus,
.meta-description-input:focus {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-accent-light);
}

.meta-actions {
  display: flex;
  gap: var(--space-3);
  justify-content: center;
}

.btn-save-meta {
  padding: 6px 16px;
  background: var(--color-accent);
  color: #fff;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-family: var(--font-body);
  font-size: 13px;
  font-weight: 500;
  transition: background 0.18s;
}

.btn-save-meta:hover:not(:disabled) { background: var(--color-accent-hover); }
.btn-save-meta:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-reset-meta {
  padding: 6px 14px;
  background: var(--color-surface-alt);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-family: var(--font-body);
  font-size: 13px;
}

.theme-merge-toggle {
  border: 1px solid var(--color-sage);
  background: var(--color-sage-light);
  color: var(--color-sage);
  border-radius: var(--radius-md);
  padding: 6px 14px;
  cursor: pointer;
  font-family: var(--font-body);
  font-size: 13px;
  font-weight: 500;
  transition: background 0.15s;
}

.theme-merge-toggle:hover { background: #D8ECD8; }

.themes-section.inline-merged {
  margin-bottom: 0;
  text-align: left;
  background: var(--color-sage-light);
  border: 1px solid #C0D8C2;
  border-radius: var(--radius-lg);
  padding: var(--space-5);
}

.themes-header {
  margin-bottom: var(--space-5);
  padding-bottom: var(--space-4);
  border-bottom: 1px solid #C0D8C2;
}

.themes-header h2 { color: var(--color-sage); margin: 0 0 4px; font-size: 18px; }
.themes-subtitle { color: #5A7A60; font-size: 13px; margin: 0; }

.themes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: var(--space-3);
  margin-bottom: var(--space-5);
}

.theme-checkbox {
  background: var(--color-surface);
  border: 1px solid #C0D8C2;
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
  cursor: pointer;
  transition: border-color 0.18s, background 0.18s;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  position: relative;
}

.theme-checkbox:hover { border-color: var(--color-sage); }

.theme-checkbox.selected {
  background: #D8ECD8;
  border-color: var(--color-sage);
}

.theme-icon { font-size: 1.5rem; flex-shrink: 0; }
.theme-info { flex: 1; }
.theme-label { font-weight: 600; font-size: 13px; color: var(--color-text-primary); margin-bottom: 2px; }
.theme-desc { font-size: 12px; color: var(--color-text-secondary); line-height: 1.4; }

.checkmark {
  position: absolute;
  top: 6px; right: 6px;
  width: 20px; height: 20px;
  background: var(--color-sage);
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
}

.custom-themes {
  background: var(--color-surface);
  border: 1px solid #C0D8C2;
  border-radius: var(--radius-md);
  padding: var(--space-4);
  margin-bottom: var(--space-4);
}

.custom-themes label { display: block; font-size: 13px; font-weight: 500; color: var(--color-sage); margin-bottom: var(--space-3); }

.custom-input-group { display: flex; gap: var(--space-3); margin-bottom: var(--space-3); }

.custom-input-group input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-family: var(--font-body);
  font-size: 14px;
  outline: none;
}

.btn-add-theme {
  padding: 8px 16px;
  background: var(--color-sage);
  color: #fff;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 13px;
}

.custom-themes-list { display: flex; flex-wrap: wrap; gap: var(--space-2); }

.custom-theme-badge {
  background: var(--color-sage);
  color: #fff;
  padding: 4px 12px;
  border-radius: var(--radius-pill);
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 12px;
}

.btn-remove {
  background: rgba(255,255,255,0.3);
  color: #fff;
  border: none;
  border-radius: 50%;
  width: 18px; height: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-save-themes {
  width: 100%;
  padding: 10px 16px;
  background: var(--color-sage);
  color: #fff;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 14px;
}
</style>
