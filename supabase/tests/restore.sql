-- =============================================================================
-- 備份還原測試（里程碑 6 PR C）：restore_ledger
--
-- 在單一 DO 區塊裡建立兩位測試使用者，u1 記幾筆帳、設子類別、預算、目標與存入，
-- 用 SQL 組出跟前端匯出相同格式的備份，然後確認：
--   1. 改動後還原，回到備份時的狀態（科目、餘額、交易、預算、目標、存入、帳本設定、固定支出、分類規則），id 重新產生
--   2. 同一份備份還原兩次也不會撞主鍵
--   3. 不能還原到別人的帳本
--   4. 壞檔（借貸不平衡、參照不完整、版本不對）會被擋下，而且帳本維持原樣
--   5. u2 還原 u1 的備份到自己的帳本可以，u1 的帳本不受影響
--   6. anon 不能呼叫
-- 全部通過時以 `ALL_OK` 例外結束，整個區塊回滾，不會留下任何資料。
--
-- 執行（本機 Supabase 或 CI）：
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/restore.sql 2>&1 | tee restore.out
--   grep -q 'ALL_OK' restore.out
-- =============================================================================
-- 帳本「指紋」：用名稱比對（還原後 id 會變），涵蓋科目、餘額、交易、預算、目標、存入、帳本設定
create function pg_temp.ledger_signature(p_ledger uuid) returns text language sql as $f$
  select string_agg(x, '|' order by x) from (
      select format('A:%s/%s/%s/%s/%s', a.name, a.type, coalesce(p.name, '-'), a.is_system, coalesce(b.balance, 0)) x
        from public.accounts a left join public.accounts p on p.id = a.parent_id
        left join public.account_balances b on b.account_id = a.id where a.ledger_id = p_ledger
      union all
      select format('E:%s/%s/%s/%s/%s/%s/%s', e.kind, e.entry_date, e.amount, coalesce(f.name, '-'), coalesce(t.name, '-'), coalesce(c.name, '-'), coalesce(e.memo, '-'))
        from public.entries e left join public.accounts f on f.id = e.from_account_id left join public.accounts t on t.id = e.to_account_id
        left join public.accounts c on c.id = e.category_id where e.ledger_id = p_ledger
      union all
      select format('B:%s/%s/%s', c.name, b.month, b.amount) from public.budgets b join public.accounts c on c.id = b.category_id where b.ledger_id = p_ledger
      union all
      select format('G:%s/%s/%s/%s', g.name, g.target_amount, coalesce(a.name, '-'), g.sort_order) from public.goals g left join public.accounts a on a.id = g.account_id where g.ledger_id = p_ledger
      union all
      select format('D:%s/%s/%s', g.name, d.amount, d.note) from public.goal_deposits d join public.goals g on g.id = d.goal_id where d.ledger_id = p_ledger
      union all
      select format('L:%s/%s/%s/%s/%s', name, start_date, cover_color, cover_material, monthly_spending_limit) from public.ledgers where id = p_ledger
      union all
      select format('R:%s/%s/%s/%s/%s/%s', r.name, r.amount, coalesce(f.name, '-'), coalesce(c.name, '-'), r.frequency, r.next_date)
        from public.recurring_rules r left join public.accounts f on f.id = r.from_account_id left join public.accounts c on c.id = r.category_id
       where r.ledger_id = p_ledger
      union all
      select format('C:%s/%s/%s', cr.pattern, c.name, coalesce(a.name, '-'))
        from public.category_rules cr join public.accounts c on c.id = cr.category_id left join public.accounts a on a.id = cr.account_id
       where cr.ledger_id = p_ledger
  ) s;
$f$;

do $$
declare
  u1 uuid := gen_random_uuid();
  u2 uuid := gen_random_uuid();
  l1 uuid; l2 uuid;
  cash1 uuid; bank1 uuid; food1 uuid; salary1 uuid; snack1 uuid; g1 uuid; g2 uuid;
  month_start date := date_trunc('month', current_date)::date;
  backup jsonb; bad jsonb; result jsonb;
  before_sig text; after_sig text;
  n bigint;
  checked int := 0;
