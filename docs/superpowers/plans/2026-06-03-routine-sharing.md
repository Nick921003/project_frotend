# 排程分享（即時協作）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓使用者以 email 邀請他人協作同一份保養排程，分「檢視 / 編輯」權限，可暫停/恢復；接收方在自己列表看到共享排程並能設為每日視圖。

**Architecture:** 因現有 RLS 全為 `auth.uid()=user_id`（僅擁有者），協作者的 routine/routine_items 讀寫一律改走 **service-key client**，以新 util `assertRoutineAccess()` 做 app 層授權（owner / 共享 ACL）。per-user「啟動」狀態移到獨立表 `user_active_routine`。email 經兩支 `SECURITY DEFINER` RPC（收回 public execute）查詢。

**Tech Stack:** Nuxt 4 / Nitro server routes、Supabase（Postgres + RLS + RPC）、`@supabase/supabase-js`(service key)、Vue 3 Composition API、Tailwind。

**設計來源：** `docs/superpowers/specs/2026-06-03-routine-sharing-design.md`

---

## 驗證方式說明（本專案無測試框架）

CLAUDE.md 明載「No test suite or linter configured」。故本計畫不寫 unit test，改用三種驗證：

1. **型別/建置**：`npm run build`（Vercel 等級嚴格；`<script setup>` 需 `lang="ts"`）。每個 Phase 結尾跑一次。
2. **DB 斷言**：Supabase MCP `execute_sql` 查表/policy/grant。
3. **手動 API 驗證**：登入後於瀏覽器或 `$fetch` 觸發，檢查 status 與回傳。每支新/改 endpoint 附具體驗證指令。

> Commit 規則：每個 Task 結尾 commit。依使用者規則，**commit 前先跑 `sync-docs` skill 並向使用者確認 commit message，不自行 push / merge**。本計畫的 commit 步驟以「準備 commit」呈現。

---

## File Structure

**新增：**
- `server/utils/routineAccess.ts` — `getServiceClient(event)` + `assertRoutineAccess(event, routineId, level)`
- `server/utils/userEmails.ts` — `searchUserEmails()` / `getUserEmails()`（service-key RPC 封裝）
- `server/api/routines/share/search-users.get.ts` — email 前綴搜尋
- `server/api/routines/[id]/shares/index.get.ts` — owner 列出分享
- `server/api/routines/[id]/shares/index.post.ts` — owner 新增分享
- `server/api/routines/[id]/shares/[shareId].patch.ts` — owner 改權限/暫停恢復
- `server/api/routines/[id]/shares/[shareId].delete.ts` — owner 移除分享
- `components/routine/ShareRoutineModal.vue` — 分享 UI

**修改：**
- `server/api/routines/[id]/toggle-active.put.ts`、`server/api/routines/active.get.ts`、`server/api/routines/list.get.ts`
- `server/api/routines/[id].get.ts`、`server/api/routines/update-order.post.ts`、`server/api/routines/[id]/meta.put.ts`、`server/api/routines/update-themes.post.ts`、`server/api/routines/[id]/efficacy-recs.post.ts`、`server/api/routines/items/[id]/lock.patch.ts`、`server/api/routines/[id].delete.ts`、`server/api/routines/[id]/checkins.get.ts`、`server/api/routines/checkins/toggle.post.ts`
- `pages/routines/[id].vue`、`pages/routines/active.vue`、`components/routine/RoutineHeader.vue`

---

# Phase 0 — DB 基礎

### Task 0.1：套用 migration

**Files:** 無檔案（經 Supabase MCP `apply_migration`，name：`routine_sharing_foundation`）

- [ ] **Step 1：先查出舊 is_active partial unique index 名稱**

用 MCP `execute_sql`（project_id `zbyqfbawjfglmuwsnuae`）：

```sql
select indexname, indexdef from pg_indexes
where schemaname='public' and tablename='routines' and indexdef ilike '%is_active%';
```

記下 indexname（下一步 drop 用）。若查無，Step 2 的 drop 行可省略。

- [ ] **Step 2：apply_migration**

以 MCP `apply_migration`，name=`routine_sharing_foundation`，query 如下（把 `<IDX>` 換成上一步的 indexname；查無則刪該行）：

```sql
-- 1. routine_shares（協作 ACL）
create table public.routine_shares (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references public.routines(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  shared_by uuid not null references auth.users(id),
  permission text not null default 'view' check (permission in ('view','edit')),
  status text not null default 'active' check (status in ('active','paused')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (routine_id, user_id)
);
create index idx_routine_shares_user on public.routine_shares(user_id) where status = 'active';
create index idx_routine_shares_routine on public.routine_shares(routine_id);
alter table public.routine_shares enable row level security;
create policy "member reads own shares" on public.routine_shares
  for select using (auth.uid() = user_id or auth.uid() = shared_by);
create policy "owner inserts shares" on public.routine_shares
  for insert with check (auth.uid() = shared_by);
create policy "owner updates shares" on public.routine_shares
  for update using (auth.uid() = shared_by) with check (auth.uid() = shared_by);
create policy "owner deletes shares" on public.routine_shares
  for delete using (auth.uid() = shared_by);

-- 2. user_active_routine（per-user 啟動指標）
create table public.user_active_routine (
  user_id uuid primary key references auth.users(id) on delete cascade,
  routine_id uuid references public.routines(id) on delete set null,
  updated_at timestamptz default now()
);
alter table public.user_active_routine enable row level security;
create policy "own active routine" on public.user_active_routine
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 3. backfill：舊 is_active → user_active_routine
insert into public.user_active_routine (user_id, routine_id)
select r.user_id, r.id from public.routines r where r.is_active = true
on conflict (user_id) do update set routine_id = excluded.routine_id;

-- 4. 移除舊 is_active partial unique index（查無則刪此行）
drop index if exists public.<IDX>;

-- 5. Email 查詢 RPC（SECURITY DEFINER）
create or replace function public.search_user_emails(prefix text)
returns table(user_id uuid, email text)
language sql security definer set search_path = public, auth as $$
  select u.id, u.email::text from auth.users u
  where u.email ilike prefix || '%' limit 20
$$;
create or replace function public.get_user_emails(ids uuid[])
returns table(user_id uuid, email text)
language sql security definer set search_path = public, auth as $$
  select u.id, u.email::text from auth.users u where u.id = any(ids)
$$;

-- 6. 【資安必做】收回 public execute，只留 service_role
revoke execute on function public.search_user_emails(text) from public, anon, authenticated;
revoke execute on function public.get_user_emails(uuid[]) from public, anon, authenticated;
grant execute on function public.search_user_emails(text) to service_role;
grant execute on function public.get_user_emails(uuid[]) to service_role;
```

- [ ] **Step 3：驗證 schema 與權限**

```sql
-- 表存在
select table_name from information_schema.tables
where table_schema='public' and table_name in ('routine_shares','user_active_routine');
-- backfill 有資料（原本 2 筆 routines、應有對應 active）
select * from public.user_active_routine;
-- RPC 權限：authenticated 不該有 execute
select p.proname, has_function_privilege('authenticated', p.oid, 'execute') as authed_can_exec
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('search_user_emails','get_user_emails');
```

Expected：兩表都在；`user_active_routine` 有 backfill 列；`authed_can_exec` 皆為 `false`。

- [ ] **Step 4：更新 TS 型別（可選但建議）**

MCP `generate_typescript_types`（project_id 同上），把輸出覆寫 `types/database.types.ts`。若耗時可略，本計畫程式碼皆以 `(supabase as any)` 規避型別（沿用專案既有風格）。

- [ ] **Step 5：準備 commit**

