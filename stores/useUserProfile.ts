import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export type SkinType =
	| 'oily' | 'dry' | 'combination_oily' | 'combination_dry' | 'sensitive'
	| 'combination' | 'normal'; // 向後相容舊值

export const SKIN_CONCERNS_OPTIONS = [
	{ value: 'acne',     label: '痘痘粉刺' },
	{ value: 'pores',    label: '粗大毛孔' },
	{ value: 'dullness', label: '膚色暗沉/斑點' },
	{ value: 'redness',  label: '泛紅敏感' },
	{ value: 'bacne',    label: '身體痘痘' },
	{ value: 'dryness',  label: '乾燥脫皮' },
	{ value: 'aging',    label: '細紋鬆弛' },
] as const;

export const DAILY_HABITS_OPTIONS = [
	{ value: 'sunscreen_makeup',  label: '每天防曬/化妝',       desc: '影響卸妝力與清潔強度需求' },
	{ value: 'double_cleansing',  label: '有二次清潔/卸妝習慣', desc: '影響清潔成分建議' },
	{ value: 'acids_retinol',     label: '使用高濃度酸類/A醇',  desc: '影響刺激成分容忍度' },
	{ value: 'ac_room',           label: '長期待冷氣房',         desc: '影響保濕需求判斷' },
	{ value: 'commute_pollution', label: '機車通勤/易染髒污',    desc: '影響抗氧化與清潔需求' },
	{ value: 'outdoor_sun',       label: '高強度戶外曝曬',       desc: '影響防曬與抗氧化需求' },
	{ value: 'late_night',        label: '熬夜/作息不規律',      desc: '影響抗氧化與修復建議' },
	{ value: 'recent_laser',      label: '近期有醫美/雷射',      desc: '影響刺激成分風險判斷' },
] as const;

export type SkinConcern = typeof SKIN_CONCERNS_OPTIONS[number]['value'];
export type DailyHabit  = typeof DAILY_HABITS_OPTIONS[number]['value'];

export interface UserProfile {
	id: string;
	base_skin_type: string;
	age_group: string | null;
	gender: 'male' | 'female' | 'other' | null;
	birth_year: number | null;
	issues: string | null;                // JSON array：predefined skin concerns
	daily_habits: string | null;          // JSON array：predefined daily habits
	custom_skin_concerns: string | null;  // JSON array：user-typed concerns
	custom_daily_habits: string | null;   // JSON array：user-typed habits
	suppress_safety_warnings: boolean;
	created_at: string;
	updated_at: string;
}

const parseJsonArray = (raw: string | null | undefined): string[] => {
	if (!raw) return [];
	try {
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return raw.split(',').map(s => s.trim()).filter(Boolean);
	}
};

export const useUserProfile = defineStore('userProfile', () => {

	const profile     = ref<UserProfile | null>(null);
	const loading     = ref(false);
	const error       = ref<string | null>(null);
	const saveSuccess = ref(false);

	// ── Computed ──────────────────────────────────────────────

	const userAge = computed(() => {
		if (!profile.value?.birth_year) return null;
		return new Date().getFullYear() - profile.value.birth_year;
	});

	const skinConcernsArray      = computed(() => parseJsonArray(profile.value?.issues));
	const customSkinConcernsArray= computed(() => parseJsonArray(profile.value?.custom_skin_concerns));
	const dailyHabitsArray       = computed(() => parseJsonArray(profile.value?.daily_habits));
	const customDailyHabitsArray = computed(() => parseJsonArray(profile.value?.custom_daily_habits));

	/** 向後相容 */
	const issuesArray = skinConcernsArray;

	// ── Actions ───────────────────────────────────────────────

	const fetchUserProfile = async () => {
		loading.value = true;
		error.value   = null;
		try {
			const res = await $fetch<{ success: boolean; data: UserProfile | null }>('/api/profile/get');
			if (res.success) profile.value = res.data;
			else error.value = '無法取得使用者資料';
		} catch (err: any) {
			console.error('[useUserProfile] fetchUserProfile 錯誤:', err);
			error.value = err.data?.message || err.message || '取得使用者資料失敗';
		} finally {
			loading.value = false;
		}
	};

	const updateUserProfile = async (data: {
		base_skin_type?: string | null;
		skinType?: string;
		age_group?: string | null;
		ageGroup?: string | null;
		birth_year?: number | null;
		birthYear?: number | null;
		gender?: 'male' | 'female' | 'other' | null;
		issues?: string | null;
		daily_habits?: string | null;
		custom_skin_concerns?: string | null;
		custom_daily_habits?: string | null;
		suppress_safety_warnings?: boolean;
	}) => {
		const payload: Record<string, any> = {
			base_skin_type:           data.base_skin_type ?? data.skinType,
			age_group:                data.age_group ?? data.ageGroup,
			birth_year:               data.birth_year ?? data.birthYear,
			gender:                   data.gender,
			issues:                   data.issues,
			daily_habits:             data.daily_habits,
			custom_skin_concerns:     data.custom_skin_concerns,
			custom_daily_habits:      data.custom_daily_habits,
			suppress_safety_warnings: data.suppress_safety_warnings,
		};
		Object.keys(payload).forEach(k => { if (payload[k] === undefined) delete payload[k]; });

		loading.value     = true;
		error.value       = null;
		saveSuccess.value = false;

		try {
			const res = await $fetch<{ success: boolean; data: UserProfile }>('/api/profile/update', {
				method: 'POST',
				body:   payload,
			});
			if (res.success && res.data) {
				profile.value     = res.data;
				saveSuccess.value = true;
				setTimeout(() => { saveSuccess.value = false; }, 3000);
			} else {
				error.value = '無法更新使用者資料';
			}
		} catch (err: any) {
			console.error('[useUserProfile] updateUserProfile 錯誤:', err);
			error.value = err.data?.message || err.message || '更新使用者資料失敗';
		} finally {
			loading.value = false;
		}
	};

	/** 便捷方法：一次儲存膚況四個陣列 */
	const saveSkinProfile = async (
		skinType:           string,
		skinConcerns:       string[],
		customConcerns:     string[],
		dailyHabits:        string[],
		customHabits:       string[],
	) => {
		await updateUserProfile({
			base_skin_type:       skinType,
			issues:               JSON.stringify(skinConcerns),
			custom_skin_concerns: JSON.stringify(customConcerns),
			daily_habits:         JSON.stringify(dailyHabits),
			custom_daily_habits:  JSON.stringify(customHabits),
		});
	};

	/** Pure helper：切換一個 concern tag（供元件呼叫，不直接改 store） */
	const toggleConcernInArray = (arr: string[], value: string, max: number): string[] => {
		if (arr.includes(value)) return arr.filter(v => v !== value);
		if (arr.length >= max)   return arr;
		return [...arr, value];
	};

	const clearProfile = () => {
		profile.value     = null;
		loading.value     = false;
		error.value       = null;
		saveSuccess.value = false;
	};

	return {
		profile, loading, error, saveSuccess,
		userAge,
		skinConcernsArray, customSkinConcernsArray,
		dailyHabitsArray,  customDailyHabitsArray,
		issuesArray,
		fetchUserProfile, updateUserProfile, saveSkinProfile,
		toggleConcernInArray, clearProfile,
	};
});
