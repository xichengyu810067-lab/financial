-- =============================================================================
-- 里程碑 8 PR B：資料庫寫入上限與權限收斂
--
--   1. 權限：anon 收回所有資料表／函式權限（含之後新建的預設權限）；authenticated 收回
--      TRUNCATE／REFERENCES／TRIGGER；觸發器函式不給任何角色直接呼叫。
--   2. 帳本與個人資料不能從 REST 新增或刪除（帳本由註冊 trigger 建立；多帳本之後另做）。
--   3. 文字與 jsonb 欄位長度上限（資料庫比前端寬一點，前端是 30／40／100 字）。
--   4. 每本帳本的筆數上限（statement 層級 trigger，一次批次寫入只檢查一次）。
--   5. 系統科目（期初餘額）不能自己建、改型別、刪除；每本帳本只有一個，而且一定是權益科目。
--   6. 待確認項目：確認入帳只能經由 confirm_inbox_item；處理過的項目不能再改。
--   7. entries.created_by 一律是寫入者本人，之後不能改。
--   8. confirm_inbox_item：最多拆 50 筆、金額最多兩位小數（避免四捨五入前後合計不一致）。
--   9. net_worth_by_month：日期區間最多 10 年。
--
-- 「只有 RPC 能做」的判斷：RPC 用 set_config(..., true) 設一個只在這個交易有效的旗標，
-- 觸發器看到旗標才放行。PostgREST 只開放 public schema 的函式，使用者沒辦法自己設這個旗標。
-- 觸發器只管 authenticated 角色；SECURITY DEFINER 函式（註冊建帳本）、service_role、
-- 刪除使用者時的 cascade 都不受影響。
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. 權限
-- -----------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;
revoke execute on all functions in schema public from public;
revoke truncate, references, trigger on all tables in schema public from authenticated;

-- 之後新建的表與函式也照這個預設（Supabase 預設會給 anon 全部權限）
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke all on functions from anon;
alter default privileges for role postgres in schema public revoke truncate, references, trigger on tables from authenticated;
alter default privileges for role postgres revoke execute on functions from public;

-- RLS policy 以登入者身分呼叫，要明確保留
grant execute on function public.is_ledger_owner(uuid) to authenticated;

-- 里程碑 7 的觸發器函式沒有收回權限（觸發器執行時不檢查 EXECUTE，收回不影響運作）
revoke execute on function public.validate_recurring_rule() from authenticated;
revoke execute on function public.validate_category_rule() from authenticated;
revoke execute on function public.validate_merchant() from authenticated;
revoke execute on function public.validate_inbox_item() from authenticated;

-- -----------------------------------------------------------------------------
-- 2. 帳本與個人資料：只能讀、改，不能從 REST 新增或刪除
-- -----------------------------------------------------------------------------
revoke insert, delete on public.ledgers, public.profiles from authenticated;

drop policy "ledgers: 擁有者" on public.ledgers;
create policy "ledgers: 擁有者讀取" on public.ledgers
  for select to authenticated
  using (owner_id = (select auth.uid()));
create policy "ledgers: 擁有者修改" on public.ledgers
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy "profiles: 本人" on public.profiles;
create policy "profiles: 本人讀取" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));
create policy "profiles: 本人修改" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- 3. 長度上限（2026-11-20 已確認正式資料都沒有超過）
-- -----------------------------------------------------------------------------
alter table public.profiles
  add constraint profiles_display_name_length check (display_name is null or char_length(display_name) <= 60),
  add constraint profiles_slogan_length check (slogan is null or char_length(slogan) <= 60);

alter table public.ledgers
  add constraint ledgers_name_length check (char_length(trim(name)) between 1 and 50),
  add constraint ledgers_cover_color_length check (cover_color is null or char_length(cover_color) <= 30),
  add constraint ledgers_cover_material_length check (cover_material is null or char_length(cover_material) <= 20);