```bash
git add types/database.types.ts docs/superpowers/
# message 經使用者確認後再 commit，例：
# chore(db): 新增 routine_shares / user_active_routine 與 email RPC（排程分享基礎）
```

---

# Phase 1 — Server utils

### Task 1.1：`server/utils/routineAccess.ts`

**Files:** Create `server/utils/routineAccess.ts`

- [ ] **Step 1：建立檔案**

```typescript
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { serverSupabaseUser } from '#supabase/server';
import type { H3Event } from 'h3';

/**
 * 取得 service-key client（繞過 RLS）。
 * 僅可在 endpoint 內、完成 assertRoutineAccess 授權後使用。
 */
export function getServiceClient(event: H3Event): SupabaseClient {
	const config = useRuntimeConfig(event);
	return createClient(config.public.supabaseUrl, config.supabaseSecretKey);
}

export interface RoutineAccess {
	userId: string;   // 當前登入者
	ownerId: string;  // 排程擁有者（寫入 routine_items 時 user_id 一律帶這個）
	role: 'owner' | 'member';
	permission: 'edit' | 'view'; // owner 恆 edit
}

/**
 * 授權守衛：判定當前使用者對 routineId 的存取權。
 * 內部用 service key 讀取（因 user client 受 RLS 限、讀不到他人排程）。
 * 失敗即 throw：401 未登入 / 404 排程不存在 / 403 無權限。
 */
export async function assertRoutineAccess(
	event: H3Event,
	routineId: string | undefined,
	required: 'view' | 'edit' | 'owner'
): Promise<RoutineAccess> {
	const user = await serverSupabaseUser(event);
	if (!user) throw createError({ statusCode: 401, statusMessage: '請先登入' });
	const userId = (user as any).id || (user as any).sub;
	if (!userId) throw createError({ statusCode: 401, statusMessage: '無法識別用戶身份' });
	if (!routineId) throw createError({ statusCode: 400, statusMessage: '缺少 routine ID' });

	const admin = getServiceClient(event);

	// 取得擁有者
	const { data: routine, error } = await (admin as any)
		.from('routines')
		.select('user_id')
		.eq('id', routineId)
		.single();
	if (error || !routine) throw createError({ statusCode: 404, statusMessage: '排程不存在' });
	const ownerId = routine.user_id as string;

	// 擁有者：通過任何層級
	if (userId === ownerId) {
		return { userId, ownerId, role: 'owner', permission: 'edit' };
	}
	// 僅擁有者可執行（刪除、分享管理）
	if (required === 'owner') {
		throw createError({ statusCode: 403, statusMessage: '僅排程擁有者可執行此操作' });
	}
	// 協作者：查 active 分享列
	const { data: share } = await (admin as any)
		.from('routine_shares')
		.select('permission')
		.eq('routine_id', routineId)
		.eq('user_id', userId)
		.eq('status', 'active')
		.maybeSingle();
	if (!share) throw createError({ statusCode: 403, statusMessage: '無權限存取此排程' });

	const permission = share.permission as 'edit' | 'view';
	if (required === 'edit' && permission !== 'edit') {
		throw createError({ statusCode: 403, statusMessage: '僅可檢視，無編輯權限' });
	}
	return { userId, ownerId, role: 'member', permission };
}
```

- [ ] **Step 2：commit 準備**（與 Task 1.2 一起 commit）

### Task 1.2：`server/utils/userEmails.ts`

**Files:** Create `server/utils/userEmails.ts`

- [ ] **Step 1：建立檔案**

```typescript
import type { H3Event } from 'h3';
import { getServiceClient } from './routineAccess';

/**
 * Email 前綴搜尋（service-key 呼叫 SECURITY DEFINER RPC）。
 * 護欄：呼叫端需保證 prefix ≥ 2 碼；此處再排除自己、上限 8。
 */
export async function searchUserEmails(
	event: H3Event,
	prefix: string,
	excludeUserId: string
): Promise<{ user_id: string; email: string }[]> {
	const admin = getServiceClient(event);
	const { data, error } = await (admin as any).rpc('search_user_emails', { prefix });
	if (error) throw createError({ statusCode: 500, statusMessage: 'Email 搜尋失敗: ' + error.message });
	return (data || [])
		.filter((r: any) => r.user_id !== excludeUserId)
		.slice(0, 8)
		.map((r: any) => ({ user_id: r.user_id, email: r.email }));
}

/**
 * 批次把 user_id → email（給分享列表 / 「誰分享的」用）。
 */
export async function getUserEmails(
	event: H3Event,
	ids: string[]
): Promise<Record<string, string>> {
	const unique = Array.from(new Set(ids)).filter(Boolean);
	if (unique.length === 0) return {};
	const admin = getServiceClient(event);
	const { data, error } = await (admin as any).rpc('get_user_emails', { ids: unique });
	if (error) throw createError({ statusCode: 500, statusMessage: 'Email 反解失敗: ' + error.message });
	const map: Record<string, string> = {};
	for (const r of (data || [])) map[r.user_id] = r.email;
	return map;
}
```

- [ ] **Step 2：build 驗證**

Run: `npm run build`
Expected：成功（無型別錯誤）。

- [ ] **Step 3：commit 準備**

```bash
git add server/utils/routineAccess.ts server/utils/userEmails.ts
# 例：feat(routine-share): 新增 assertRoutineAccess 與 email 查詢 util
```

---

# Phase 2 — per-user 啟動狀態

### Task 2.1：改寫 `toggle-active.put.ts`（啟動寫入 user_active_routine）

**Files:** Modify `server/api/routines/[id]/toggle-active.put.ts`（全檔取代）

- [ ] **Step 1：全檔取代為**

```typescript
import { serverSupabaseClient } from '#supabase/server';
import { assertRoutineAccess } from '~/server/utils/routineAccess';

/**
 * PUT /api/routines/[id]/toggle-active
 * 設定/取消「當前登入者」的每日視圖啟動排程（per-user）。
 */
export default defineEventHandler(async (event) => {
	const routineId = getRouterParam(event, 'id');
	const body = await readBody(event);
	const { is_active } = body || {};

	if (typeof is_active !== 'boolean') {
		throw createError({ statusCode: 400, statusMessage: '無效的參數：is_active 必須是布林值' });
	}

	// 需至少 view 權限才能把它設為自己的啟動排程
	const { userId } = await assertRoutineAccess(event, routineId, 'view');

	// user_active_routine 是自己那列，RLS auth.uid()=user_id，續用 user client
	const supabase = await serverSupabaseClient(event);

	if (is_active) {
		const { error } = await (supabase as any)
			.from('user_active_routine')
			.upsert(
				{ user_id: userId, routine_id: routineId, updated_at: new Date().toISOString() },
				{ onConflict: 'user_id' }
			);
		if (error) throw createError({ statusCode: 500, statusMessage: '更新啟動狀態失敗: ' + error.message });
	} else {
		// 只在當前啟動的就是這份時才清掉
		const { error } = await (supabase as any)
			.from('user_active_routine')
			.update({ routine_id: null, updated_at: new Date().toISOString() })
			.eq('user_id', userId)
			.eq('routine_id', routineId);
		if (error) throw createError({ statusCode: 500, statusMessage: '更新啟動狀態失敗: ' + error.message });
	}

	return { success: true, message: `排程已${is_active ? '啟用' : '停用'}` };
});
```

- [ ] **Step 2：commit 準備**（與 2.2 一起）

### Task 2.2：改寫 `active.get.ts`（讀 user_active_routine + service-key 載入 + dangling 清理）

**Files:** Modify `server/api/routines/active.get.ts`（全檔取代）

- [ ] **Step 1：全檔取代為**

