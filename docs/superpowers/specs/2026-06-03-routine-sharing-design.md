# 排程分享（即時協作）設計 Spec

- **日期**：2026-06-03
- **功能**：使用者把做好的保養排程分享給他人，分「檢視」與「編輯」兩種權限，協作者操作同一份排程（連回原 DB）。
- **背景**：原 backlog Feature 10 只規劃「唯讀公開連結」。本次需求升級為「即時協作 + 可編輯 + email 邀請」，故重新設計。

---

## 1. 名詞與範圍定義

- **即時協作 = 同一筆記錄協作**：協作者編輯的是同一筆 `routines` / `routine_items`，變更屬於該排程本體。**非** websocket 即時推播；他人變更在**下次載入 / 重新整理**時看到（last-write-wins，沿用現有並發行為）。
- **擁有者 (owner)**：`routines.user_id`。隱含 edit 權，且唯一可刪除排程、管理分享。
- **協作者 (member)**：被分享者，於 `routine_shares` 有一筆 `status='active'` 的列。權限 `view` 或 `edit`。

### 不在本次範圍（v1 明確排除）
- 即時推播 / 線上狀態 / 編輯衝突合併 → 採 last-write-wins。
- 對「尚未註冊」email 的待領邀請（pending invite）→ 對方必須是已註冊用戶。
- 跨櫃 `product_id` 的完整 orphan 精確度 → 見 §6，採簡化規則。
- 分享 cabinet（保養品櫃）→ 僅分享 routine。

---

## 2. 資料模型變更

### 2.1 新表 `routine_shares`

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | uuid PK default gen_random_uuid() | |
| `routine_id` | uuid NOT NULL → `routines(id)` ON DELETE CASCADE | 被分享的排程 |
| `user_id` | uuid NOT NULL → `auth.users(id)` ON DELETE CASCADE | **協作者**（被分享者）。FK 指 `auth.users` 非 `profiles`——被分享者可能尚未做 profile-setup（無 profiles 列），但 email 搜尋找得到（auth.users 必存在）。與 `routine_checkins` 一致 |
| `shared_by` | uuid NOT NULL → `auth.users(id)` | 分享者（即 owner），用於列表顯示「誰分享的」 |
| `permission` | text NOT NULL CHECK in (`view`,`edit`) default `view` | 權限 |
| `status` | text NOT NULL CHECK in (`active`,`paused`) default `active` | 暫停用 |
| `created_at` | timestamptz default now() | |
| `updated_at` | timestamptz default now() | |

- `UNIQUE (routine_id, user_id)` — 同一人對同一排程只有一筆關係列。暫停/再分享/改權限皆 **update 此列**，不刪不重建（→ 對方 email 不必重搜、打卡延續）。

### 2.2 新表 `user_active_routine`（per-user 啟動指標）

| 欄位 | 型別 | 說明 |
|---|---|---|
| `user_id` | uuid PK → `auth.users(id)` ON DELETE CASCADE | 使用者 |
| `routine_id` | uuid NULL → `routines(id)` ON DELETE SET NULL | 該使用者當前啟動的排程，可指向自己的或共享的 |
| `updated_at` | timestamptz default now() | |

- 語意：**每位使用者**「每日視圖目前啟動哪份排程」。取代 `routines.is_active` 作為「每日視圖來源」的角色。
- **為何獨立成表（而非 `profiles.active_routine_id`）**：被分享者可能尚未做 profile-setup → `profiles` 無列；且 `profiles.base_skin_type` 為 NOT NULL，硬 upsert 需捏造假肌膚類型污染資料。獨立表可無條件 upsert、FK 指 `auth.users`、零 NOT NULL 包袱。RLS `auth.uid()=user_id` 自己讀寫自己，故此表續用 **user-scoped client**。

### 2.3 `routines.is_active` 去角色化

- 現況：`routines.is_active` 欄 + 一個 partial unique index（每 owner 最多一個 active）。
- 變更：**單一真實來源改為 `user_active_routine.routine_id`**（§2.2）。
  - **移除**該 partial unique index（協作下「啟動」是 per-user，不再是 per-owner-routine）。
  - `is_active` 欄位**保留但不再被讀取**（避免動 `create.post.ts` 預設值與既有資料；標記為 legacy / no-op）。

