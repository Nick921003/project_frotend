<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';

const props = defineProps<{ routineId: string }>();
const emit = defineEmits<{ (e: 'close'): void }>();

interface ShareRow { id: string; user_id: string; email: string; permission: 'view' | 'edit'; status: 'active' | 'paused'; }
interface SearchHit { user_id: string; email: string; }

const query = ref('');
const hits = ref<SearchHit[]>([]);
const selected = ref<SearchHit | null>(null);
const permission = ref<'view' | 'edit'>('view');
const shares = ref<ShareRow[]>([]);
const loading = ref(false);
const errorMsg = ref('');

// 處理虛擬信箱域名顯示裁切，隱藏後綴
const displayEmail = (email: string) => {
	if (!email) return '';
	if (email.endsWith('@beautyanalyzer.local')) {
		return email.split('@')[0];
	}
	return email;
};

let debounceTimer: any = null;
watch(query, (val) => {
	selected.value = null;
	clearTimeout(debounceTimer);
	const q = val.trim();
	if (q.length < 2) { hits.value = []; return; }
	debounceTimer = setTimeout(async () => {
		try {
			const res = await $fetch<any>('/api/routines/share/search-users', { query: { q } });
			hits.value = res.data || [];
		} catch (err) {
			console.error('[ShareRoutineModal] 搜尋使用者請求失敗:', err);
			hits.value = [];
		}
	}, 300);
});

const loadShares = async () => {
	try {
		const res = await $fetch<any>(`/api/routines/${props.routineId}/shares`);
		shares.value = res.data || [];
	} catch (e: any) { errorMsg.value = e?.statusMessage || '載入分享清單失敗'; }
};
onMounted(loadShares);

const pick = (h: SearchHit) => { selected.value = h; query.value = displayEmail(h.email); hits.value = []; };

const doShare = async () => {
	if (!selected.value) return;
	loading.value = true; errorMsg.value = '';
	try {
		await $fetch(`/api/routines/${props.routineId}/shares`, {
			method: 'POST',
			body: { target_user_id: selected.value.user_id, permission: permission.value }
		});
		query.value = ''; selected.value = null;
		await loadShares();
	} catch (e: any) { errorMsg.value = e?.statusMessage || '分享失敗'; }
	finally { loading.value = false; }
};

const changePermission = async (s: ShareRow, p: 'view' | 'edit') => {
	await $fetch(`/api/routines/${props.routineId}/shares/${s.id}`, { method: 'PATCH', body: { permission: p } });
	await loadShares();
};
const toggleStatus = async (s: ShareRow) => {
	const next = s.status === 'active' ? 'paused' : 'active';
	await $fetch(`/api/routines/${props.routineId}/shares/${s.id}`, { method: 'PATCH', body: { status: next } });
	await loadShares();
};
const removeShare = async (s: ShareRow) => {
	await $fetch(`/api/routines/${props.routineId}/shares/${s.id}`, { method: 'DELETE' });
	await loadShares();
};
</script>

<template>
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" @click.self="emit('close')">
		<div class="w-full max-w-md rounded-xl bg-surface p-6 shadow-xl">
			<div class="mb-4 flex items-center justify-between">
				<h2 class="font-heading text-lg text-accent">分享排程</h2>
				<button class="text-2xl leading-none text-gray-400 hover:text-gray-600" @click="emit('close')">×</button>
			</div>

			<!-- 搜尋 -->
			<label class="mb-1 block text-sm text-gray-600">以 帳號 或 Email 搜尋對象（至少 2 碼）</label>
			<input v-model="query" type="text" placeholder="輸入對方 帳號 或 Email"
				class="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none" />
			<ul v-if="hits.length" class="mt-1 max-h-40 overflow-auto rounded-lg border border-border">
				<li v-for="h in hits" :key="h.user_id"
					class="cursor-pointer px-3 py-2 text-sm hover:bg-gray-100" @click="pick(h)">{{ displayEmail(h.email) }}</li>
			</ul>

			<!-- 權限選擇 + 分享 -->
			<div v-if="selected" class="mt-3 flex items-center gap-2">
				<select v-model="permission" class="rounded-lg border border-border px-2 py-2 text-sm">
					<option value="view">檢視</option>
					<option value="edit">可編輯</option>
				</select>
				<button :disabled="loading"
					class="rounded-lg bg-accent px-4 py-2 text-sm text-white disabled:opacity-50" @click="doShare">分享</button>
			</div>

			<p v-if="errorMsg" class="mt-2 text-sm text-red-500">{{ errorMsg }}</p>

			<!-- 已分享清單 -->
			<div class="mt-5">
				<h3 class="mb-2 text-sm font-medium text-gray-700">已分享對象</h3>
				<p v-if="!shares.length" class="text-sm text-gray-400">尚未分享給任何人</p>
				<ul v-else class="space-y-2">
					<li v-for="s in shares" :key="s.id" class="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
						<div class="min-w-0">
							<div class="truncate">{{ displayEmail(s.email) }}</div>
							<div class="text-xs" :class="s.status === 'active' ? 'text-green-600' : 'text-gray-400'">
								{{ s.permission === 'edit' ? '可編輯' : '檢視' }} · {{ s.status === 'active' ? '生效中' : '已暫停' }}
							</div>
						</div>
						<div class="flex shrink-0 items-center gap-1">
							<select :value="s.permission" class="rounded border border-border px-1 py-1 text-xs"
								@change="changePermission(s, ($event.target as HTMLSelectElement).value as 'view'|'edit')">
								<option value="view">檢視</option>
								<option value="edit">可編輯</option>
							</select>
							<button class="rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100" @click="toggleStatus(s)">
								{{ s.status === 'active' ? '暫停' : '恢復' }}
							</button>
							<button class="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50" @click="removeShare(s)">移除</button>
						</div>
					</li>
				</ul>
			</div>
		</div>
	</div>
</template>