```typescript
import { serverSupabaseUser, serverSupabaseClient } from '#supabase/server';
import { getServiceClient, assertRoutineAccess } from '~/server/utils/routineAccess';

/**
 * GET /api/routines/active
 * 取得「當前登入者」啟動的排程（可能是自己的或共享的），含完整項目。
 */
export default defineEventHandler(async (event) => {
	const user = await serverSupabaseUser(event);
	if (!user) throw createError({ statusCode: 401, statusMessage: '請先登入' });
	const userId = (user as any).id || (user as any).sub;
	if (!userId) throw createError({ statusCode: 401, statusMessage: '無法識別用戶身份' });

	const supabase = await serverSupabaseClient(event);

	// 讀自己的啟動指標（user client，RLS 自己那列）
	const { data: activeRow } = await (supabase as any)
		.from('user_active_routine')
		.select('routine_id')
		.eq('user_id', userId)
		.maybeSingle();

	const routineId = activeRow?.routine_id;
	if (!routineId) {
		return { success: true, data: null, message: '用戶未有 active routine' };
	}

	// 防呆：指向的排程可能已被刪或分享被暫停 → 清掉並回 null
	try {
		await assertRoutineAccess(event, routineId, 'view');
	} catch {
		await (supabase as any)
			.from('user_active_routine')
			.update({ routine_id: null })
			.eq('user_id', userId);
		return { success: true, data: null, message: '啟動排程已失效' };
	}

	// 以 service key 載入（可能是他人擁有的共享排程）
	const admin = getServiceClient(event);
	const { data: routineData, error: routineError } = await (admin as any)
		.from('routines')
		.select('*')
		.eq('id', routineId)
		.single();
	if (routineError || !routineData) {
		return { success: true, data: null, message: '啟動排程不存在' };
	}

	const { data: itemsData, error: itemsError } = await (admin as any)
		.from('routine_items')
		.select('*')
		.eq('routine_id', routineId)
		.order('day_of_week, time_of_day, sequence_order');
	if (itemsError) {
		throw createError({ statusCode: 500, statusMessage: '查詢排程項目失敗: ' + itemsError.message });
	}

	return {
		success: true,
		data: { ...routineData, items: itemsData || [] },
		message: '成功取得 active routine'
	};
});
```

- [ ] **Step 2：build 驗證**

Run: `npm run build`
Expected：成功。

- [ ] **Step 3：手動驗證**

登入後於瀏覽器 console：
```js
await $fetch('/api/routines/active') // 應回原本啟動排程（backfill 後仍在）
```
再對某排程 `PUT /api/routines/<id>/toggle-active` body `{is_active:true}`，重查 active 應切換為該份。

- [ ] **Step 4：commit 準備**

```bash
git add server/api/routines/[id]/toggle-active.put.ts server/api/routines/active.get.ts
# 例：feat(routine-share): 啟動狀態改 per-user（user_active_routine）
```

### Task 2.3：`list.get.ts` 納入共享排程 + 標記

**Files:** Modify `server/api/routines/list.get.ts`（全檔取代）

- [ ] **Step 1：全檔取代為**

```typescript
import { serverSupabaseUser, serverSupabaseClient } from '#supabase/server';
import { getServiceClient } from '~/server/utils/routineAccess';
import { getUserEmails } from '~/server/utils/userEmails';

/**
 * GET /api/routines/list
 * 回傳：自己擁有的排程 + 別人分享給我（status=active）的排程。
 * 每筆附 _share（共享來源/權限/狀態，自有為 null）與 _is_active_for_me。
 */
export default defineEventHandler(async (event) => {
	const user = await serverSupabaseUser(event);
	if (!user) throw createError({ statusCode: 401, statusMessage: '請先登入' });
	const userId = (user as any).id || (user as any).sub;
	if (!userId) throw createError({ statusCode: 401, statusMessage: '無法識別用戶身份' });

	const supabase = await serverSupabaseClient(event);

	// 1. 自己擁有的（user client 即可）
	const { data: owned, error: ownedErr } = await (supabase as any)
		.from('routines')
		.select('*')
		.eq('user_id', userId)
		.order('created_at', { ascending: false });
	if (ownedErr) throw createError({ statusCode: 500, statusMessage: '查詢排程列表失敗: ' + ownedErr.message });

	// 2. 我的啟動指標
	const { data: activeRow } = await (supabase as any)
		.from('user_active_routine')
		.select('routine_id')
		.eq('user_id', userId)
		.maybeSingle();
	const myActiveId = activeRow?.routine_id || null;

	// 3. 別人分享給我的（active）
	const { data: shares } = await (supabase as any)
		.from('routine_shares')
		.select('routine_id, permission, status, shared_by')
		.eq('user_id', userId)
		.eq('status', 'active');

	const admin = getServiceClient(event);
	let sharedRoutines: any[] = [];
	if (shares && shares.length > 0) {
		const ids = shares.map((s: any) => s.routine_id);
		const { data: rows } = await (admin as any)
			.from('routines')
			.select('*')
			.in('id', ids);
		const emailMap = await getUserEmails(event, shares.map((s: any) => s.shared_by));
		const shareByRoutine = new Map(shares.map((s: any) => [s.routine_id, s]));
		sharedRoutines = (rows || []).map((r: any) => {
			const s = shareByRoutine.get(r.id);
			return {
				...r,
				_share: {
					permission: s.permission,
					status: s.status,
					shared_by_email: emailMap[s.shared_by] || ''
				}
			};
		});
	}

	const ownedTagged = (owned || []).map((r: any) => ({ ...r, _share: null }));
	const all = [...ownedTagged, ...sharedRoutines].map((r: any) => ({
		...r,
		_is_active_for_me: r.id === myActiveId
	}));

	return { success: true, data: all };
});
```

- [ ] **Step 2：build + 手動驗證**

Run: `npm run build` → 成功。
手動：`await $fetch('/api/routines/list')` → 自有排程 `_share:null`；尚無共享時陣列僅自有。

- [ ] **Step 3：commit 準備**

```bash
git add server/api/routines/list.get.ts
# 例：feat(routine-share): 排程列表納入共享項目與啟動標記
```

---

# Phase 3 — 資料 endpoint 改授權

### Task 3.1：`[id].get.ts`（view + service key + orphan owner∪viewer + _access）

**Files:** Modify `server/api/routines/[id].get.ts`（全檔取代）

- [ ] **Step 1：全檔取代為**

