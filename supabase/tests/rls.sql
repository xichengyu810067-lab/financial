-- =============================================================================
-- RLS 與函式權限測試（里程碑 6）
--
-- 在單一 DO 區塊裡建立兩位測試使用者（各自由註冊 trigger 得到一本帳本）與 u1 的資料，
-- 然後以 u2、anon 的身分逐一確認：讀不到、改不了、刪不掉、寫不進別人的帳本、
-- 也不能把自己的資料掛到別人的科目上。全部通過時以 `ALL_OK` 例外結束，整個區塊回滾，
-- 不會留下任何資料；任何一項失敗就丟出以 FAIL 開頭的訊息。
--
-- 里程碑 8 加上：
--   * 目錄檢查：public 的表都開 RLS 且有 policy、檢視是 security_invoker、函式都固定 search_path、
--     anon 沒有任何表或函式權限、觸發器與 SECURITY DEFINER 函式不能被登入者直接呼叫。
--   * 自己的帳本也做不到的事：從 REST 新增／刪除帳本與個人資料、把資料搬到別人的帳本（with check）、
--     動系統科目、繞過 confirm_inbox_item 確認入帳、改已處理的項目、偽造 created_by、
--     拆分超過兩位小數或 50 筆、超過筆數與長度上限、淨值走勢查超過 10 年。
--   * anon 對每張表的新增、修改、刪除都被擋。
--
-- 執行（本機 Supabase 或 CI）：
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls.sql 2>&1 | tee rls.out
--   grep -q 'ALL_OK' rls.out
-- =============================================================================
do $$
declare
  u1 uuid := gen_random_uuid();
  u2 uuid := gen_random_uuid();
  l1 uuid; l2 uuid;
  cash1 uuid; food1 uuid; cash2 uuid; food2 uuid;
  e1 uuid; g1 uuid; r1 uuid; i1 uuid;
  month_start date := date_trunc('month', current_date)::date;
  t text; stmt text; n bigint; amount numeric;
  tables text[] := array['ledgers', 'accounts', 'entries', 'entry_lines', 'budgets', 'goals', 'goal_deposits',
                          'recurring_rules', 'category_rules', 'merchants', 'inbox_items'];
  checked int := 0;
  -- 里程碑 8：u2 自己的資料
  e2 uuid; g2 uuid; i2 uuid; i3 uuid; uid uuid;
  pair text[];