begin
  insert into auth.users (id, email, instance_id, aud, role)
  values (u1, 'restore-test-1@example.invalid', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
         (u2, 'restore-test-2@example.invalid', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
  select id into l1 from public.ledgers where owner_id = u1;
  select id into l2 from public.ledgers where owner_id = u2;

  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  select id into cash1 from public.accounts where ledger_id = l1 and subtype = 'cash';
  select id into bank1 from public.accounts where ledger_id = l1 and subtype = 'bank';
  select id into food1 from public.accounts where ledger_id = l1 and name = '飲食';
  select id into salary1 from public.accounts where ledger_id = l1 and name = '薪資';

  -- ---------------------------------------------------------------------------
  -- 準備 u1 的資料：期初、收入、子類別支出、轉帳、帳本設定、預算、兩種目標、存入
  -- ---------------------------------------------------------------------------
  update public.ledgers set name = '測試帳本', cover_color = 'rose', cover_material = 'linen', monthly_spending_limit = 20000 where id = l1;
  perform public.set_opening_balance(cash1, 5000);
  insert into public.accounts (ledger_id, name, type, parent_id) values (l1, '零食', 'expense', food1) returning id into snack1;
  perform public.save_entry(
    json_build_object('ledger_id', l1, 'kind', 'income', 'entry_date', current_date, 'amount', 30000, 'to_account_id', bank1, 'category_id', salary1)::jsonb,
    json_build_array(json_build_object('account_id', bank1, 'debit', 30000, 'credit', 0),
                     json_build_object('account_id', salary1, 'debit', 0, 'credit', 30000))::jsonb);
  perform public.save_entry(
    json_build_object('ledger_id', l1, 'kind', 'expense', 'entry_date', current_date, 'amount', 85.5, 'from_account_id', cash1, 'category_id', snack1, 'memo', '鹹酥雞')::jsonb,
    json_build_array(json_build_object('account_id', snack1, 'debit', 85.5, 'credit', 0),
                     json_build_object('account_id', cash1, 'debit', 0, 'credit', 85.5))::jsonb);
  perform public.save_entry(
    json_build_object('ledger_id', l1, 'kind', 'transfer', 'entry_date', current_date, 'amount', 1000, 'from_account_id', bank1, 'to_account_id', cash1)::jsonb,
    json_build_array(json_build_object('account_id', cash1, 'debit', 1000, 'credit', 0),
                     json_build_object('account_id', bank1, 'debit', 0, 'credit', 1000))::jsonb);
  insert into public.budgets (ledger_id, category_id, month, amount) values (l1, food1, month_start, 6000);
  insert into public.goals (ledger_id, name, target_amount, account_id, sort_order) values (l1, '旅行基金', 50000, bank1, 10) returning id into g1;
  insert into public.goals (ledger_id, name, target_amount, sort_order) values (l1, '新手機', 20000, 20) returning id into g2;
  insert into public.goal_deposits (ledger_id, goal_id, amount, note) values (l1, g2, 3000, '第一筆');
  -- 里程碑 7：固定支出與自動分類規則也要備份還原；待確認項目不備份
  insert into public.recurring_rules (ledger_id, name, amount, from_account_id, category_id, frequency, day_of_month, next_date)
  values (l1, '房租', 12000, bank1, snack1, 'monthly', 5, current_date);
  insert into public.category_rules (ledger_id, pattern, category_id, account_id) values (l1, '全家', food1, cash1);
  set constraints all immediate;
  set constraints all deferred;

  -- 跟前端匯出相同格式的備份（多出來的欄位會被忽略）
  backup := jsonb_build_object(
    'app', 'financial', 'version', 1, 'exported_at', now(),
    'ledger', (select to_jsonb(l) from public.ledgers l where id = l1),
    'profile', (select to_jsonb(p) from public.profiles p where id = u1),
    'accounts', (select jsonb_agg(to_jsonb(a)) from public.accounts a where ledger_id = l1),
    'entries', (select jsonb_agg(to_jsonb(e)) from public.entries e where ledger_id = l1),
    'entry_lines', (select jsonb_agg(to_jsonb(x)) from public.entry_lines x where ledger_id = l1),
    'budgets', (select jsonb_agg(to_jsonb(b)) from public.budgets b where ledger_id = l1),
    'goals', (select jsonb_agg(to_jsonb(g)) from public.goals g where ledger_id = l1),
    'goal_deposits', (select jsonb_agg(to_jsonb(d)) from public.goal_deposits d where ledger_id = l1),
    'recurring_rules', (select jsonb_agg(to_jsonb(r)) from public.recurring_rules r where ledger_id = l1),
    'category_rules', (select jsonb_agg(to_jsonb(c)) from public.category_rules c where ledger_id = l1));

  before_sig := pg_temp.ledger_signature(l1);

  -- ---------------------------------------------------------------------------
  -- 1. 改動後還原，回到備份時的狀態
  -- ---------------------------------------------------------------------------
  perform public.save_entry(
    json_build_object('ledger_id', l1, 'kind', 'expense', 'entry_date', current_date, 'amount', 999, 'from_account_id', cash1, 'category_id', food1)::jsonb,
    json_build_array(json_build_object('account_id', food1, 'debit', 999, 'credit', 0),
                     json_build_object('account_id', cash1, 'debit', 0, 'credit', 999))::jsonb);
  delete from public.budgets where ledger_id = l1;
  update public.goals set name = '改掉的名字' where id = g2;
  update public.ledgers set name = '改掉的帳本', monthly_spending_limit = null where id = l1;
  insert into public.accounts (ledger_id, name, type) values (l1, '多出來的類別', 'expense');
  delete from public.category_rules where ledger_id = l1;
  update public.recurring_rules set amount = 1 where ledger_id = l1;

  result := public.restore_ledger(l1, backup);
  set constraints all immediate;
  set constraints all deferred;
  after_sig := pg_temp.ledger_signature(l1);
  if after_sig is distinct from before_sig then
    raise exception 'FAIL 還原後跟備份不一致 before=[%] after=[%]', before_sig, after_sig;
  end if;
  if (result ->> 'entries')::int <> 4 or (result ->> 'goals')::int <> 2 then
    raise exception 'FAIL 還原回傳的筆數不對：%', result;
  end if;
  select count(*) into n from public.accounts where ledger_id = l1 and id = cash1;
  if n <> 0 then raise exception 'FAIL 還原後科目 id 沒有重新產生'; end if;
  checked := checked + 3;

  -- ---------------------------------------------------------------------------
  -- 2. 同一份備份再還原一次
  -- ---------------------------------------------------------------------------
  perform public.restore_ledger(l1, backup);
  set constraints all immediate;
  set constraints all deferred;
  select count(*) into n from public.entries where ledger_id = l1;
  if n <> 4 then raise exception 'FAIL 第二次還原後交易筆數 % ≠ 4', n; end if;
  checked := checked + 1;

  -- ---------------------------------------------------------------------------
  -- 3. 不能還原到別人的帳本
  -- ---------------------------------------------------------------------------
  begin
    perform public.restore_ledger(l2, backup);
    raise exception 'FAIL 可以還原到別人的帳本';
  exception when insufficient_privilege then
    checked := checked + 1;
  end;

  -- ---------------------------------------------------------------------------
  -- 4. 壞檔被擋下，帳本維持原樣
  -- ---------------------------------------------------------------------------
  -- 借貸不平衡：把第一行的借方改大（commit 時的 constraint trigger 擋下）
  bad := jsonb_set(backup, '{entry_lines,0}',
    (backup -> 'entry_lines' -> 0) || jsonb_build_object('debit', ((backup -> 'entry_lines' -> 0 ->> 'debit')::numeric + (backup -> 'entry_lines' -> 0 ->> 'credit')::numeric + 1), 'credit', 0));
  begin
    perform public.restore_ledger(l1, bad);
    set constraints all immediate;
    raise exception 'FAIL 借貸不平衡的備份沒有被擋下';
  exception when check_violation then
    checked := checked + 1;
  end;
  set constraints all deferred;

  -- 參照不完整：交易指到不存在的科目
  bad := jsonb_set(backup, '{entries,0,category_id}', to_jsonb(gen_random_uuid()::text));
  bad := jsonb_set(bad, '{entries,0,from_account_id}', to_jsonb(gen_random_uuid()::text));
  begin
    perform public.restore_ledger(l1, bad);
    raise exception 'FAIL 參照不完整的備份沒有被擋下';
  exception when invalid_parameter_value then
    checked := checked + 1;
  end;

  -- 版本不對
  begin
    perform public.restore_ledger(l1, backup || '{"version": 2}');
    raise exception 'FAIL 版本 2 的備份沒有被擋下';
  exception when invalid_parameter_value then
    checked := checked + 1;
  end;

  -- 三次失敗後帳本仍是備份時的狀態
  after_sig := pg_temp.ledger_signature(l1);
  if after_sig is distinct from before_sig then raise exception 'FAIL 壞檔還原失敗後帳本被改動了'; end if;
  checked := checked + 1;

  -- ---------------------------------------------------------------------------
  -- 5. u2 還原 u1 的備份到自己的帳本；u1 不受影響
  -- ---------------------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  perform public.restore_ledger(l2, backup);
  set constraints all immediate;
  set constraints all deferred;
  select count(*) into n from public.entries where ledger_id = l2;
  if n <> 4 then raise exception 'FAIL u2 還原後交易筆數 % ≠ 4', n; end if;
  select count(*) into n from public.goals where ledger_id = l2 and name = '旅行基金' and account_id is not null;
  if n <> 1 then raise exception 'FAIL u2 還原後綁帳戶的目標不對'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
  select count(*) into n from public.entries where ledger_id = l1;
  if n <> 4 then raise exception 'FAIL u2 還原後 u1 的帳本被動到了'; end if;
  checked := checked + 2;

  -- ---------------------------------------------------------------------------
  -- 6. anon 不能呼叫
  -- ---------------------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  perform set_config('role', 'anon', true);
  begin
    perform public.restore_ledger(l1, backup);
    raise exception 'FAIL anon 可以呼叫 restore_ledger';
  exception when insufficient_privilege then
    checked := checked + 1;
  end;

  raise exception 'ALL_OK（% 項檢查通過，已回滾）', checked;
end $$;