```typescript
import { detectConflicts } from '~/server/utils/ingredientConflicts';
import { getServiceClient, assertRoutineAccess } from '~/server/utils/routineAccess';

/**
 * GET /api/routines/:id
 * 取得完整排程（含項目、衝突、可選產品）。支援擁有者與共享協作者。
 */
export default defineEventHandler(async (event) => {
	const routineId = getRouterParam(event, 'id');

	// 授權（view）；回傳含 ownerId / permission
	const access = await assertRoutineAccess(event, routineId, 'view');
	const { ownerId, userId, role, permission } = access;

	// 共享資料一律 service key 讀
	const admin = getServiceClient(event);

	const { data: routineData, error: routineError } = await (admin as any)
		.from('routines')
		.select('*')
		.eq('id', routineId)
		.single();
	if (routineError || !routineData) {
		throw createError({ statusCode: 404, statusMessage: '排程不存在' });
	}

	const { data: itemsData, error: itemsError } = await (admin as any)
		.from('routine_items')
		.select('*')
		.eq('routine_id', routineId)
		.order('day_of_week, time_of_day, sequence_order');
	if (itemsError) {
		throw createError({ statusCode: 500, statusMessage: '查詢排程項目失敗: ' + itemsError.message });
	}

	// orphan 基準：owner 櫃 ∪ 當前檢視者櫃（檢視者剛從自己櫃加的不被誤標）
	const cabinetOwnerIds = Array.from(new Set([ownerId, userId]));
	const { data: productsData } = await (admin as any)
		.from('user_cabinet')
		.select('*')
		.in('user_id', cabinetOwnerIds);

	const existingProductIds = new Set<string>(
		(productsData || []).map((p: any) => p.id).filter(Boolean)
	);
	const itemsWithOrphan = (itemsData || []).map((item: any) => ({
		...item,
		is_orphan: item.product_id != null && !existingProductIds.has(item.product_id)
	}));

	// 成分衝突（優先用 item.ingredients；缺則回查櫃）
	const productIngredientMap = new Map<string, string>();
	for (const p of (productsData || [])) {
		if (p.id && p.raw_ingredients) productIngredientMap.set(p.id, String(p.raw_ingredients).toLowerCase());
	}
	const conflictsByDay: Record<number, { rule: string; message: string }[]> = {};
	for (let day = 0; day < 7; day++) {
		const dayItems = itemsWithOrphan.filter((i: any) => i.day_of_week === day);
		const allIngredients = dayItems
			.map((i: any) => {
				if (Array.isArray(i.ingredients) && i.ingredients.length > 0) return i.ingredients as string[];
				if (i.product_id && productIngredientMap.has(i.product_id)) return [productIngredientMap.get(i.product_id)!];
				return [] as string[];
			})
			.filter((arr: string[]) => arr.length > 0);
		const warnings = detectConflicts(allIngredients);
		if (warnings.length > 0) conflictsByDay[day] = warnings;
	}

	// 「新增產品」挑選清單：用檢視者自己的櫃（只能加自己有的）
	const viewerProducts = (productsData || []).filter((p: any) => p.user_id === userId);

	return {
		success: true,
		data: {
			...routineData,
			items: itemsWithOrphan,
			conflicts_by_day: conflictsByDay,
			all_products: viewerProducts.map((p: any) => ({
				id: p.id,
				product_name: p.product_name,
				product_category: p.product_category,
				raw_ingredients: p.raw_ingredients || '',
				analysis_result: p.analysis_result || null,
				is_recommendation: false
			})),
			_access: { role, permission, owner_id: ownerId }
		},
		message: '成功取得排程'
	};
});
```

- [ ] **Step 2：build + 手動驗證**

`npm run build` → 成功。
手動（擁有者身分）：`await $fetch('/api/routines/<own-id>')` → 含 `_access.role:'owner'`、`permission:'edit'`，items/all_products 如常。

- [ ] **Step 3：commit 準備**

```bash
git add server/api/routines/[id].get.ts
# 例：feat(routine-share): 排程詳情支援協作者讀取（service key + _access）
```

### Task 3.2：`update-order.post.ts`（edit + service key + user_id 帶 ownerId）

**Files:** Modify `server/api/routines/update-order.post.ts`（全檔取代）

> 重點：三向同步全改 service key；讀 existing 與 insert 的 `user_id` 一律帶 `ownerId`，避免協作者寫入造成歸屬錯亂、擁有者再同步時刪光。

- [ ] **Step 1：全檔取代為**

```typescript
import { assertRoutineAccess, getServiceClient } from '~/server/utils/routineAccess';

/**
 * POST /api/routines/update-order
 * 三向同步排程項目（更新/插入/刪除）。支援編輯權協作者。
 * routine_items.user_id 一律寫 ownerId，維持單一歸屬。
 */
export default defineEventHandler(async (event) => {
	const body = await readBody(event);
	const { routine_id, updates } = body || {};
	if (!routine_id || !Array.isArray(updates)) {
		throw createError({ statusCode: 400, statusMessage: '缺少必要欄位：routine_id 或 updates' });
	}

	// 需 edit 權
	const { ownerId } = await assertRoutineAccess(event, routine_id, 'edit');
	const supabase = getServiceClient(event);

	// 現有項目（以 ownerId 為歸屬）
	const { data: existingItems, error: fetchError } = await (supabase as any)
		.from('routine_items')
		.select('*')
		.eq('routine_id', routine_id)
		.eq('user_id', ownerId);
	if (fetchError) {
		throw createError({ statusCode: 500, statusMessage: '讀取現有項目失敗: ' + fetchError.message });
	}

	const existingItemsMap = new Map((existingItems || []).map((item: any) => [item.id, item]));
	const frontendItemIds = new Set(updates.filter((u: any) => u.id).map((u: any) => u.id));

	let updatedCount = 0, insertedCount = 0, deletedCount = 0;
	const errors: string[] = [];

	const itemsToUpdate = updates.filter((u: any) => u.id);
	const itemsToInsert = updates.filter((u: any) => !u.id);
	const itemsToDelete = (existingItems || []).filter((item: any) => !frontendItemIds.has(item.id));

	// 更新
	for (const update of itemsToUpdate) {
		const { id, day_of_week, time_of_day, sequence_order, product_name, product_category, ingredients, is_recommendation, is_locked, recommendation_reason, notes, product_id } = update;
		if (!id || day_of_week === undefined || !time_of_day) {
			errors.push(`無效的更新項目：${JSON.stringify(update)}`); continue;
		}
		if (!existingItemsMap.has(id)) {
			errors.push(`項目 ${id} 不屬於此規劃`); continue;
		}
		const { error: updateError } = await (supabase as any)
			.from('routine_items')
			.update({
				day_of_week, time_of_day, sequence_order, product_name, product_category,
				product_id: product_id ?? null,
				ingredients: ingredients || [],
				is_recommendation: is_recommendation || false,
				is_locked: is_locked === true,
				recommendation_reason: recommendation_reason || null,
				notes: notes || null,
				updated_at: new Date().toISOString()
			})
			.eq('id', id);
		if (updateError) errors.push(`更新項目 ${id} 失敗: ${updateError.message}`);
		else updatedCount++;
	}

	// 插入（user_id 一律 ownerId）
	if (itemsToInsert.length > 0) {
		const itemsForInsert = itemsToInsert.map((item: any) => ({
			routine_id,
			user_id: ownerId,
			product_name: item.product_name,
			product_category: item.product_category,
			product_id: item.product_id ?? null,
			day_of_week: item.day_of_week,
			time_of_day: item.time_of_day,
			sequence_order: item.sequence_order,
			ingredients: item.ingredients || [],
			is_recommendation: item.is_recommendation || false,
			is_locked: item.is_locked === true,
			recommendation_reason: item.recommendation_reason || null,
			notes: item.notes || null
		}));
		const { data: insertData, error: insertError } = await (supabase as any)
			.from('routine_items').insert(itemsForInsert).select();
		if (insertError) errors.push(`批量插入新項目失敗: ${insertError.message}`);
		else if (insertData) insertedCount = insertData.length;
	}

	// 刪除
	if (itemsToDelete.length > 0) {
		const idsToDelete = itemsToDelete.map((item: any) => item.id);
		const { error: deleteError } = await (supabase as any)
			.from('routine_items').delete().in('id', idsToDelete);
		if (deleteError) errors.push(`批量刪除項目失敗: ${deleteError.message}`);
		else deletedCount = itemsToDelete.length;
	}

	const allSuccess = errors.length === 0;
	return {
		success: allSuccess,
		data: {
			updated_count: updatedCount, inserted_count: insertedCount, deleted_count: deletedCount,
			failed_count: errors.length, errors: errors.length > 0 ? errors : undefined
		},
		message: allSuccess
			? `成功同步：更新 ${updatedCount} 個、插入 ${insertedCount} 個、刪除 ${deletedCount} 個項目`
			: `部分操作失敗：更新 ${updatedCount}、插入 ${insertedCount}、刪除 ${deletedCount}、失敗 ${errors.length}`
	};
});
```