begin
  -- ---------------------------------------------------------------------------
  -- 目錄檢查（里程碑 8）：之後新增的表或函式忘了開 RLS、固定 search_path、收回 anon 權限，
  -- 這裡就會失敗。只看 public schema、排除 extension 帶進來的物件。
  -- ---------------------------------------------------------------------------
  select string_agg(c.relname, ', ') into t
    from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
   where ns.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity;
  if t is not null then raise exception 'FAIL 沒有開 RLS 的表：%', t; end if;

  select string_agg(c.relname, ', ') into t
    from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
   where ns.nspname = 'public' and c.relkind in ('r', 'p')
     and not exists (select 1 from pg_policy pol where pol.polrelid = c.oid);
  if t is not null then raise exception 'FAIL 開了 RLS 卻沒有任何 policy 的表：%', t; end if;

  select string_agg(c.relname, ', ') into t
    from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
   where ns.nspname = 'public' and c.relkind in ('v', 'm')
     and not coalesce(c.reloptions && array['security_invoker=true', 'security_invoker=on'], false);
  if t is not null then raise exception 'FAIL 不是 security_invoker 的檢視：%', t; end if;

  select string_agg(p.oid::regprocedure::text, ', ') into t
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public'
     and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
     and not coalesce(exists (select 1 from unnest(p.proconfig) cfg where cfg like 'search_path=%'), false);
  if t is not null then raise exception 'FAIL 沒有固定 search_path 的函式：%', t; end if;

  select string_agg(p.oid::regprocedure::text, ', ') into t
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public'
     and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
     and has_function_privilege('anon', p.oid, 'execute');
  if t is not null then raise exception 'FAIL anon 可以呼叫的函式：%', t; end if;

  select string_agg(p.oid::regprocedure::text, ', ') into t
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public'
     and (p.prorettype = 'trigger'::regtype or p.prosecdef)
     and has_function_privilege('authenticated', p.oid, 'execute');
  if t is not null then raise exception 'FAIL 登入者可以直接呼叫的觸發器或 SECURITY DEFINER 函式：%', t; end if;

  select string_agg(c.relname, ', ') into t
    from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
   where ns.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm')
     and has_table_privilege('anon', c.oid, 'select, insert, update, delete, truncate, references, trigger');
  if t is not null then raise exception 'FAIL anon 有權限的表：%', t; end if;

  select string_agg(c.relname, ', ') into t
    from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
   where ns.nspname = 'public' and c.relkind in ('r', 'p')
     and has_table_privilege('authenticated', c.oid, 'truncate, references, trigger');
  if t is not null then raise exception 'FAIL 登入者有 TRUNCATE／REFERENCES／TRIGGER 的表：%', t; end if;

  if has_table_privilege('authenticated', 'public.ledgers', 'insert, delete')
     or has_table_privilege('authenticated', 'public.profiles', 'insert, delete') then
    raise exception 'FAIL 登入者可以直接新增或刪除帳本／個人資料';
  end if;
  checked := checked + 9;

  -- ---------------------------------------------------------------------------
  -- 準備：兩位使用者（trigger 建 profile 與帳本），u1 有交易、預算、目標、存入
  -- ---------------------------------------------------------------------------
  insert into auth.users (id, email, instance_id, aud, role)
  values (u1, 'rls-test-1@example.invalid', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
         (u2, 'rls-test-2@example.invalid', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

  select id into l1 from public.ledgers where owner_id = u1;
  select id into l2 from public.ledgers where owner_id = u2;
  if l1 is null or l2 is null then raise exception 'FAIL 註冊 trigger 沒有建立帳本'; end if;

  select id into cash1 from public.accounts where ledger_id = l1 and type = 'asset' order by sort_order limit 1;
  select id into food1 from public.accounts where ledger_id = l1 and type = 'expense' order by sort_order limit 1;
  select id into cash2 from public.accounts where ledger_id = l2 and type = 'asset' order by sort_order limit 1;
  select id into food2 from public.accounts where ledger_id = l2 and type = 'expense' order by sort_order limit 1;

  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  e1 := public.save_entry(
    json_build_object('ledger_id', l1, 'kind', 'expense', 'entry_date', current_date, 'amount', 120,
                      'from_account_id', cash1, 'category_id', food1)::jsonb,
    json_build_array(json_build_object('account_id', food1, 'debit', 120, 'credit', 0),
                     json_build_object('account_id', cash1, 'debit', 0, 'credit', 120))::jsonb);
  insert into public.budgets (ledger_id, category_id, month, amount) values (l1, food1, month_start, 500);
  insert into public.goals (ledger_id, name, target_amount) values (l1, '手動目標', 1000) returning id into g1;
  insert into public.goal_deposits (ledger_id, goal_id, amount) values (l1, g1, 300);
  -- 里程碑 7：固定支出、自動分類規則、店家記憶、待確認項目
  insert into public.recurring_rules (ledger_id, name, amount, from_account_id, category_id, frequency, day_of_month, next_date)
  values (l1, '房租', 9000, cash1, food1, 'monthly', 1, current_date) returning id into r1;
  insert into public.category_rules (ledger_id, pattern, category_id) values (l1, '全家', food1);
  insert into public.merchants (ledger_id, merchant_key, name, last_category_id) values (l1, '全家', '全家', food1);
  insert into public.inbox_items (ledger_id, source, entry_date, amount, merchant_name, invoice_no)
  values (l1, 'invoice_qr', current_date, 85, '全家', 'AB12345678') returning id into i1;

  -- 本人看得到自己的每一張表
  foreach t in array tables loop
    execute format('select count(*) from public.%I where %I = $1', t, case when t = 'ledgers' then 'id' else 'ledger_id' end) into n using l1;
    if n = 0 then raise exception 'FAIL 本人看不到自己的 %', t; end if;
  end loop;
  select count(*) into n from public.profiles where id = u1;
  if n <> 1 then raise exception 'FAIL 本人看不到自己的 profile'; end if;
  select count(*) into n from public.report_income_statement(l1, month_start, current_date);
  if n = 0 then raise exception 'FAIL 本人的損益表是空的'; end if;
  checked := checked + 1;

  -- ---------------------------------------------------------------------------
  -- u2：讀不到、改不了、刪不掉 u1 的資料
  -- ---------------------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);

  foreach t in array tables loop
    execute format('select count(*) from public.%I where %I = $1', t, case when t = 'ledgers' then 'id' else 'ledger_id' end) into n using l1;
    if n <> 0 then raise exception 'FAIL 他人讀得到 %（% 列）', t, n; end if;

    execute format('update public.%I set id = id where %I = $1', t, case when t = 'ledgers' then 'id' else 'ledger_id' end) using l1;
    get diagnostics n = row_count;
    if n <> 0 then raise exception 'FAIL 他人改得到 %', t; end if;

    begin
      execute format('delete from public.%I where %I = $1', t, case when t = 'ledgers' then 'id' else 'ledger_id' end) using l1;
      get diagnostics n = row_count;
      if n <> 0 then raise exception 'FAIL 他人刪得掉 %', t; end if;
    exception when insufficient_privilege then null;  -- 帳本整個不能從 REST 刪（里程碑 8）
    end;
  end loop;

  select count(*) into n from public.profiles where id = u1;
  if n <> 0 then raise exception 'FAIL 他人讀得到 profile'; end if;
  update public.profiles set display_name = 'x' where id = u1;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL 他人改得到 profile'; end if;
  select count(*) into n from public.account_balances where ledger_id = l1;
  if n <> 0 then raise exception 'FAIL 他人讀得到 account_balances'; end if;
  if public.is_ledger_owner(l1) then raise exception 'FAIL is_ledger_owner 對他人回 true'; end if;
  checked := checked + 1;

  -- 報表與統計函式：拿不到任何數字
  select count(*) into n from public.report_income_statement(l1, month_start - 400, current_date);
  if n <> 0 then raise exception 'FAIL 他人拿得到損益表'; end if;
  select count(*) into n from public.report_balance_sheet(l1, current_date) where account_id is not null or balance <> 0;
  if n <> 0 then raise exception 'FAIL 他人拿得到資產負債表'; end if;
  select coalesce(sum(abs(inflow) + abs(outflow)), 0) into amount from public.report_cash_flow(l1, month_start - 400, current_date);
  if amount <> 0 then raise exception 'FAIL 他人拿得到現金流量表'; end if;
  select coalesce(sum(income + expense), 0) into amount from public.monthly_summary(l1, month_start - 400, current_date);
  if amount <> 0 then raise exception 'FAIL 他人拿得到每月收支'; end if;
  select coalesce(sum(income + expense), 0) into amount from public.daily_summary(l1, month_start - 40, current_date);
  if amount <> 0 then raise exception 'FAIL 他人拿得到每日收支'; end if;
  select coalesce(sum(abs(net_worth)), 0) into amount from public.net_worth_by_month(l1, month_start - 400, current_date);
  if amount <> 0 then raise exception 'FAIL 他人拿得到淨值走勢'; end if;
  select count(*) into n from public.category_spending_stats(l1, current_date);
  if n <> 0 then raise exception 'FAIL 他人拿得到類別統計'; end if;
  select count(*) into n from public.goal_progress(l1, current_date);
  if n <> 0 then raise exception 'FAIL 他人拿得到目標進度'; end if;
  select count(*) into n from public.suggest_category(l1, '全家', null);
  if n <> 0 then raise exception 'FAIL 他人拿得到分類建議'; end if;
  checked := checked + 1;

  -- 寫進別人的帳本、或把自己的資料掛到別人的科目上：一律被擋
  foreach stmt in array array[
    format('insert into public.ledgers (owner_id, name) values (%L, %L)', u1, '冒名帳本'),
    format('insert into public.accounts (ledger_id, name, type) values (%L, %L, %L)', l1, '入侵帳戶', 'asset'),
    format('insert into public.entries (ledger_id, kind, entry_date, amount, from_account_id, category_id) values (%L, %L, current_date, 1, %L, %L)', l1, 'expense', cash1, food1),
    format('insert into public.entry_lines (entry_id, ledger_id, account_id, debit) values (%L, %L, %L, 1)', e1, l1, cash1),
    format('insert into public.budgets (ledger_id, category_id, month, amount) values (%L, %L, %L, 1)', l1, food1, month_start),
    format('insert into public.goals (ledger_id, name, target_amount) values (%L, %L, 1)', l1, '入侵目標'),
    format('insert into public.goal_deposits (ledger_id, goal_id, amount) values (%L, %L, 1)', l1, g1),
    format('insert into public.recurring_rules (ledger_id, name, amount, from_account_id, category_id, frequency, day_of_month, next_date) values (%L, %L, 1, %L, %L, %L, 1, current_date)', l1, '入侵', cash1, food1, 'monthly'),
    format('insert into public.category_rules (ledger_id, pattern, category_id) values (%L, %L, %L)', l1, '入侵', food1),
    format('insert into public.merchants (ledger_id, merchant_key) values (%L, %L)', l1, '入侵'),
    format('insert into public.inbox_items (ledger_id, source, entry_date, amount) values (%L, %L, current_date, 1)', l1, 'invoice_qr'),
    -- 自己的帳本，但參照 u1 的科目或目標
    format('insert into public.budgets (ledger_id, category_id, month, amount) values (%L, %L, %L, 1)', l2, food1, month_start),
    format('insert into public.goals (ledger_id, name, target_amount, account_id) values (%L, %L, 1, %L)', l2, '綁別人的帳戶', cash1),
    format('insert into public.goal_deposits (ledger_id, goal_id, amount) values (%L, %L, 1)', l2, g1),
    format('insert into public.recurring_rules (ledger_id, name, amount, from_account_id, category_id, frequency, day_of_month, next_date) values (%L, %L, 1, %L, %L, %L, 1, current_date)', l2, '掛別人的科目', cash1, food1, 'monthly'),
    format('insert into public.category_rules (ledger_id, pattern, category_id) values (%L, %L, %L)', l2, '掛別人的類別', food1),
    format('insert into public.merchants (ledger_id, merchant_key, last_category_id) values (%L, %L, %L)', l2, '掛別人的類別', food1),
    format('insert into public.inbox_items (ledger_id, source, entry_date, amount, category_id) values (%L, %L, current_date, 1, %L)', l2, 'invoice_qr', food1),
    format('insert into public.inbox_items (ledger_id, source, entry_date, amount, recurring_rule_id) values (%L, %L, current_date, 1, %L)', l2, 'recurring', r1),
    format('select public.save_entry(%L::jsonb, %L::jsonb)',
      json_build_object('ledger_id', l2, 'kind', 'expense', 'entry_date', current_date, 'amount', 5, 'from_account_id', cash1, 'category_id', food1),
      json_build_array(json_build_object('account_id', food1, 'debit', 5, 'credit', 0), json_build_object('account_id', cash1, 'debit', 0, 'credit', 5))),
    format('select public.save_entry(%L::jsonb, %L::jsonb)',
      json_build_object('ledger_id', l2, 'kind', 'expense', 'entry_date', current_date, 'amount', 5, 'from_account_id', cash2, 'category_id', food2),
      json_build_array(json_build_object('account_id', food1, 'debit', 5, 'credit', 0), json_build_object('account_id', cash2, 'debit', 0, 'credit', 5))),
    -- 用別人的 id 呼叫會改資料的 RPC
    format('select public.save_entry(%L::jsonb, %L::jsonb)',
      json_build_object('id', e1, 'ledger_id', l1, 'kind', 'expense', 'entry_date', current_date, 'amount', 1, 'from_account_id', cash1, 'category_id', food1),
      json_build_array(json_build_object('account_id', food1, 'debit', 1, 'credit', 0), json_build_object('account_id', cash1, 'debit', 0, 'credit', 1))),
    format('select public.set_opening_balance(%L, 999)', cash1),
    format('select public.move_account(%L, %L)', food1, 'down'),
    format('select public.generate_recurring_items(%L, current_date)', l1),
    format('select public.confirm_inbox_item(%L, %L::jsonb)', i1, json_build_object('from_account_id', cash2, 'splits', json_build_array(json_build_object('category_id', food2, 'amount', 85)))),
    format('select public.restore_ledger(%L, %L::jsonb)', l1, '{"app":"financial","version":1,"ledger":{}}'),
    -- 不開放呼叫的函式
    'select public.create_ledger_with_defaults(''多開的帳本'')',
    format('select public.seed_ledger(%L, %L)', u2, '多開的帳本')
  ] loop
    begin
      execute stmt;
      raise exception 'FAIL 應該被擋下：%', stmt;
    exception
      when insufficient_privilege or check_violation or foreign_key_violation or no_data_found then
        checked := checked + 1;
    end;
  end loop;

  -- ---------------------------------------------------------------------------
  -- 里程碑 8：就算是自己的帳本，也有做不到的事（仍以 u2 身分）
  -- ---------------------------------------------------------------------------
  e2 := public.save_entry(
    json_build_object('ledger_id', l2, 'kind', 'expense', 'entry_date', current_date, 'amount', 30,
                      'from_account_id', cash2, 'category_id', food2)::jsonb,
    json_build_array(json_build_object('account_id', food2, 'debit', 30, 'credit', 0),
                     json_build_object('account_id', cash2, 'debit', 0, 'credit', 30))::jsonb);
  insert into public.goals (ledger_id, name, target_amount) values (l2, '自己的目標', 100) returning id into g2;
  insert into public.inbox_items (ledger_id, source, entry_date, amount, merchant_name, invoice_no)
  values (l2, 'invoice_qr', current_date, 100, '全家', 'CD12345678') returning id into i2;
  insert into public.inbox_items (ledger_id, source, entry_date, amount, merchant_name, invoice_no)
  values (l2, 'invoice_qr', current_date, 50, '全家', 'CD87654321') returning id into i3;

  -- 允許的事照常可以做
  update public.profiles set display_name = '測試二號' where id = u2;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL 本人改不了自己的 profile'; end if;
  update public.ledgers set name = '改名的帳本' where id = l2;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL 本人改不了自己的帳本名稱'; end if;
  update public.inbox_items set status = 'dismissed', resolved_at = now() where id = i3 and status = 'pending';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL 本人不能略過待確認項目'; end if;
  update public.accounts set name = '開帳餘額', sort_order = 999 where ledger_id = l2 and is_system;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL 系統科目不能改名稱或排序'; end if;
  select count(*) into n from public.net_worth_by_month(l2, current_date - 365, current_date);
  if n < 12 then raise exception 'FAIL 一年的淨值走勢只回 % 個月', n; end if;
  checked := checked + 5;

  -- created_by：新增時一律是本人，之後改不掉
  insert into public.entries (ledger_id, kind, entry_date, amount, from_account_id, category_id, created_by)
  values (l2, 'expense', current_date, 1, cash2, food2, u1) returning created_by into uid;
  if uid <> u2 then raise exception 'FAIL created_by 可以填別人'; end if;
  delete from public.entries e where e.ledger_id = l2 and e.id <> e2;
  update public.entries set created_by = u1 where id = e2;
  select created_by into uid from public.entries where id = e2;
  if uid <> u2 then raise exception 'FAIL created_by 可以改成別人'; end if;
  checked := checked + 2;

  -- 每一項是 [允許的 SQLSTATE（正規表示式）, 語句]
  foreach pair slice 1 in array array[
    -- 帳本與個人資料不能從 REST 新增或刪除
    ['42501', format('insert into public.ledgers (owner_id, name) values (%L, %L)', u2, '第二本帳本')],
    ['42501', format('delete from public.ledgers where id = %L', l2)],
    ['42501', format('insert into public.profiles (id) values (%L)', u2)],
    ['42501', format('delete from public.profiles where id = %L', u2)],
    -- with check：自己的資料不能搬到別人的帳本
    ['42501|23514', format('update public.accounts set ledger_id = %L where id = %L', l1, cash2)],
    ['42501|23514', format('update public.entries set ledger_id = %L where id = %L', l1, e2)],
    ['42501|23514', format('update public.goals set ledger_id = %L where id = %L', l1, g2)],
    ['42501|23514', format('update public.inbox_items set ledger_id = %L where id = %L', l1, i2)],
    ['42501|23514', format('update public.ledgers set owner_id = %L where id = %L', u1, l2)],
    ['42501|23514|23503', format('update public.profiles set id = %L where id = %L', gen_random_uuid(), u2)],
    -- 系統科目
    ['42501', format('delete from public.accounts where ledger_id = %L and is_system', l2)],
    ['42501', format('update public.accounts set is_system = false where ledger_id = %L and is_system', l2)],
    ['42501', format('update public.accounts set type = %L where ledger_id = %L and is_system', 'asset', l2)],
    ['42501', format('update public.accounts set is_system = true where id = %L', cash2)],
    ['42501', format('insert into public.accounts (ledger_id, name, type, is_system) values (%L, %L, %L, true)', l2, '假的期初', 'equity')],
    -- 待確認項目：只能經由 RPC 確認、處理過的不能再改、來源不能改
    ['42501', format('insert into public.inbox_items (ledger_id, source, entry_date, amount, status) values (%L, %L, current_date, 1, %L)', l2, 'invoice_qr', 'confirmed')],
    ['42501', format('insert into public.inbox_items (ledger_id, source, entry_date, amount, entry_ids) values (%L, %L, current_date, 1, array[%L]::uuid[])', l2, 'invoice_qr', e2)],
    ['42501', format('update public.inbox_items set status = %L where id = %L', 'confirmed', i2)],
    ['42501', format('update public.inbox_items set entry_ids = array[%L]::uuid[] where id = %L', e2, i2)],
    ['42501', format('update public.inbox_items set source = %L where id = %L', 'recurring', i2)],
    ['42501', format('update public.inbox_items set invoice_no = %L where id = %L', 'ZZ00000000', i2)],
    ['42501', format('update public.inbox_items set status = %L where id = %L', 'pending', i3)],
    -- 拆分：最多兩位小數、最多 50 筆
    ['22023', format('select public.confirm_inbox_item(%L, %L::jsonb)', i2, json_build_object('from_account_id', cash2, 'splits',
      json_build_array(json_build_object('category_id', food2, 'amount', 50.005), json_build_object('category_id', food2, 'amount', 49.995))))],
    ['22023', format('select public.confirm_inbox_item(%L, %L::jsonb)', i2, json_build_object('from_account_id', cash2, 'splits',
      (select json_agg(json_build_object('category_id', food2, 'amount', 1)) from generate_series(1, 51))))],
    -- 筆數上限（一次批次就超過）
    ['54000', format('insert into public.goals (ledger_id, name, target_amount) select %L, %L || i, 1 from generate_series(1, 100) i', l2, '目標')],
    ['54000', format('insert into public.category_rules (ledger_id, pattern, category_id) select %L, %L || i, %L from generate_series(1, 201) i', l2, '規則', food2)],
    ['54000', format('insert into public.accounts (ledger_id, name, type) select %L, %L || i, %L from generate_series(1, 300) i', l2, '帳戶', 'asset')],
    -- 長度上限
    ['23514', format('insert into public.goals (ledger_id, name, target_amount) values (%L, %L, 1)', l2, repeat('長', 51))],
    ['23514', format('update public.profiles set slogan = %L where id = %L', repeat('x', 61), u2)],
    ['23514', format('update public.ledgers set name = %L where id = %L', '   ', l2)],
    ['23514', format('select public.save_entry(%L::jsonb, %L::jsonb)',
      json_build_object('ledger_id', l2, 'kind', 'expense', 'entry_date', current_date, 'amount', 5, 'from_account_id', cash2, 'category_id', food2, 'memo', repeat('m', 201)),
      json_build_array(json_build_object('account_id', food2, 'debit', 5, 'credit', 0), json_build_object('account_id', cash2, 'debit', 0, 'credit', 5)))],
    ['23514', format('insert into public.inbox_items (ledger_id, source, entry_date, amount, items) values (%L, %L, current_date, 1, (select jsonb_agg(i) from generate_series(1, 501) i))', l2, 'invoice_qr')],
    -- 報表日期區間
    ['22023', format('select public.net_worth_by_month(%L, current_date - 4000, current_date)', l2)],
    ['22023', format('select public.net_worth_by_month(%L, current_date, current_date - 1)', l2)]
  ] loop
    begin
      execute pair[2];
      raise exception 'FAIL 應該被擋下：%', pair[2];
    exception when others then
      if sqlstate !~ ('^(' || pair[1] || ')$') then
        raise exception 'FAIL 預期 SQLSTATE %，實際 %（%）：%', pair[1], sqlstate, sqlerrm, pair[2];
      end if;
      checked := checked + 1;
    end;
  end loop;

  -- 正常確認入帳之後，就不能再把它改回未處理
  perform public.confirm_inbox_item(i2, json_build_object('from_account_id', cash2, 'splits',
    json_build_array(json_build_object('category_id', food2, 'amount', 60.5), json_build_object('category_id', food2, 'amount', 39.5)))::jsonb);
  select count(*) into n from public.inbox_items where id = i2 and status = 'confirmed' and cardinality(entry_ids) = 2;
  if n <> 1 then raise exception 'FAIL confirm_inbox_item 沒有正常確認'; end if;
  begin
    update public.inbox_items set status = 'pending', entry_ids = '{}' where id = i2;
    raise exception 'FAIL 確認過的項目可以改回未處理';
  exception when insufficient_privilege then null;
  end;
  checked := checked + 2;

  -- ---------------------------------------------------------------------------
  -- anon：表都是空的，函式都不能呼叫
  -- ---------------------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  perform set_config('role', 'anon', true);

  foreach t in array tables || array['profiles', 'account_balances'] loop
    begin
      execute format('select count(*) from public.%I', t) into n;
      if n <> 0 then raise exception 'FAIL anon 讀得到 %（% 列）', t, n; end if;
    exception when insufficient_privilege then null;
    end;
    checked := checked + 1;
  end loop;

  -- anon 寫入：里程碑 8 收回權限後一律 permission denied
  foreach t in array tables || array['profiles'] loop
    foreach stmt in array array[
      format('insert into public.%I default values', t),
      format('update public.%I set id = id', t),
      format('delete from public.%I', t)
    ] loop
      begin
        execute stmt;
        raise exception 'FAIL anon 可以寫入：%', stmt;
      exception when insufficient_privilege then
        checked := checked + 1;
      end;
    end loop;
  end loop;

  foreach stmt in array array[
    format('select public.report_income_statement(%L, current_date - 30, current_date)', l1),
    format('select public.report_balance_sheet(%L, current_date)', l1),
    format('select public.report_cash_flow(%L, current_date - 30, current_date)', l1),
    format('select public.monthly_summary(%L, current_date - 30, current_date)', l1),
    format('select public.daily_summary(%L, current_date - 30, current_date)', l1),
    format('select public.net_worth_by_month(%L, current_date - 30, current_date)', l1),
    format('select public.category_spending_stats(%L, current_date)', l1),
    format('select public.goal_progress(%L, current_date)', l1),
    format('select public.save_entry(%L::jsonb, %L::jsonb)', json_build_object('ledger_id', l1), '[]'),
    format('select public.set_opening_balance(%L, 1)', cash1),
    format('select public.move_account(%L, %L)', food1, 'up'),
    format('select public.complete_onboarding(%L, current_date, %L::jsonb)', 'x', '[]'),
    'select public.create_ledger_with_defaults(''x'')',
    format('select public.generate_recurring_items(%L, current_date)', l1),
    format('select public.confirm_inbox_item(%L, %L::jsonb)', i1, '{"splits":[]}'),
    format('select public.suggest_category(%L, %L, null)', l1, '全家'),
    format('select public.restore_ledger(%L, %L::jsonb)', l1, '{}')
  ] loop
    begin
      execute stmt;
      raise exception 'FAIL anon 可以呼叫：%', stmt;
    exception when insufficient_privilege then
      checked := checked + 1;
    end;
  end loop;

  raise exception 'ALL_OK（% 項檢查通過，已回滾）', checked;
end $$;