alter table public.accounts
  add constraint accounts_name_length check (char_length(trim(name)) between 1 and 50),
  add constraint accounts_subtype_length check (subtype is null or char_length(subtype) <= 30),
  add constraint accounts_icon_length check (icon is null or char_length(icon) <= 40),
  add constraint accounts_color_length check (color is null or char_length(color) <= 30),
  add constraint accounts_system_is_equity check (not is_system or type = 'equity');
create unique index accounts_one_system_per_ledger on public.accounts (ledger_id) where is_system;

alter table public.entries
  add constraint entries_memo_length check (memo is null or char_length(memo) <= 200),
  add constraint entries_invoice_no_format check (invoice_no is null or invoice_no ~ '^[A-Z]{2}[0-9]{8}$');

alter table public.goals
  add constraint goals_name_length check (char_length(trim(name)) between 1 and 50),
  add constraint goals_note_length check (note is null or char_length(note) <= 200);

alter table public.goal_deposits
  add constraint goal_deposits_note_length check (note is null or char_length(note) <= 200);

alter table public.merchants
  add constraint merchants_key_length check (char_length(merchant_key) between 1 and 200),
  add constraint merchants_name_length check (name is null or char_length(name) <= 200),
  add constraint merchants_seller_ban_format check (seller_ban is null or seller_ban ~ '^[0-9]{8}$');

alter table public.inbox_items
  add constraint inbox_items_merchant_name_length check (merchant_name is null or char_length(merchant_name) <= 200),
  add constraint inbox_items_items_size check (jsonb_array_length(items) <= 500 and octet_length(items::text) <= 65536);

-- -----------------------------------------------------------------------------
-- 4. 每本帳本的筆數上限
--   tg_argv[0] = 上限、tg_argv[1] = 給使用者看的名稱。只檢查這次寫入動到的帳本。
--   以登入者身分計數（RLS 下看得到的就是自己帳本的全部列）。
-- -----------------------------------------------------------------------------
create or replace function public.enforce_ledger_row_cap()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_max integer := tg_argv[0]::integer;
  v_ledger uuid;