- [ ] **Step 2：build + 手動驗證**（擁有者存檔仍正常）

`npm run build` → 成功。
手動：開自己排程、拖動/新增一項、存檔 → 回 `success:true`，重整後變更保留。

- [ ] **Step 3：commit 準備**

```bash
git add server/api/routines/update-order.post.ts
# 例：feat(routine-share): 項目同步支援協作者（service key, 歸屬 ownerId）
```

### Task 3.3：`meta.put.ts`（edit）

**Files:** Modify `server/api/routines/[id]/meta.put.ts`

- [ ] **Step 1：替換 import 行**

把第 1 行
```typescript
import { serverSupabaseUser, serverSupabaseClient } from '#supabase/server';
```
改成
```typescript
import { assertRoutineAccess, getServiceClient } from '~/server/utils/routineAccess';
```

- [ ] **Step 2：替換授權與寫入區塊**

把第 17～51 行（從 `const user = await serverSupabaseUser(event);` 到 `.single();`）整段：

```typescript
  const user = await serverSupabaseUser(event);
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: '請先登入' });
  }

  const userId = user.id || user.sub;
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: '無法識別用戶身份' });
  }

  const body = await readBody(event);
  const name = String(body?.name || '').trim();
  const description = String(body?.description || '').trim();

  if (!name) {
    throw createError({ statusCode: 400, statusMessage: '排程名稱不可為空' });
  }

  if (name.length > 60) {
    throw createError({ statusCode: 400, statusMessage: '排程名稱請限制在 60 字內' });
  }

  const supabase = await serverSupabaseClient(event);

  const { data, error } = await (supabase as any)
    .from('routines')
    .update({
      name,
      description: description || null,
      updated_at: new Date().toISOString()
    })
    .eq('id', routineId)
    .eq('user_id', userId)
    .select('id, name, description')
    .single();
```

替換為：

```typescript
  await assertRoutineAccess(event, routineId, 'edit');

  const body = await readBody(event);
  const name = String(body?.name || '').trim();
  const description = String(body?.description || '').trim();

  if (!name) {
    throw createError({ statusCode: 400, statusMessage: '排程名稱不可為空' });
  }

  if (name.length > 60) {
    throw createError({ statusCode: 400, statusMessage: '排程名稱請限制在 60 字內' });
  }

  const supabase = getServiceClient(event);

  const { data, error } = await (supabase as any)
    .from('routines')
    .update({
      name,
      description: description || null,
      updated_at: new Date().toISOString()
    })
    .eq('id', routineId)
    .select('id, name, description')
    .single();
```

- [ ] **Step 3：commit 準備**（與 3.4 一起）

### Task 3.4：`update-themes.post.ts`（edit）

**Files:** Modify `server/api/routines/update-themes.post.ts`

- [ ] **Step 1：替換 import 行**

第 1 行改為：
```typescript
import { assertRoutineAccess, getServiceClient } from '~/server/utils/routineAccess';
```

- [ ] **Step 2：替換授權與寫入**

把第 9～61 行（從 `const user = await serverSupabaseUser(event);` 到第二個 `.eq('user_id', userId);`）整段替換為：

```typescript
		const body = await readBody(event);
		const { routine_id, themes = [], custom_themes = [] } = body;

		if (!routine_id) {
			throw createError({ statusCode: 400, statusMessage: '缺少必要參數：routine_id' });
		}

		await assertRoutineAccess(event, routine_id, 'edit');
		const supabase = getServiceClient(event);

		const { error: updateError } = await (supabase as any)
			.from('routines')
			.update({ themes, custom_themes })
			.eq('id', routine_id);
```

（保留其後 `if (updateError) {...}` 與 return 不變。）

- [ ] **Step 3：build 驗證**

`npm run build` → 成功。

- [ ] **Step 4：commit 準備**

```bash
git add server/api/routines/[id]/meta.put.ts server/api/routines/update-themes.post.ts
# 例：feat(routine-share): meta / themes 寫入改 assertRoutineAccess(edit)
```

### Task 3.5：`efficacy-recs.post.ts`（掛 edit gate）

**Files:** Modify `server/api/routines/[id]/efficacy-recs.post.ts`

> 此 endpoint 只讀「呼叫者自己的」profile + cabinet 產生建議、不寫排程。加 edit gate 使其僅在有編輯權時可用（屬編輯 UX 一環），呼叫者資料來源維持自己。

- [ ] **Step 1：在授權後加 gate**

第 2 行 import 之後新增：
```typescript
import { assertRoutineAccess } from '~/server/utils/routineAccess';
```
在第 8 行 `const supabase = await serverSupabaseClient(event);` 之前插入一行：
```typescript
	await assertRoutineAccess(event, getRouterParam(event, 'id'), 'edit');
```

- [ ] **Step 2：build 驗證**

`npm run build` → 成功。

- [ ] **Step 3：commit 準備**

```bash
git add server/api/routines/[id]/efficacy-recs.post.ts
# 例：feat(routine-share): efficacy-recs 加編輯權限守衛
```

### Task 3.6：`lock.patch.ts`（edit；由 item 反查 routine）

**Files:** Modify `server/api/routines/items/[id]/lock.patch.ts`（全檔取代）

- [ ] **Step 1：全檔取代為**

```typescript
import { assertRoutineAccess, getServiceClient } from '~/server/utils/routineAccess';

/**
 * PATCH /api/routines/items/[id]/lock
 * 切換單一項目鎖定。由 item 反查所屬 routine 後驗 edit 權。
 */
export default defineEventHandler(async (event) => {
	const itemId = getRouterParam(event, 'id');
	if (!itemId) throw createError({ statusCode: 400, statusMessage: '缺少必要參數：itemId' });

	const body = await readBody(event);
	const { is_locked } = body || {};
	if (typeof is_locked !== 'boolean') {
		throw createError({ statusCode: 400, statusMessage: 'is_locked 必須是布林值' });
	}

	const admin = getServiceClient(event);

	// 反查 item 所屬 routine
	const { data: item, error: itemError } = await (admin as any)
		.from('routine_items')
		.select('id, routine_id')
		.eq('id', itemId)
		.single();
	if (itemError || !item) {
		throw createError({ statusCode: 404, statusMessage: '找不到此排程項目' });
	}

	// 驗 edit 權
	await assertRoutineAccess(event, item.routine_id, 'edit');

	const { error: updateError } = await (admin as any)
		.from('routine_items')
		.update({ is_locked })
		.eq('id', itemId);
	if (updateError) {
		throw createError({ statusCode: 500, statusMessage: '更新鎖定狀態失敗: ' + updateError.message });
	}

	return { success: true, data: { id: itemId, is_locked }, message: is_locked ? '項目已鎖定' : '項目已解鎖' };
});
```

- [ ] **Step 2：commit 準備**（與 3.7 一起）

### Task 3.7：`[id].delete.ts`（owner only + service key）

**Files:** Modify `server/api/routines/[id].delete.ts`（全檔取代）

- [ ] **Step 1：全檔取代為**