### 2.4 Migration 步驟（Supabase `apply_migration`）

```sql
-- 1. routine_shares
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

-- 2. user_active_routine（per-user 啟動指標；獨立表，避免 profiles 無列 / base_skin_type NOT NULL 問題）
create table public.user_active_routine (
  user_id uuid primary key references auth.users(id) on delete cascade,
  routine_id uuid references public.routines(id) on delete set null,
  updated_at timestamptz default now()
);
alter table public.user_active_routine enable row level security;
-- RLS：使用者只能讀寫自己那列
create policy "own active routine" on public.user_active_routine
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 3. backfill：把舊 is_active 排程設為各 owner 的 active
insert into public.user_active_routine (user_id, routine_id)
select r.user_id, r.id from public.routines r where r.is_active = true
on conflict (user_id) do update set routine_id = excluded.routine_id;

-- 4. 移除舊 partial unique index（實作時以 \d routines 或 pg_indexes 查出實際 index 名）
--    例：drop index if exists public.<routines_active_unique_idx>;

-- 5. RLS（見 §3.4）
alter table public.routine_shares enable row level security;
-- ...policies（§3.4）

-- 6. Email 查詢 RPC（SECURITY DEFINER，因 auth.users 無法經 PostgREST 直查）
--    前綴搜尋：回 user_id + email，排除呼叫者，上限由 app 控
create or replace function public.search_user_emails(prefix text)
returns table(user_id uuid, email text)
language sql security definer set search_path = public, auth as $$
  select u.id, u.email::text
  from auth.users u
  where u.email ilike prefix || '%'
  limit 20
$$;
--    批次反解 email（給 shared_by_email / 分享列表用）
create or replace function public.get_user_emails(ids uuid[])
returns table(user_id uuid, email text)
language sql security definer set search_path = public, auth as $$
  select u.id, u.email::text from auth.users u where u.id = any(ids)
$$;

-- 7. 【資安必做】SECURITY DEFINER 預設把 EXECUTE 給 PUBLIC，PostgREST 會曝給 anon/authenticated，
--    惡意登入者可直接 supabase.rpc(...) 跑迴圈枚舉全站 email → 收回，只留 service_role。
revoke execute on function public.search_user_emails(text) from public, anon, authenticated;
revoke execute on function public.get_user_emails(uuid[]) from public, anon, authenticated;
grant execute on function public.search_user_emails(text) to service_role;
grant execute on function public.get_user_emails(uuid[]) to service_role;
-- 兩支 RPC 僅由 server 端以 service key 呼叫；app 層再做 ≥2 碼 / 上限 8 / 排除自己 / rate limit
```

---

## 3. 權限模型

### 3.0 RLS 現況與資料存取策略（關鍵修正）

**現況查證（pg_policies）**：`routines` / `routine_items` 的 SELECT/INSERT/UPDATE/DELETE policy 全部是 `auth.uid() = user_id`，`profiles` 是 `auth.uid() = id`，`routine_checkins` 是 `auth.uid() = user_id`。

**後果**：協作者帶自己的 token、用 user-scoped `serverSupabaseClient`，**連擁有者那筆 `routines` / `routine_items` 都 SELECT 不到**（RLS 直接擋）。故「讀」與「寫」共享排程資料在 user client 下全部失效。

