-- =============================================================================
-- RLS 與函式權限測試（里程碑 6）
--
-- 在單一 DO 區塊裡建立兩位測試使用者（各自由註冊 trigger 得到一本帳本）與 u1 的資料，
-- 然後以 u2、anon 的身分逐一確認：讀不到、改不了、刪不掉、寫不進別人的帳本、
-- 也不能把自己的資料掛到別人的科目上。全部通過時以 `ALL_OK` 例外結束，整個區塊回滾，
-- 不會留下任何資料；任何一項失敗就丟出以 FAIL 開頭的訊息。
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
begin
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

    execute format('delete from public.%I where %I = $1', t, case when t = 'ledgers' then 'id' else 'ledger_id' end) using l1;
    get diagnostics n = row_count;
    if n <> 0 then raise exception 'FAIL 他人刪得掉 %', t; end if;
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