```typescript
import { assertRoutineAccess, getServiceClient } from '~/server/utils/routineAccess';

/**
 * DELETE /api/routines/[id]
 * 刪除排程（僅擁有者）。routine_shares / user_active_routine 由 FK 連動清理。
 */
export default defineEventHandler(async (event) => {
	const routineId = getRouterParam(event, 'id');

	// 僅擁有者
	await assertRoutineAccess(event, routineId, 'owner');
	const supabase = getServiceClient(event);

	// 先刪項目
	const { error: deleteItemsError } = await (supabase as any)
		.from('routine_items')
		.delete()
		.eq('routine_id', routineId);
	if (deleteItemsError) {
		throw createError({ statusCode: 500, statusMessage: '刪除排程項目失敗: ' + deleteItemsError.message });
	}

	// 再刪排程本身（routine_shares ON DELETE CASCADE、user_active_routine ON DELETE SET NULL 連動）
	const { error: deleteError } = await (supabase as any)
		.from('routines')
		.delete()
		.eq('id', routineId);
	if (deleteError) {
		throw createError({ statusCode: 500, statusMessage: '刪除排程失敗: ' + deleteError.message });
	}

	return { success: true, message: '排程已刪除' };
});
```

- [ ] **Step 2：build + 手動驗證**

`npm run build` → 成功。
手動：建一個測試排程再刪 → `success:true`；非擁有者呼叫應 403（Phase 4 後測）。

- [ ] **Step 3：commit 準備**

```bash
git add server/api/routines/items/[id]/lock.patch.ts server/api/routines/[id].delete.ts
# 例：feat(routine-share): lock 改 edit 守衛、delete 限擁有者
```

### Task 3.8：`checkins.get.ts`（view；items service key、打卡 user client 自己的）

**Files:** Modify `server/api/routines/[id]/checkins.get.ts`（全檔取代）

- [ ] **Step 1：全檔取代為**

```typescript
import { serverSupabaseClient } from '#supabase/server';
import { assertRoutineAccess, getServiceClient } from '~/server/utils/routineAccess';

export default defineEventHandler(async (event) => {
	const routineId = getRouterParam(event, 'id');
	const { userId } = await assertRoutineAccess(event, routineId, 'view');

	const query = getQuery(event);
	const rawDate = query.date;
	const date = typeof rawDate === 'string' ? rawDate : new Date().toISOString().slice(0, 10);

	// item ids：service key（可能是他人排程）
	const admin = getServiceClient(event);
	const { data: itemRows, error: itemsError } = await (admin as any)
		.from('routine_items')
		.select('id')
		.eq('routine_id', routineId);
	if (itemsError) {
		throw createError({ statusCode: 500, statusMessage: '查詢排程項目失敗: ' + itemsError.message });
	}
	const itemIds = (itemRows || []).map((i: any) => i.id);
	if (itemIds.length === 0) {
		return { success: true, data: { checked_ids: [], date } };
	}

	// 自己的打卡：user client（RLS auth.uid()=user_id）
	const supabase = await serverSupabaseClient(event);
	const { data: checkins, error: checkinsError } = await (supabase as any)
		.from('routine_checkins')
		.select('routine_item_id')
		.eq('user_id', userId)
		.eq('checked_date', date)
		.in('routine_item_id', itemIds);
	if (checkinsError) {
		throw createError({ statusCode: 500, statusMessage: '查詢打卡記錄失敗: ' + checkinsError.message });
	}

	const checkedIds = (checkins || []).map((c: any) => c.routine_item_id);
	return { success: true, data: { checked_ids: checkedIds, date } };
});
```

- [ ] **Step 2：commit 準備**（與 3.9 一起）

### Task 3.9：`checkins/toggle.post.ts`（view；反查 routine）

**Files:** Modify `server/api/routines/checkins/toggle.post.ts`（全檔取代）

- [ ] **Step 1：全檔取代為**

```typescript
import { serverSupabaseClient } from '#supabase/server';
import { assertRoutineAccess, getServiceClient } from '~/server/utils/routineAccess';

export default defineEventHandler(async (event) => {
	const { routine_item_id, checked_date } = await readBody(event);
	if (!routine_item_id || !checked_date) {
		throw createError({ statusCode: 400, statusMessage: '缺少 routine_item_id 或 checked_date' });
	}

	// 反查 item 所屬 routine（service key）
	const admin = getServiceClient(event);
	const { data: item, error: itemError } = await (admin as any)
		.from('routine_items')
		.select('routine_id')
		.eq('id', routine_item_id)
		.single();
	if (itemError || !item) {
		throw createError({ statusCode: 404, statusMessage: '找不到此排程項目' });
	}

	// 至少 view 權才能打卡
	const { userId } = await assertRoutineAccess(event, item.routine_id, 'view');

	// 打卡是自己的：user client
	const supabase = await serverSupabaseClient(event);
	const { data: existing } = await (supabase as any)
		.from('routine_checkins')
		.select('id')
		.eq('routine_item_id', routine_item_id)
		.eq('checked_date', checked_date)
		.eq('user_id', userId)
		.maybeSingle();

	if (existing) {
		await (supabase as any).from('routine_checkins').delete().eq('id', existing.id);
		return { success: true, checked: false };
	} else {
		await (supabase as any).from('routine_checkins').insert({ user_id: userId, routine_item_id, checked_date });
		return { success: true, checked: true };
	}
});
```

- [ ] **Step 2：build + 手動驗證**

`npm run build` → 成功。
手動（擁有者）：在每日視圖打卡一個項目 → 再讀 `checkins?date=` 應含該 item id。

- [ ] **Step 3：commit 準備**

```bash
git add server/api/routines/[id]/checkins.get.ts server/api/routines/checkins/toggle.post.ts
# 例：feat(routine-share): 打卡讀寫支援協作者（view 守衛、各自打卡）
```

---

# Phase 4 — 分享管理 endpoints

### Task 4.1：`share/search-users.get.ts`

**Files:** Create `server/api/routines/share/search-users.get.ts`

- [ ] **Step 1：建立檔案**

```typescript
import { serverSupabaseUser } from '#supabase/server';
import { searchUserEmails } from '~/server/utils/userEmails';

/**
 * GET /api/routines/share/search-users?q=<prefix>
 * email 前綴搜尋（≥2 碼），回最多 8 筆、排除自己。
 */
export default defineEventHandler(async (event) => {
	const user = await serverSupabaseUser(event);
	if (!user) throw createError({ statusCode: 401, statusMessage: '請先登入' });
	const userId = (user as any).id || (user as any).sub;
	if (!userId) throw createError({ statusCode: 401, statusMessage: '無法識別用戶身份' });

	const q = String(getQuery(event).q || '').trim();
	if (q.length < 2) return { success: true, data: [] };

	const results = await searchUserEmails(event, q, userId);
	return { success: true, data: results };
});
```

- [ ] **Step 2：build + 手動 + 資安驗證**

`npm run build` → 成功。
手動：`await $fetch('/api/routines/share/search-users?q=<你信箱前2碼>')` → 回含對方/其他帳號（排除自己）。
資安：在瀏覽器以一般登入身分試 `const c = useSupabaseClient(); await c.rpc('search_user_emails',{prefix:'a'})` → 應 **被拒**（permission denied），證明 RPC 未外洩。

- [ ] **Step 3：commit 準備**

```bash
git add server/api/routines/share/search-users.get.ts
# 例：feat(routine-share): email 前綴搜尋 endpoint
```

### Task 4.2：`[id]/shares/index.get.ts`（owner 列出）

**Files:** Create `server/api/routines/[id]/shares/index.get.ts`

- [ ] **Step 1：建立檔案**