**策略（採 S1：service-key + app 層授權）**：
- `assertRoutineAccess` 通過後，**共享排程的 routine / routine_items 讀寫一律改用 service-key client**（`NUXT_SUPABASE_SECRET_KEY`），以 `assertRoutineAccess` + 明確 `.eq` 過濾作為安全邊界。
- 符合 CLAUDE.md：規則是「不得**拿掉**明確 user_id/權限過濾、單靠 RLS」；此處是「RLS 無法表達 membership」，故以明確的 `assertRoutineAccess` 取代 per-owner RLS，過濾依然顯式存在，非裸放。與既有 `analyze.post.ts` 用 service key 管 guest 限額同模式。
- 既有 user-scoped RLS **保留不動**（仍擋任何繞過 app 的 user-client 直連），service key 僅在 server endpoint 內、授權後使用。
- **item user_id 正規化**：所有 `routine_items` 寫入一律設 `user_id = ownerId`（非編輯者），使排程項目維持單一擁有者歸屬，擁有者既有的 `update-order` 同步邏輯（讀 existing 卡 `.eq('user_id', ownerId)`）不被破壞，避免 member 寫入造成 user_id 不一致、同步打結。
- **`update-order.post.ts` 連帶調整**：第 4 步「驗證 routine 屬於 user」改為 `assertRoutineAccess(edit)`；第 5 步讀 existing items 與第 7~9 步增改刪改用 service key 且 `user_id` 一律帶 `ownerId`；插入時 `user_id: ownerId`（非 `userId`）。

> **被本次否決的替代案 S2（擴充 RLS membership policy）**：在 routines/routine_items 加「owner OR active member」policy 讓 user client 自然可見。否決原因：(a) 仍須改每支 endpoint 把 owner-only `.eq('user_id')` 放寬，工作量相當；(b) member INSERT 的 `with_check` 要允許寫 `user_id = ownerId`，policy 變複雜；(c) item user_id 不一致問題依舊。S1 更乾淨。

### 3.1 中央 helper `server/utils/routineAccess.ts`

```typescript
type AccessLevel = 'view' | 'edit' | 'owner';
interface RoutineAccess {
  userId: string;
  ownerId: string;
  role: 'owner' | 'member';
  permission: 'edit' | 'view'; // owner 恆 edit
}
// 失敗即 throw 404（查無排程）或 403（無權限）
async function assertRoutineAccess(event, routineId, required: AccessLevel): Promise<RoutineAccess>
```

判定邏輯（**內部用 service-key client**，因 user client 讀不到他人 routine）：
1. 取 `userId`（沿用 `user.id || user.sub` 固定寫法）。
2. **service key** 查 `routines` 取 `owner = user_id`。查無 → 404。
3. `userId === owner` → `{ role:'owner', permission:'edit' }`，通過任何 required。
4. 否則 **service key** 查 `routine_shares` where `routine_id, user_id=userId, status='active'`。無列 → 403。
5. 有列：`required='view'` 一律通過；`required='edit'` 需 `permission='edit'`，否則 403；`required='owner'` → 403（非擁有者）。
6. 回傳含 `ownerId`，供呼叫端對 routine_items 寫入時統一帶 `user_id = ownerId`（見 §3.0）。

> 符合專案「每 endpoint 自驗、不靠純 RLS」原則（CLAUDE.md）。RLS 僅作 defense-in-depth，不取代此檢查。

### 3.2 各 endpoint 套用層級

> 下表「required」走 `assertRoutineAccess`；通過後 **routine / routine_items 的實際讀寫一律 service-key client**（§3.0）。`user_active_routine`（自己那列）與 `routine_checkins`（自己的打卡）可續用 user client。

| Endpoint | required | 備註 |
|---|---|---|
| `GET routines/[id]` | view | service key 載 routine+items；orphan/products 處理見 §6；回傳加 `_access` |
| `PUT routines/[id]/meta` | edit | |
| `POST routines/update-order` | edit | body 內含 routineId |
| `POST routines/update-themes` | edit | |
| `POST routines/[id]/efficacy-recs` | edit | 產生建議＝改排程 |
| `PATCH routines/items/[id]/lock` | edit | 先由 item 反查 routine_id 再 assert |
| `DELETE routines/[id]` | **owner** | 僅擁有者可刪 |
| `GET routines/[id]/checkins` | view | 取 item ids（service key，依 routine_id）+ 打卡按**自己** `user_id` 過濾（user client，RLS 自然只回自己的） |
| `POST routines/checkins/toggle` | view | 先由 routine_item 反查 routine_id（service key）再 assert；寫 checkin 仍用 user client 帶自己 user_id（RLS 通過，補現存無檢查缺口） |
| `PUT routines/[id]/toggle-active` | view | 改為 upsert `user_active_routine`（見 §4） |
| `GET routines/active` | —（自身） | 讀 `user_active_routine` 再 assert view |
| `GET routines/list` | —（自身） | owned + shared（見 §5） |
| `POST routines/create` | — | 不變 |

