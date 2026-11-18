-- 里程碑 7 PR A：備份還原：一併清掉待確認匣、店家記憶、規則與固定支出；備份裡有固定支出與規則就一起還原
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