```typescript
import { assertRoutineAccess, getServiceClient } from '~/server/utils/routineAccess';
import { getUserEmails } from '~/server/utils/userEmails';

/**
 * GET /api/routines/[id]/shares
 * 列出此排程所有分享對象（僅擁有者）。
 */
export default defineEventHandler(async (event) => {
	const routineId = getRouterParam(event, 'id');
	await assertRoutineAccess(event, routineId, 'owner');

	const admin = getServiceClient(event);
	const { data: shares, error } = await (admin as any)
		.from('routine_shares')
		.select('id, user_id, permission, status, created_at')
		.eq('routine_id', routineId)
		.order('created_at', { ascending: true });
	if (error) throw createError({ statusCode: 500, statusMessage: '查詢分享列表失敗: ' + error.message });

	const emailMap = await getUserEmails(event, (shares || []).map((s: any) => s.user_id));
	const data = (shares || []).map((s: any) => ({
		id: s.id,
		user_id: s.user_id,
		email: emailMap[s.user_id] || '',
		permission: s.permission,
		status: s.status
	}));
	return { success: true, data };
});
```

- [ ] **Step 2：commit 準備**（與 4.3~4.5 一起）

### Task 4.3：`[id]/shares/index.post.ts`（owner 新增）

**Files:** Create `server/api/routines/[id]/shares/index.post.ts`

- [ ] **Step 1：建立檔案**

```typescript
import { assertRoutineAccess, getServiceClient } from '~/server/utils/routineAccess';

/**
 * POST /api/routines/[id]/shares
 * body: { target_user_id, permission: 'view'|'edit' }
 * 新增/更新分享（upsert by routine_id+user_id，status 設 active）。僅擁有者。
 */
export default defineEventHandler(async (event) => {
	const routineId = getRouterParam(event, 'id');
	const { ownerId } = await assertRoutineAccess(event, routineId, 'owner');

	const body = await readBody(event);
	const targetUserId = String(body?.target_user_id || '');
	const permission = body?.permission === 'edit' ? 'edit' : 'view';

	if (!targetUserId) throw createError({ statusCode: 400, statusMessage: '缺少 target_user_id' });
	if (targetUserId === ownerId) throw createError({ statusCode: 400, statusMessage: '不可分享給自己' });

	const admin = getServiceClient(event);
	const { data, error } = await (admin as any)
		.from('routine_shares')
		.upsert(
			{
				routine_id: routineId,
				user_id: targetUserId,
				shared_by: ownerId,
				permission,
				status: 'active',
				updated_at: new Date().toISOString()
			},
			{ onConflict: 'routine_id,user_id' }
		)
		.select('id, user_id, permission, status')
		.single();
	if (error) throw createError({ statusCode: 500, statusMessage: '新增分享失敗: ' + error.message });

	return { success: true, data, message: '已分享' };
});
```

- [ ] **Step 2：commit 準備**（與 4.4~4.5 一起）

### Task 4.4：`[id]/shares/[shareId].patch.ts`（改權限/暫停恢復 + 清啟動）

**Files:** Create `server/api/routines/[id]/shares/[shareId].patch.ts`

- [ ] **Step 1：建立檔案**

```typescript
import { assertRoutineAccess, getServiceClient } from '~/server/utils/routineAccess';

/**
 * PATCH /api/routines/[id]/shares/[shareId]
 * body: { permission?, status? }。僅擁有者。
 * status 改 paused 時，順手清掉該協作者指向此排程的啟動指標。
 */
export default defineEventHandler(async (event) => {
	const routineId = getRouterParam(event, 'id');
	const shareId = getRouterParam(event, 'shareId');
	await assertRoutineAccess(event, routineId, 'owner');

	const body = await readBody(event);
	const patch: Record<string, any> = { updated_at: new Date().toISOString() };
	if (body?.permission === 'view' || body?.permission === 'edit') patch.permission = body.permission;
	if (body?.status === 'active' || body?.status === 'paused') patch.status = body.status;
	if (patch.permission === undefined && patch.status === undefined) {
		throw createError({ statusCode: 400, statusMessage: '無可更新欄位' });
	}

	const admin = getServiceClient(event);
	const { data: updated, error } = await (admin as any)
		.from('routine_shares')
		.update(patch)
		.eq('id', shareId)
		.eq('routine_id', routineId)
		.select('id, user_id, permission, status')
		.single();
	if (error || !updated) throw createError({ statusCode: 404, statusMessage: '找不到分享紀錄或更新失敗' });

	// 暫停時：清掉該協作者指向此排程的每日啟動（避免每日視圖指向看不到的排程）
	if (patch.status === 'paused') {
		await (admin as any)
			.from('user_active_routine')
			.update({ routine_id: null })
			.eq('user_id', updated.user_id)
			.eq('routine_id', routineId);
	}

	return { success: true, data: updated, message: '已更新分享設定' };
});
```

- [ ] **Step 2：commit 準備**（與 4.5 一起）

### Task 4.5：`[id]/shares/[shareId].delete.ts`（移除 + 清啟動）

**Files:** Create `server/api/routines/[id]/shares/[shareId].delete.ts`

- [ ] **Step 1：建立檔案**

```typescript
import { assertRoutineAccess, getServiceClient } from '~/server/utils/routineAccess';

/**
 * DELETE /api/routines/[id]/shares/[shareId]
 * 移除分享（僅擁有者）。順手清該協作者指向此排程的啟動指標。
 */
export default defineEventHandler(async (event) => {
	const routineId = getRouterParam(event, 'id');
	const shareId = getRouterParam(event, 'shareId');
	await assertRoutineAccess(event, routineId, 'owner');

	const admin = getServiceClient(event);

	// 先取得 user_id 供清理
	const { data: share } = await (admin as any)
		.from('routine_shares')
		.select('user_id')
		.eq('id', shareId)
		.eq('routine_id', routineId)
		.maybeSingle();

	const { error } = await (admin as any)
		.from('routine_shares')
		.delete()
		.eq('id', shareId)
		.eq('routine_id', routineId);
	if (error) throw createError({ statusCode: 500, statusMessage: '移除分享失敗: ' + error.message });

	if (share?.user_id) {
		await (admin as any)
			.from('user_active_routine')
			.update({ routine_id: null })
			.eq('user_id', share.user_id)
			.eq('routine_id', routineId);
	}

	return { success: true, message: '已移除分享' };
});
```

- [ ] **Step 2：build + 端到端手動驗證（兩帳號）**

`npm run build` → 成功。
用 A、B 兩個帳號：
1. A 搜 B email → `POST shares` permission=`edit` → `GET shares` 見 B（edit/active）。
2. B `GET /api/routines/list` → 出現該排程、`_share.shared_by_email=A`、`_share.permission='edit'`。
3. B `GET /api/routines/<id>` → `_access.role='member'`、`permission='edit'`；B 存檔 → 成功，A 重整看得到。
4. B `toggle-active` 該排程 → B `GET active` 顯示它。
5. A `PATCH shares/<shareId>` status=`paused` → B `GET list` 不再有它、B `GET active` 回 null。
6. A `PATCH` status=`active` → B 又看到、過往編輯仍在。
7. B(view 權，先改 permission=`view`) 嘗試 `POST update-order` → 403。
8. B 嘗試 `DELETE /api/routines/<id>` → 403（非擁有者）。

- [ ] **Step 3：commit 準備**

```bash
git add server/api/routines/[id]/shares/
# 例：feat(routine-share): 分享管理 endpoints（列出/新增/改權限/暫停/移除）
```

---

# Phase 5 — 前端

> 樣式遵 `design.md` token，新元件優先 Tailwind、不開 `<style scoped>`；禁用 emoji icon（用 SVG/CSS）。

### Task 5.1：`ShareRoutineModal.vue`

**Files:** Create `components/routine/ShareRoutineModal.vue`

- [ ] **Step 1：建立元件**