### 3.4 RLS policies（`routine_shares`，defense-in-depth）
- SELECT：`user_id = auth.uid()`（協作者看自己的）OR `shared_by = auth.uid()`（owner 看自己分享出去的）。
- INSERT / UPDATE / DELETE：`shared_by = auth.uid()`（僅分享者能管理）。
- 跨用戶寫入（暫停時清他人 `user_active_routine`、email RPC）走 **service key**（`NUXT_SUPABASE_SECRET_KEY`），不受 RLS 限。

---

## 4. 「啟動」狀態 per-user 化

- **`PUT routines/[id]/toggle-active`** 改寫：
  - `is_active=true` → `assertRoutineAccess(view)` 通過後，對 `user_active_routine` **upsert**（`user_id=userId, routine_id=routineId`，user client，RLS 自己那列）。
  - `is_active=false` → 若該列 `routine_id === routineId` 則設 null。
  - 不再寫 `routines.is_active`。
- **`GET routines/active`** 改寫：
  - 讀 `user_active_routine`（自己那列，user client）取 `routine_id`；無列 / null → 回 `data:null`。
  - 否則 `assertRoutineAccess(view)`（防呆：指向已失效的共享排程時，把該列 routine_id 清 null 並回 `data:null`），再以 **service key** 載入 routine + items。
- 效果：協作者把共享排程設為啟動 → 自己每日視圖顯示該份；不影響擁有者與其他協作者的啟動選擇（各自一列，互不干涉）。

---

## 5. 列表整合（接收方看得到共享排程）

**`GET routines/list`** 回傳結構升級：

```jsonc
{
  "success": true,
  "data": [
    {
      "...routine 欄位...": "",
      "_share": null,                    // 自己擁有的
      "_is_active_for_me": true          // = (user_active_routine.routine_id === routine.id)
    },
    {
      "...routine 欄位...": "",
      "_share": {                        // 別人分享給我的
        "permission": "edit",
        "status": "active",
        "shared_by_email": "alice@x.com" // 顯示「誰分享的」
      },
      "_is_active_for_me": false
    }
  ]
}
```

實作：
1. 查自己 owned routines（現有邏輯）。
2. 查 `routine_shares` where `user_id=userId, status='active'` → 拿 `routine_id[]` + permission，再批次查對應 routines。
3. `shared_by_email`：用 service key 由 `shared_by` → `auth.users.email` 解出（或 §7 共用解析）。
4. 讀自己的 `user_active_routine.routine_id`，合併、標記 `_share` 與 `_is_active_for_me`。

前端 `pages/routines/active.vue`（列表頁）：共享項目顯示來源（「由 alice 分享」）+ 權限徽章（檢視／可編輯）+ 狀態。

---

## 6. 產品引用與 orphan（共享情境）

- `routine_items` 已**反正規化** `product_name` / `product_category` / `ingredients`，故**任何人都能正常顯示**項目內容，無需存取他人保養品櫃。
- `GET routines/[id]` 兩處需區分「誰的櫃」：
  - **orphan 偵測**：以 **owner 櫃 ∪ 當前檢視者 (viewer) 櫃** 為基準。`product_id` 存在於任一櫃即非孤兒。即查 `user_cabinet` where `user_id in (ownerId, viewerId)`（owner 自己看時兩者相同）。如此協作者剛從自己櫃加入的產品，自己看不會被誤標 orphan。
  - **新增產品挑選清單 `all_products`**：以 **檢視者 (viewer) 自己的櫃** 為基準（協作者只能加自己有的產品）。
- **殘留簡化（v1）**：協作者 C 看協作者 B 加入、且指向 B 私櫃的項目，仍可能標 orphan（不在 owner∪C 櫃）。顯示仍正常（靠反正規化欄位）。可接受，列為後續優化點。
- 成分衝突偵測（`conflicts_by_day`）：優先用 `item.ingredients` 反正規化陣列，故共享下仍正確；僅當 item 無 ingredients 而需回查櫃時，改查 owner 櫃。