begin
  execute format(
    'select t.ledger_id from public.%I t
      where t.ledger_id in (select distinct i.ledger_id from inserted i)
      group by t.ledger_id
     having count(*) > $1
      limit 1', tg_table_name)
    into v_ledger
    using v_max;
  if v_ledger is not null then
    raise exception '超過上限：每本帳本最多 % 筆%', v_max, tg_argv[1] using errcode = '54000';
  end if;
  return null;
end;
$$;
revoke execute on function public.enforce_ledger_row_cap() from public, anon, authenticated;

-- 以重度使用估算：每天 20 筆記 10 年約 7 萬筆交易；全部上限加起來單一帳本約 100 MB 內
create trigger accounts_row_cap after insert on public.accounts
  referencing new table as inserted for each statement execute function public.enforce_ledger_row_cap('300', '科目');
create trigger entries_row_cap after insert on public.entries
  referencing new table as inserted for each statement execute function public.enforce_ledger_row_cap('100000', '交易');
create trigger entry_lines_row_cap after insert on public.entry_lines
  referencing new table as inserted for each statement execute function public.enforce_ledger_row_cap('300000', '分錄');
create trigger budgets_row_cap after insert on public.budgets
  referencing new table as inserted for each statement execute function public.enforce_ledger_row_cap('5000', '預算');
create trigger goals_row_cap after insert on public.goals
  referencing new table as inserted for each statement execute function public.enforce_ledger_row_cap('100', '目標');
create trigger goal_deposits_row_cap after insert on public.goal_deposits
  referencing new table as inserted for each statement execute function public.enforce_ledger_row_cap('10000', '存入紀錄');
create trigger recurring_rules_row_cap after insert on public.recurring_rules
  referencing new table as inserted for each statement execute function public.enforce_ledger_row_cap('100', '固定支出');
create trigger category_rules_row_cap after insert on public.category_rules
  referencing new table as inserted for each statement execute function public.enforce_ledger_row_cap('200', '自動分類規則');
create trigger merchants_row_cap after insert on public.merchants
  referencing new table as inserted for each statement execute function public.enforce_ledger_row_cap('5000', '店家記憶');
create trigger inbox_items_row_cap after insert on public.inbox_items
  referencing new table as inserted for each statement execute function public.enforce_ledger_row_cap('20000', '待確認項目');

-- -----------------------------------------------------------------------------
-- 5. 系統科目（期初餘額）：不能自己建、改型別或層級、刪除。還原備份時放行。
-- -----------------------------------------------------------------------------
create or replace function public.guard_system_account()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user <> 'authenticated' or current_setting('app.restoring_ledger', true) = 'on' then
    return coalesce(new, old);
  end if;
  if tg_op = 'INSERT' and new.is_system then
    raise exception '系統科目由系統建立，不能自己新增' using errcode = '42501';
  elsif tg_op = 'UPDATE' and (
          new.is_system is distinct from old.is_system
          or (old.is_system and (new.type, new.subtype, new.parent_id, new.ledger_id)
                                is distinct from (old.type, old.subtype, old.parent_id, old.ledger_id))) then
    raise exception '系統科目不能修改型別或層級' using errcode = '42501';
  elsif tg_op = 'DELETE' and old.is_system then
    raise exception '系統科目不能刪除' using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;
revoke execute on function public.guard_system_account() from public, anon, authenticated;

create trigger accounts_guard_system
  before insert or update or delete on public.accounts
  for each row execute function public.guard_system_account();

-- -----------------------------------------------------------------------------
-- 6. 待確認項目：新項目一定是未處理；確認入帳只能經由 confirm_inbox_item；
--    處理過（已確認／已略過）的項目不能再改；來源相關欄位建立後不能改。
--    前端的「略過」（pending → dismissed）照舊直接更新。
-- -----------------------------------------------------------------------------
create or replace function public.guard_inbox_item()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user <> 'authenticated' or current_setting('app.confirming_inbox', true) = 'on' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.status <> 'pending' or cardinality(new.entry_ids) > 0 or new.resolved_at is not null then
      raise exception '新的待確認項目必須是未處理狀態' using errcode = '42501';
    end if;
  else
    if old.status <> 'pending' then
      raise exception '這筆已經處理過了，不能再修改' using errcode = '42501';
    end if;
    if new.status = 'confirmed' or new.entry_ids is distinct from old.entry_ids then
      raise exception '確認入帳請從待確認匣操作' using errcode = '42501';
    end if;
    if (new.ledger_id, new.source, new.invoice_no, new.recurring_rule_id, new.due_date)
       is distinct from (old.ledger_id, old.source, old.invoice_no, old.recurring_rule_id, old.due_date) then
      raise exception '待確認項目的來源不能修改' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.guard_inbox_item() from public, anon, authenticated;

create trigger inbox_items_guard
  before insert or update on public.inbox_items
  for each row execute function public.guard_inbox_item();

-- -----------------------------------------------------------------------------
-- 7. entries.created_by：新增時一律是寫入者本人，之後不能改
-- -----------------------------------------------------------------------------
create or replace function public.set_entry_created_by()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    new.created_by := old.created_by;
  elsif (select auth.uid()) is not null then
    new.created_by := (select auth.uid());
  end if;
  return new;
end;
$$;
revoke execute on function public.set_entry_created_by() from public, anon, authenticated;

create trigger entries_set_created_by
  before insert or update on public.entries
  for each row execute function public.set_entry_created_by();

-- -----------------------------------------------------------------------------
-- 8. confirm_inbox_item：最多拆 50 筆、金額最多兩位小數；確認時設旗標讓 6. 放行
--    （其餘與里程碑 7 相同）
-- -----------------------------------------------------------------------------
create or replace function public.confirm_inbox_item(p_item uuid, p_entry jsonb)
returns uuid[]
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_item public.inbox_items%rowtype;
  v_date date;
  v_from uuid := nullif(p_entry ->> 'from_account_id', '')::uuid;
  v_to uuid := nullif(p_entry ->> 'to_account_id', '')::uuid;
  v_splits jsonb := p_entry -> 'splits';
  v_split jsonb;
  v_amount numeric;
  v_cat uuid;
  v_first_cat uuid;
  v_total numeric := 0;
  v_lines jsonb;
  v_id uuid;
  v_ids uuid[] := '{}';
begin
  select * into v_item from public.inbox_items where id = p_item for update;
  if not found then
    raise exception '找不到待確認項目' using errcode = 'P0002';
  end if;
  if v_item.status <> 'pending' then
    raise exception '這筆已經處理過了' using errcode = '22023';
  end if;
  v_date := coalesce(nullif(p_entry ->> 'entry_date', '')::date, v_item.entry_date);

  if jsonb_typeof(v_splits) is distinct from 'array' or jsonb_array_length(v_splits) = 0 then
    raise exception '至少要有一筆' using errcode = '22023';
  end if;
  if jsonb_array_length(v_splits) > 50 then
    raise exception '最多拆成 50 筆' using errcode = '22023';
  end if;
  if v_item.kind = 'transfer' and jsonb_array_length(v_splits) <> 1 then
    raise exception '轉帳不能拆成多筆' using errcode = '22023';
  end if;
  if v_item.kind in ('expense', 'transfer') and v_from is null then
    raise exception '請選擇付款帳戶' using errcode = '22023';
  end if;
  if v_item.kind in ('income', 'transfer') and v_to is null then
    raise exception '請選擇存入帳戶' using errcode = '22023';
  end if;

  for v_split in select * from jsonb_array_elements(v_splits) loop
    v_amount := nullif(v_split ->> 'amount', '')::numeric;
    if v_amount is null or v_amount <= 0 then
      raise exception '每一筆的金額都要大於 0' using errcode = '22023';
    end if;
    if v_amount <> round(v_amount, 2) then
      raise exception '金額最多到小數點後兩位' using errcode = '22023';
    end if;
    if v_item.kind <> 'transfer' and nullif(v_split ->> 'category_id', '') is null then
      raise exception '每一筆都要選類別' using errcode = '22023';
    end if;
    v_total := v_total + v_amount;
  end loop;
  if v_item.source <> 'recurring' and v_total <> v_item.amount then
    raise exception '拆開的金額合計 % 要等於發票金額 %', v_total, v_item.amount using errcode = '22023';
  end if;

  for v_split in select * from jsonb_array_elements(v_splits) loop
    v_amount := (v_split ->> 'amount')::numeric;
    v_cat := nullif(v_split ->> 'category_id', '')::uuid;
    v_first_cat := coalesce(v_first_cat, v_cat);
    v_lines := case v_item.kind
      when 'expense' then jsonb_build_array(
        jsonb_build_object('account_id', v_cat, 'debit', v_amount, 'credit', 0),
        jsonb_build_object('account_id', v_from, 'debit', 0, 'credit', v_amount))
      when 'income' then jsonb_build_array(
        jsonb_build_object('account_id', v_to, 'debit', v_amount, 'credit', 0),
        jsonb_build_object('account_id', v_cat, 'debit', 0, 'credit', v_amount))
      else jsonb_build_array(
        jsonb_build_object('account_id', v_to, 'debit', v_amount, 'credit', 0),
        jsonb_build_object('account_id', v_from, 'debit', 0, 'credit', v_amount))
    end;
    v_id := public.save_entry(
      jsonb_build_object(
        'ledger_id', v_item.ledger_id,
        'kind', v_item.kind,
        'entry_date', v_date,
        'amount', v_amount,
        'from_account_id', case when v_item.kind in ('expense', 'transfer') then v_from end,
        'to_account_id', case when v_item.kind in ('income', 'transfer') then v_to end,
        'category_id', case when v_item.kind <> 'transfer' then v_cat end,
        'memo', coalesce(nullif(trim(v_split ->> 'memo'), ''), v_item.memo)),
      v_lines);
    if v_item.invoice_no is not null then
      update public.entries set invoice_no = v_item.invoice_no where id = v_id;
    end if;
    v_ids := v_ids || v_id;
  end loop;

  perform set_config('app.confirming_inbox', 'on', true);
  update public.inbox_items
     set status = 'confirmed', entry_ids = v_ids, resolved_at = now(), entry_date = v_date, amount = v_total,
         from_account_id = v_from, to_account_id = v_to, category_id = v_first_cat
   where id = p_item;
  perform set_config('app.confirming_inbox', '', true);

  if public.merchant_key(v_item.merchant_name, v_item.seller_ban) is not null then
    insert into public.merchants as m (ledger_id, merchant_key, name, seller_ban, last_category_id, last_account_id, updated_at)
    values (v_item.ledger_id, public.merchant_key(v_item.merchant_name, v_item.seller_ban), v_item.merchant_name, v_item.seller_ban,
            v_first_cat, coalesce(v_from, v_to), now())
    on conflict (ledger_id, merchant_key) do update
      set name = coalesce(excluded.name, m.name),
          seller_ban = coalesce(excluded.seller_ban, m.seller_ban),
          last_category_id = excluded.last_category_id,
          last_account_id = excluded.last_account_id,
          updated_at = now();
  end if;

  return v_ids;
end;
$$;
revoke execute on function public.confirm_inbox_item(uuid, jsonb) from public, anon;
grant execute on function public.confirm_inbox_item(uuid, jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- restore_ledger：清空與重建時設旗標，讓 5. 放行系統科目的刪除與重建（其餘與里程碑 7 相同）
-- 筆數上限由 4. 的 trigger 把關
-- -----------------------------------------------------------------------------
create or replace function public.restore_ledger(p_ledger uuid, p_data jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_ledger   jsonb := p_data -> 'ledger';
  v_accounts jsonb := coalesce(p_data -> 'accounts', '[]');
  v_entries  jsonb := coalesce(p_data -> 'entries', '[]');
  v_lines    jsonb := coalesce(p_data -> 'entry_lines', '[]');
  v_budgets  jsonb := coalesce(p_data -> 'budgets', '[]');
  v_goals    jsonb := coalesce(p_data -> 'goals', '[]');
  v_deposits jsonb := coalesce(p_data -> 'goal_deposits', '[]');
  v_recurring jsonb := coalesce(p_data -> 'recurring_rules', '[]');
  v_crules   jsonb := coalesce(p_data -> 'category_rules', '[]');
  v_acc_map  jsonb;
  v_ent_map  jsonb;
  v_goal_map jsonb;
begin
  if (select auth.uid()) is null then
    raise exception '需要登入' using errcode = '42501';
  end if;
  if not public.is_ledger_owner(p_ledger) then
    raise exception '找不到這本帳本' using errcode = '42501';
  end if;
  if p_data ->> 'app' is distinct from 'financial' or p_data ->> 'version' is distinct from '1' then
    raise exception '這不是本 App 的備份檔，或備份版本不支援' using errcode = '22023';
  end if;
  if jsonb_typeof(v_ledger) is distinct from 'object'
     or jsonb_typeof(v_accounts) <> 'array' or jsonb_typeof(v_entries) <> 'array' or jsonb_typeof(v_lines) <> 'array'
     or jsonb_typeof(v_budgets) <> 'array' or jsonb_typeof(v_goals) <> 'array' or jsonb_typeof(v_deposits) <> 'array'
     or jsonb_typeof(v_recurring) <> 'array' or jsonb_typeof(v_crules) <> 'array' then
    raise exception '備份檔格式不正確' using errcode = '22023';
  end if;

  -- 舊 id → 新 id
  select coalesce(jsonb_object_agg(a ->> 'id', gen_random_uuid()), '{}') into v_acc_map from jsonb_array_elements(v_accounts) a;
  select coalesce(jsonb_object_agg(e ->> 'id', gen_random_uuid()), '{}') into v_ent_map from jsonb_array_elements(v_entries) e;
  select coalesce(jsonb_object_agg(g ->> 'id', gen_random_uuid()), '{}') into v_goal_map from jsonb_array_elements(v_goals) g;

  if jsonb_array_length(v_accounts) <> (select count(*) from jsonb_object_keys(v_acc_map))
     or jsonb_array_length(v_entries) <> (select count(*) from jsonb_object_keys(v_ent_map))
     or jsonb_array_length(v_goals) <> (select count(*) from jsonb_object_keys(v_goal_map)) then
    raise exception '備份檔裡有重複或缺少的 id' using errcode = '22023';
  end if;

  -- 所有參照都要找得到
  if exists (select 1 from jsonb_array_elements(v_accounts) a where a ->> 'parent_id' is not null and not v_acc_map ? (a ->> 'parent_id'))
     or exists (select 1 from jsonb_array_elements(v_entries) e
                 where (e ->> 'from_account_id' is not null and not v_acc_map ? (e ->> 'from_account_id'))
                    or (e ->> 'to_account_id' is not null and not v_acc_map ? (e ->> 'to_account_id'))
                    or (e ->> 'category_id' is not null and not v_acc_map ? (e ->> 'category_id')))
     or exists (select 1 from jsonb_array_elements(v_lines) l
                 where not v_ent_map ? coalesce(l ->> 'entry_id', '') or not v_acc_map ? coalesce(l ->> 'account_id', ''))
     or exists (select 1 from jsonb_array_elements(v_budgets) b where not v_acc_map ? coalesce(b ->> 'category_id', ''))
     or exists (select 1 from jsonb_array_elements(v_goals) g where g ->> 'account_id' is not null and not v_acc_map ? (g ->> 'account_id'))
     or exists (select 1 from jsonb_array_elements(v_deposits) d where not v_goal_map ? coalesce(d ->> 'goal_id', ''))
     or exists (select 1 from jsonb_array_elements(v_recurring) r
                 where (r ->> 'from_account_id' is not null and not v_acc_map ? (r ->> 'from_account_id'))
                    or (r ->> 'to_account_id' is not null and not v_acc_map ? (r ->> 'to_account_id'))
                    or (r ->> 'category_id' is not null and not v_acc_map ? (r ->> 'category_id')))
     or exists (select 1 from jsonb_array_elements(v_crules) c
                 where not v_acc_map ? coalesce(c ->> 'category_id', '')
                    or (c ->> 'account_id' is not null and not v_acc_map ? (c ->> 'account_id'))) then
    raise exception '備份檔的參照不完整（有交易、預算或目標指到不存在的科目）' using errcode = '22023';
  end if;

  -- 以下會刪除並重建系統科目；只在這個函式裡放行
  perform set_config('app.restoring_ledger', 'on', true);

  -- 清掉目前帳本（分錄隨交易一起刪；子類別先刪，父類別才刪得掉）
  delete from public.inbox_items where ledger_id = p_ledger;
  delete from public.merchants where ledger_id = p_ledger;
  delete from public.category_rules where ledger_id = p_ledger;
  delete from public.recurring_rules where ledger_id = p_ledger;
  delete from public.goal_deposits where ledger_id = p_ledger;
  delete from public.goals where ledger_id = p_ledger;
  delete from public.budgets where ledger_id = p_ledger;
  delete from public.entries where ledger_id = p_ledger;
  delete from public.accounts where ledger_id = p_ledger and parent_id is not null;
  delete from public.accounts where ledger_id = p_ledger;

  -- 帳本設定（先改起始日，此時還沒有期初交易，不會觸發日期同步）
  update public.ledgers
     set name = coalesce(nullif(trim(v_ledger ->> 'name'), ''), name),
         start_date = coalesce((v_ledger ->> 'start_date')::date, start_date),
         cover_color = v_ledger ->> 'cover_color',
         cover_material = v_ledger ->> 'cover_material',
         monthly_spending_limit = (v_ledger ->> 'monthly_spending_limit')::numeric
   where id = p_ledger;

  -- 科目：先父後子
  insert into public.accounts (id, ledger_id, name, type, subtype, icon, color, is_system, is_archived, sort_order, parent_id, monthly_budget, created_at)
  select (v_acc_map ->> (a ->> 'id'))::uuid, p_ledger, a ->> 'name', (a ->> 'type')::public.account_type, a ->> 'subtype', a ->> 'icon', a ->> 'color',
         coalesce((a ->> 'is_system')::boolean, false), coalesce((a ->> 'is_archived')::boolean, false), coalesce((a ->> 'sort_order')::integer, 0),
         null, (a ->> 'monthly_budget')::numeric, coalesce((a ->> 'created_at')::timestamptz, now())
    from jsonb_array_elements(v_accounts) a
   where a ->> 'parent_id' is null;

  insert into public.accounts (id, ledger_id, name, type, subtype, icon, color, is_system, is_archived, sort_order, parent_id, monthly_budget, created_at)
  select (v_acc_map ->> (a ->> 'id'))::uuid, p_ledger, a ->> 'name', (a ->> 'type')::public.account_type, a ->> 'subtype', a ->> 'icon', a ->> 'color',
         coalesce((a ->> 'is_system')::boolean, false), coalesce((a ->> 'is_archived')::boolean, false), coalesce((a ->> 'sort_order')::integer, 0),
         (v_acc_map ->> (a ->> 'parent_id'))::uuid, (a ->> 'monthly_budget')::numeric, coalesce((a ->> 'created_at')::timestamptz, now())
    from jsonb_array_elements(v_accounts) a
   where a ->> 'parent_id' is not null;

  perform set_config('app.restoring_ledger', '', true);

  -- 交易與分錄
  insert into public.entries (id, ledger_id, kind, entry_date, amount, from_account_id, to_account_id, category_id, memo, created_at, updated_at)
  select (v_ent_map ->> (e ->> 'id'))::uuid, p_ledger, (e ->> 'kind')::public.entry_kind, (e ->> 'entry_date')::date, (e ->> 'amount')::numeric,
         (v_acc_map ->> (e ->> 'from_account_id'))::uuid, (v_acc_map ->> (e ->> 'to_account_id'))::uuid, (v_acc_map ->> (e ->> 'category_id'))::uuid,
         e ->> 'memo', coalesce((e ->> 'created_at')::timestamptz, now()), coalesce((e ->> 'updated_at')::timestamptz, now())
    from jsonb_array_elements(v_entries) e;

  insert into public.entry_lines (entry_id, ledger_id, account_id, debit, credit)
  select (v_ent_map ->> (l ->> 'entry_id'))::uuid, p_ledger, (v_acc_map ->> (l ->> 'account_id'))::uuid,
         coalesce((l ->> 'debit')::numeric, 0), coalesce((l ->> 'credit')::numeric, 0)
    from jsonb_array_elements(v_lines) l;

  -- 預算、目標、存入
  insert into public.budgets (ledger_id, category_id, month, amount, created_at)
  select p_ledger, (v_acc_map ->> (b ->> 'category_id'))::uuid, (b ->> 'month')::date, (b ->> 'amount')::numeric, coalesce((b ->> 'created_at')::timestamptz, now())
    from jsonb_array_elements(v_budgets) b;

  insert into public.goals (id, ledger_id, name, target_amount, target_date, account_id, note, is_archived, achieved_at, sort_order, created_at)
  select (v_goal_map ->> (g ->> 'id'))::uuid, p_ledger, g ->> 'name', (g ->> 'target_amount')::numeric, (g ->> 'target_date')::date,
         (v_acc_map ->> (g ->> 'account_id'))::uuid, g ->> 'note', coalesce((g ->> 'is_archived')::boolean, false), (g ->> 'achieved_at')::date,
         coalesce((g ->> 'sort_order')::integer, 0), coalesce((g ->> 'created_at')::timestamptz, now())
    from jsonb_array_elements(v_goals) g;

  insert into public.goal_deposits (ledger_id, goal_id, amount, deposit_date, note, created_at)
  select p_ledger, (v_goal_map ->> (d ->> 'goal_id'))::uuid, (d ->> 'amount')::numeric, (d ->> 'deposit_date')::date, d ->> 'note',
         coalesce((d ->> 'created_at')::timestamptz, now())
    from jsonb_array_elements(v_deposits) d;

  -- 固定支出與自動分類規則（里程碑 7；舊備份沒有這兩項就是空的）
  insert into public.recurring_rules
    (ledger_id, name, kind, amount, amount_varies, from_account_id, to_account_id, category_id, memo,
     frequency, day_of_month, weekday, month_of_year, next_date, is_active, created_at)
  select p_ledger, r ->> 'name', (r ->> 'kind')::public.entry_kind, (r ->> 'amount')::numeric, coalesce((r ->> 'amount_varies')::boolean, false),
         (v_acc_map ->> (r ->> 'from_account_id'))::uuid, (v_acc_map ->> (r ->> 'to_account_id'))::uuid, (v_acc_map ->> (r ->> 'category_id'))::uuid,
         r ->> 'memo', r ->> 'frequency', (r ->> 'day_of_month')::integer, (r ->> 'weekday')::integer, (r ->> 'month_of_year')::integer,
         (r ->> 'next_date')::date, coalesce((r ->> 'is_active')::boolean, true), coalesce((r ->> 'created_at')::timestamptz, now())
    from jsonb_array_elements(v_recurring) r;

  insert into public.category_rules (ledger_id, pattern, category_id, account_id, sort_order, created_at)
  select p_ledger, c ->> 'pattern', (v_acc_map ->> (c ->> 'category_id'))::uuid, (v_acc_map ->> (c ->> 'account_id'))::uuid,
         coalesce((c ->> 'sort_order')::integer, 0), coalesce((c ->> 'created_at')::timestamptz, now())
    from jsonb_array_elements(v_crules) c;

  return jsonb_build_object(
    'accounts', jsonb_array_length(v_accounts),
    'entries', jsonb_array_length(v_entries),
    'entry_lines', jsonb_array_length(v_lines),
    'budgets', jsonb_array_length(v_budgets),
    'goals', jsonb_array_length(v_goals),
    'goal_deposits', jsonb_array_length(v_deposits),
    'recurring_rules', jsonb_array_length(v_recurring),
    'category_rules', jsonb_array_length(v_crules)
  );
end;
$$;
revoke execute on function public.restore_ledger(uuid, jsonb) from public, anon;
grant execute on function public.restore_ledger(uuid, jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- 9. net_worth_by_month：日期區間最多 10 年（前端只查 12 個月），避免拿來空耗 CPU
-- -----------------------------------------------------------------------------
create or replace function public.net_worth_by_month(p_ledger uuid, p_from date, p_to date)
returns table (month text, net_worth numeric)
language plpgsql
stable
security invoker
set search_path = ''
as $$
#variable_conflict use_column
begin
  if p_from is null or p_to is null or p_from > p_to then
    raise exception '日期區間不正確' using errcode = '22023';
  end if;
  if p_to - p_from > 3660 then
    raise exception '淨值走勢最多查 10 年' using errcode = '22023';
  end if;

  return query
  with months as (
    select generate_series(date_trunc('month', p_from)::date, date_trunc('month', p_to)::date, interval '1 month')::date as month_start
  ),
  ends as (
    select m.month_start, (m.month_start + interval '1 month' - interval '1 day')::date as month_end from months m
  ),
  balances as (
    select e.entry_date,
           case when a.type in ('asset', 'liability') then l.debit - l.credit else 0 end as delta
      from public.entry_lines l
      join public.entries e on e.id = l.entry_id
      join public.accounts a on a.id = l.account_id
     where l.ledger_id = p_ledger
       and a.type in ('asset', 'liability')
  )
  select to_char(ends.month_start, 'YYYY-MM'),
         coalesce(sum(b.delta), 0)::numeric(14, 2)
    from ends
    left join balances b on b.entry_date <= ends.month_end
   group by ends.month_start
   order by ends.month_start;
end;
$$;
revoke execute on function public.net_worth_by_month(uuid, date, date) from public, anon;
grant execute on function public.net_worth_by_month(uuid, date, date) to authenticated;