```vue
<script setup lang="ts">
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
		} catch { hits.value = []; }
	}, 300);
});

const loadShares = async () => {
	try {
		const res = await $fetch<any>(`/api/routines/${props.routineId}/shares`);
		shares.value = res.data || [];
	} catch (e: any) { errorMsg.value = e?.statusMessage || '載入分享清單失敗'; }
};
onMounted(loadShares);

const pick = (h: SearchHit) => { selected.value = h; query.value = h.email; hits.value = []; };

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
			<label class="mb-1 block text-sm text-gray-600">以 Email 搜尋對象（至少 2 碼）</label>
			<input v-model="query" type="text" placeholder="輸入對方 Email"
				class="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none" />
			<ul v-if="hits.length" class="mt-1 max-h-40 overflow-auto rounded-lg border border-border">
				<li v-for="h in hits" :key="h.user_id"
					class="cursor-pointer px-3 py-2 text-sm hover:bg-gray-100" @click="pick(h)">{{ h.email }}</li>
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
							<div class="truncate">{{ s.email }}</div>
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
```

- [ ] **Step 2：commit 準備**（與 5.2 一起）

### Task 5.2：排程詳情頁掛分享鈕（僅擁有者）

**Files:** Modify `pages/routines/[id].vue`

- [ ] **Step 1：在 `<script setup>` 內加狀態與計算**

於 `loadRoutineById` 函式附近（約第 145 行前）新增：

```typescript
// 分享 modal 開關
const showShareModal = ref(false);
// 是否可編輯（owner / edit 權 → true；view → false）
const canEdit = computed(() => (routine.value?._access?.permission ?? 'edit') !== 'view');
// 是否為擁有者（只有擁有者顯示分享鈕）
const isOwner = computed(() => routine.value?._access?.role === 'owner');
```

- [ ] **Step 2：在 template 的 `<RoutineHeader ... />` 之後加分享鈕與 modal**

於第 4 行 `<RoutineHeader` 元件結束標籤之後插入：

```vue
		<div v-if="isOwner" class="mb-3 flex justify-end">
			<button class="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm text-accent hover:bg-gray-50"
				@click="showShareModal = true">
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
					<line x1="8.6" y1="13.5" x2="15.4" y2="17.5" /><line x1="15.4" y1="6.5" x2="8.6" y2="10.5" />
				</svg>
				分享
			</button>
		</div>
		<ShareRoutineModal v-if="showShareModal" :routine-id="routineId" @close="showShareModal = false" />
```

（`routineId` 已存在於本頁；`ShareRoutineModal` 為 `components/routine/` 下元件，Nuxt 自動 import。）

- [ ] **Step 3：build 驗證**

`npm run build` → 成功。

- [ ] **Step 4：commit 準備**

```bash
git add components/routine/ShareRoutineModal.vue pages/routines/[id].vue
# 例：feat(routine-share): 分享 modal 與詳情頁分享入口
```

### Task 5.3：詳情頁依權限鎖定編輯操作

**Files:** Modify `pages/routines/[id].vue`（接續 5.2 的 `canEdit`）

- [ ] **Step 1：把寫入操作以 `canEdit` 守住**

於存檔/鎖定/刪除等寫入函式（如 `saveOrder`、lock 切換、刪項目）開頭各加守衛。範例——找到呼叫 `/update-order` 的函式（約第 203 行 `if (!routine.value) return;`）：

```typescript
	if (!routine.value) return;
```
在其後加：
```typescript
	if (!canEdit.value) return; // 唯讀協作者不可寫入
```
同樣在 lock 切換函式（約第 166 行 `if (!routine.value) return;`）其後加同一行 `if (!canEdit.value) return;`。

- [ ] **Step 2：UI 上對唯讀者隱藏編輯入口（傳 prop 給 Header）**

在 template 的 `<RoutineHeader` 標籤加上一個 prop（若 Header 已有控制鈕，依其既有 prop 命名；無則新增）：

```vue
	<RoutineHeader
		:can-edit="canEdit"
		...既有 props...
	/>
```
並在 `components/routine/RoutineHeader.vue` 的 `<script setup>` defineProps 補 `canEdit?: boolean`（預設 `true`），把「編輯名稱 / 新增項目 / 儲存」等按鈕用 `v-if="canEdit"` 或 `:disabled="!canEdit"` 包住。

> 註：執行前先讀 `components/routine/RoutineHeader.vue` 確認既有按鈕與 prop 命名，套用同風格，不另造命名。

- [ ] **Step 3：build + 手動驗證**

`npm run build` → 成功。
手動：以 view 權 B 帳號開該排程 → 看不到/不能用編輯鈕、存檔不送出；edit 權 B → 可編輯。

- [ ] **Step 4：commit 準備**

```bash
git add pages/routines/[id].vue components/routine/RoutineHeader.vue
# 例：feat(routine-share): 依存取權限鎖定唯讀協作者的編輯操作
```

### Task 5.4：列表頁顯示共享來源與權限

**Files:** Modify `pages/routines/active.vue`

- [ ] **Step 1：先讀現有列表渲染結構**

讀 `pages/routines/active.vue`，找到 `v-for` 渲染各排程卡片之處與其資料來源（應來自 `/api/routines/list` 的 `data`，每項現含 `_share` 與 `_is_active_for_me`）。

- [ ] **Step 2：在卡片內加共享標籤**

在每張排程卡片標題附近插入（`r` 為 v-for 變數，依實際命名調整）：

```vue
	<span v-if="r._share" class="ml-2 inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
		由 {{ r._share.shared_by_email }} 分享 ·
		{{ r._share.permission === 'edit' ? '可編輯' : '檢視' }}
	</span>
```

> 註：依 active.vue 既有 class 風格微調；若卡片用元件渲染，於該元件補 `_share` 顯示。

- [ ] **Step 3：build + 手動驗證**

`npm run build` → 成功。
手動：B 帳號開排程列表頁 → 共享排程顯示「由 A 分享 · 可編輯/檢視」徽章。

- [ ] **Step 4：commit 準備**

```bash
git add pages/routines/active.vue
# 例：feat(routine-share): 列表頁顯示共享來源與權限徽章
```

---

## 收尾

- [ ] **最終全量 build**：`npm run build` → 成功（Vercel 等級）。
- [ ] **端到端回歸**：重跑 Task 4.5 Step 2 的 8 項雙帳號驗證 + 共享排程刪除連鎖（owner 刪排程 → B 的 list 不再有、`user_active_routine.routine_id` 轉 null）。
- [ ] **文件**：依使用者規則跑 `sync-docs` 更新 `PROJECT_PLAN.md`（新頁面/endpoint/表）與 `design.md`（新 modal 樣式 token）；提醒使用者可 `/graphify` 更新架構圖。
- [ ] **Commit / Push**：彙整 commit message 交使用者確認；**不自行 push / merge**。

---

## Spec ↔ Plan 覆蓋對照（self-review）

| Spec 章節 | 對應 Task |
|---|---|
| §2.1 routine_shares / §2.2 user_active_routine / §2.4 migration / §2.4 RPC+REVOKE | 0.1 |
| §3.0 service-key 策略 / §3.1 assertRoutineAccess | 1.1、貫穿 Phase 3 |
| §3.2 各 endpoint 授權層級 | 3.1–3.9 |
| §3.4 routine_shares RLS | 0.1 Step 2 |
| §4 per-user 啟動（toggle-active / active.get） | 2.1、2.2 |
| §5 列表整合 | 2.3 |
| §6 orphan owner∪viewer / all_products=viewer | 3.1 |
| §7 email 前綴搜尋 | 1.2、4.1 |
| §8 分享管理 endpoints | 4.2–4.5 |
| §9 暫停/再分享/移除清啟動 | 4.4、4.5 |
| §10 前端（modal / 列表 / 權限 gating） | 5.1–5.4 |
| §13 測試重點 | 4.5 Step2、收尾回歸 |