---

## 7. Email 前綴搜尋

- **新 endpoint**：`GET /api/routines/share/search-users?q=<prefix>`
- **技術修正**：`auth.users` **無法經 PostgREST/supabase-js 直查**。改呼叫 §2.4 的 SECURITY DEFINER RPC `search_user_emails(prefix)`（server 端以 service key `rpc()` 呼叫）。
- 規則（護欄，於 app 層）：
  - `q` 需 **≥ 2 碼**，否則回空陣列（不呼 RPC）。
  - 結果**上限 8 筆**（RPC limit 20，app 再切 8）；回 `[{ user_id, email }]`。
  - 排除自己。
  - 加簡單 **rate limit**（沿用 `guest_rate_limits` 模式或記憶體計數），擋自動化枚舉。
  - （「限登入」天生成立：未登入無法建排程，不會進到分享 UI。）
- 隱私取捨：前綴搜尋便利性高，但理論上可被慢慢枚舉 email；對「朋友間小 app」風險可接受，以上限/門檻/rate limit 壓制。

> email 反解（`shared_by_email` 等）改用 RPC `get_user_emails(ids[])`。集中於一支服務檔（如 `server/utils/userEmails.ts`）管理 service-key RPC 呼叫。

---

## 8. 分享管理 endpoints（新增）

| Method | Path | 權限 | 行為 |
|---|---|---|---|
| GET | `routines/share/search-users?q=` | 登入 | §7 前綴搜尋 |
| GET | `routines/[id]/shares` | owner | 列出此排程所有分享列（協作者 email + permission + status） |
| POST | `routines/[id]/shares` | owner | body `{ target_user_id, permission }` → upsert `routine_shares`（status='active'）。不可分享給自己 |
| PATCH | `routines/[id]/shares/[shareId]` | owner | body `{ permission? , status? }`。改權限即時生效；`status='paused'` 時觸發 §9 清理 |
| DELETE | `routines/[id]/shares/[shareId]` | owner | 移除分享 + §9 清理 |

---

## 9. 暫停 / 再分享 / 移除 語意

採 **status 切換**（暫停不刪 row）：

| 動作 | 實作 | 協作者狀況 |
|---|---|---|
| **暫停** (`status='paused'`) | update 該列 status。**並用 service key**：`update user_active_routine set routine_id = null where user_id = <協作者> and routine_id = <routineId>` | `assertRoutineAccess` 立即擋下 → 排程從列表消失、不能再開。每日視圖若正指向它則退回無啟動（已被清 null） |
| **暫停期間編輯** | — | 不可能（無存取權） |
| **再分享** (`status='active'`) | update 該列 status | 重新可見。**過去編輯（同一筆記錄）與各自打卡紀錄都還在**，無縫接回。**不**自動恢復其 `user_active_routine`（避免每日視圖突然跳排程），由協作者自行重新點「啟動」 |
| **改權限 view↔edit** | update permission | 即時生效 |
| **移除** (DELETE) | 刪該列 + 同暫停的 `user_active_routine` 清理 | 同暫停效果；再分享需重新搜 email |
| **owner 刪整份排程** | `routines` 刪除 | FK CASCADE 清 `routine_shares`；`user_active_routine.routine_id` FK `ON DELETE SET NULL` 自動清各人啟動指標 |

---

## 10. 前端 UI

### 10.1 分享 Modal（`components/routine/ShareRoutineModal.vue`，新增）
- 入口：排程詳情頁（`pages/routines/[id].vue` / `RoutineHeader.vue`）「分享」按鈕（**非 emoji icon**，用 SVG/CSS 形狀，遵 CLAUDE.md）。
- 內容：
  1. 搜尋框：輸入 email（debounce，≥2 碼）→ 呼叫 `search-users` → autocomplete 下拉。
  2. 選定對象後，選權限：**檢視 / 可編輯**（單選）。
  3. 「分享」按鈕 → `POST shares`。
  4. 下方列出**已分享對象**（email + 權限徽章 + 狀態），每列含：改權限、暫停/恢復、移除。
- 樣式遵 `design.md` token；新元件優先 Tailwind，不開 `<style scoped>`。

### 10.2 列表頁（`pages/routines/active.vue`）
- 共享來的排程：顯示「由 {email} 分享」來源標籤 + 權限徽章（檢視／可編輯）。
- 「啟動」操作沿用既有 toggle-active（語意已改 per-user）。

### 10.3 編輯權限即時反映
- `GET routines/[id]` 回傳 `_access`。前端依 `permission`：
  - `view`：唯讀模式（隱藏拖拉、鎖定、新增、meta 編輯等寫入操作）。
  - `edit`：完整操作。

---

## 11. 受影響檔案清單

**Migration**：1 支（§2.4，含 routine_shares、user_active_routine、backfill、drop 舊 is_active partial index、2 支 email RPC + REVOKE/GRANT、RLS）。

**新增**：
- `server/utils/routineAccess.ts`（`assertRoutineAccess`，內部 service-key client）
- `server/utils/userEmails.ts`（`searchUserEmails` / `getUserEmails`，service-key RPC 封裝）
- `server/api/routines/share/search-users.get.ts`
- `server/api/routines/[id]/shares/index.get.ts`、`index.post.ts`
- `server/api/routines/[id]/shares/[shareId].patch.ts`、`[shareId].delete.ts`
- `components/routine/ShareRoutineModal.vue`

**修改（套 assertRoutineAccess + 共享資料改 service-key client / per-user active / 列表整合）**：
- `routines/[id].get.ts`、`[id].delete.ts`、`[id]/meta.put.ts`、`[id]/efficacy-recs.post.ts`、`[id]/toggle-active.put.ts`、`[id]/checkins.get.ts`
- `routines/items/[id]/lock.patch.ts`
- `routines/checkins/toggle.post.ts`、`routines/update-themes.post.ts`
- `routines/update-order.post.ts`（重點：第4步換 assertRoutineAccess(edit)、增改刪改 service key、item `user_id` 一律帶 `ownerId`，見 §3.0）
- `routines/active.get.ts`、`routines/list.get.ts`
- `pages/routines/[id].vue`、`pages/routines/active.vue`、`components/routine/RoutineHeader.vue`

---

## 12. 錯誤處理與邊界

- `assertRoutineAccess`：查無排程 404、無權限 403、未登入 401，statusMessage 中文。
- 分享給自己 → 400「不可分享給自己」。
- 對同一人重複分享 → upsert（更新權限），非報錯。
- email 搜尋 `q<2` → 回空陣列，不報錯。
- 每日視圖指向失效共享排程 → 自動清 null 並回 `data:null`，不爆錯。
- 暫停清理、email 解析等 service-key 操作失敗 → 500 並記 log，不靜默吞掉。

---

## 13. 測試重點（業務邏輯，非僅「有跑出結果」）

1. **權限隔離**：member(view) 打 edit endpoint → 403；非 member 打 view endpoint → 403；非 owner 打 delete/shares 管理 → 403。
2. **per-user 啟動**：A、B 共享同份，各自設啟動互不影響；各自 `GET active` 回各自選擇。
3. **打卡各自獨立**：A、B 對同一 item 同日打卡 → 兩筆、互看不到對方。
4. **暫停 → 每日視圖退回**：B 把共享排程設啟動，owner 暫停 → B 的 `user_active_routine.routine_id` 被清、`GET active` 回 null。
5. **再分享延續**：暫停再恢復後，B 仍見先前編輯與自己打卡紀錄。
6. **刪排程連鎖**：owner 刪排程 → shares 清空、各人 `user_active_routine.routine_id` 轉 null。
7. **email 前綴**：`q='al'` 回 alice；`q='a'`(1碼) 回空；結果不含自己、上限 8。
8. **orphan 基準**：共享排程對 member 顯示，owner 櫃內產品不被誤標 orphan；member 從自己櫃加入的產品，member 自己看也不被標 orphan（owner∪viewer 櫃）。
9. **email RPC 防枚舉**：以 anon/authenticated 角色直接 `rpc('search_user_emails')` 應被拒（僅 service_role 可執行）。
