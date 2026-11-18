-- =============================================================================
-- 待確認匣、固定支出、自動分類測試（里程碑 7 PR A）
--
--   1. 週期日期：每月 31 號落在月底、每週、每年 2/29
--   2. 固定支出：新增時下次日期對齊週期；到期產生待確認項目，錯過的期數補上，重複呼叫不重複產生
--   3. 確認固定支出可以改金額；確認後產生交易、項目變成已確認、不能再確認一次
--   4. 發票拆成多筆：合計不對被擋；拆兩筆產生兩筆交易並記下發票號碼；記住店家
--   5. 分類建議：先看自訂規則，再看店家記憶
--   6. 發票號碼去重；固定支出缺帳戶或類別被擋
-- 全部通過時以 `ALL_OK` 例外結束，整個區塊回滾。
--
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/inbox.sql 2>&1 | grep ALL_OK
-- =============================================================================
do $$
declare
  u1 uuid := gen_random_uuid();
  l1 uuid;
  cash uuid; bank uuid; food uuid; shop uuid; traffic uuid; salary uuid;
  rent uuid; pay uuid; item uuid; inv uuid;
  ids uuid[];
  n bigint; d date; amt numeric;
  suggestion record;
  checked int := 0;
begin
  -- ---------------------------------------------------------------------------
  -- 1. 週期日期（純函式）
  -- ---------------------------------------------------------------------------
  if public.recurrence_on_or_after('monthly', 31, null, null, date '2027-02-01') <> date '2027-02-28' then raise exception 'FAIL 每月 31 號在二月應落在 28 號'; end if;
  if public.recurrence_on_or_after('monthly', 31, null, null, date '2027-03-01') <> date '2027-03-31' then raise exception 'FAIL 每月 31 號在三月應是 31 號'; end if;
  if public.recurrence_on_or_after('monthly', 5, null, null, date '2026-11-05') <> date '2026-11-05' then raise exception 'FAIL 當天就是到期日'; end if;
  if public.recurrence_on_or_after('monthly', 5, null, null, date '2026-12-06') <> date '2027-01-05' then raise exception 'FAIL 每月跨年'; end if;
  if public.recurrence_on_or_after('weekly', null, 1, null, date '2026-11-18') <> date '2026-11-23' then raise exception 'FAIL 每週一（11/18 是週三）'; end if;
  if public.recurrence_on_or_after('weekly', null, 3, null, date '2026-11-18') <> date '2026-11-18' then raise exception 'FAIL 每週三當天'; end if;
  if public.recurrence_on_or_after('yearly', 29, null, 2, date '2027-01-01') <> date '2027-02-28' then raise exception 'FAIL 每年 2/29 在平年'; end if;
  if public.recurrence_on_or_after('yearly', 29, null, 2, date '2027-03-01') <> date '2028-02-29' then raise exception 'FAIL 每年 2/29 在閏年'; end if;
  checked := checked + 8;

  insert into auth.users (id, email, instance_id, aud, role)
  values (u1, 'inbox-test-1@example.invalid', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
  select id into l1 from public.ledgers where owner_id = u1;
  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  select id into cash from public.accounts where ledger_id = l1 and subtype = 'cash';
  select id into bank from public.accounts where ledger_id = l1 and subtype = 'bank';
  select id into food from public.accounts where ledger_id = l1 and name = '飲食';
  select id into shop from public.accounts where ledger_id = l1 and name = '購物';
  select id into traffic from public.accounts where ledger_id = l1 and name = '交通';
  select id into salary from public.accounts where ledger_id = l1 and name = '薪資';
  select id into rent from public.accounts where ledger_id = l1 and name = '居住';

  -- ---------------------------------------------------------------------------
  -- 2. 固定支出：對齊週期、到期產生、補期數、不重複
  -- ---------------------------------------------------------------------------
  insert into public.recurring_rules (ledger_id, name, amount, amount_varies, from_account_id, category_id, frequency, day_of_month, next_date)
  values (l1, '房租', 12000, true, bank, rent, 'monthly', 5, date '2026-09-01') returning id into pay;
  select next_date into d from public.recurring_rules where id = pay;
  if d <> date '2026-09-05' then raise exception 'FAIL 下次日期沒有對齊到 5 號：%', d; end if;

  n := public.generate_recurring_items(l1, date '2026-11-18');
  if n <> 3 then raise exception 'FAIL 9/5、10/5、11/5 應產生 3 筆，實際 %', n; end if;
  select next_date into d from public.recurring_rules where id = pay;
  if d <> date '2026-12-05' then raise exception 'FAIL 下次日期應推到 12/5：%', d; end if;
  n := public.generate_recurring_items(l1, date '2026-11-18');
  if n <> 0 then raise exception 'FAIL 重複呼叫又產生了 % 筆', n; end if;
  select count(*) into n from public.inbox_items where recurring_rule_id = pay and status = 'pending' and memo = '房租' and from_account_id = bank;
  if n <> 3 then raise exception 'FAIL 待確認項目內容不對（% 筆）', n; end if;
  checked := checked + 4;

  -- ---------------------------------------------------------------------------
  -- 3. 確認固定支出：改金額、產生交易、不能再確認
  -- ---------------------------------------------------------------------------
  select id into item from public.inbox_items where recurring_rule_id = pay and due_date = date '2026-11-05';
  ids := public.confirm_inbox_item(item, jsonb_build_object('from_account_id', bank,
           'splits', jsonb_build_array(jsonb_build_object('category_id', rent, 'amount', 12500))));
  if array_length(ids, 1) <> 1 then raise exception 'FAIL 應產生 1 筆交易'; end if;
  select e.amount into amt from public.entries e where e.id = ids[1] and e.kind = 'expense' and e.entry_date = date '2026-11-05'
     and e.from_account_id = bank and e.category_id = rent and e.memo = '房租';
  if amt is distinct from 12500 then raise exception 'FAIL 交易內容不對（金額 %）', amt; end if;
  select count(*) into n from public.inbox_items where id = item and status = 'confirmed' and amount = 12500 and entry_ids = ids;
  if n <> 1 then raise exception 'FAIL 項目沒有標成已確認'; end if;
  begin
    perform public.confirm_inbox_item(item, jsonb_build_object('from_account_id', bank,
              'splits', jsonb_build_array(jsonb_build_object('category_id', rent, 'amount', 12500))));
    raise exception 'FAIL 同一筆可以確認兩次';
  exception when invalid_parameter_value then
    checked := checked + 1;
  end;
  checked := checked + 2;

  -- ---------------------------------------------------------------------------
  -- 4. 發票拆成多筆、記住店家
  -- ---------------------------------------------------------------------------
  insert into public.inbox_items (ledger_id, source, entry_date, amount, merchant_name, seller_ban, invoice_no, items)
  values (l1, 'invoice_qr', date '2026-11-18', 300, '全家便利商店', '12345678', 'AB12345678',
          '[{"name":"便當","qty":1,"price":100},{"name":"牙膏","qty":2,"price":100}]')
  returning id into inv;

  begin
    perform public.confirm_inbox_item(inv, jsonb_build_object('from_account_id', cash,
              'splits', jsonb_build_array(jsonb_build_object('category_id', food, 'amount', 100), jsonb_build_object('category_id', shop, 'amount', 150))));
    raise exception 'FAIL 拆分合計不等於發票金額卻沒被擋';
  exception when invalid_parameter_value then
    checked := checked + 1;
  end;
  begin
    perform public.confirm_inbox_item(inv, jsonb_build_object('from_account_id', cash,
              'splits', jsonb_build_array(jsonb_build_object('amount', 300))));
    raise exception 'FAIL 沒選類別卻沒被擋';
  exception when invalid_parameter_value then
    checked := checked + 1;
  end;

  ids := public.confirm_inbox_item(inv, jsonb_build_object('from_account_id', cash,
           'splits', jsonb_build_array(
             jsonb_build_object('category_id', food, 'amount', 100, 'memo', '便當'),
             jsonb_build_object('category_id', shop, 'amount', 200, 'memo', '牙膏'))));
  set constraints all immediate;
  set constraints all deferred;
  select count(*) into n from public.entries where id = any (ids) and invoice_no = 'AB12345678';
  if n <> 2 then raise exception 'FAIL 拆成兩筆並記下發票號碼（% 筆）', n; end if;
  select coalesce(sum(amount), 0) into amt from public.entries where id = any (ids);
  if amt <> 300 then raise exception 'FAIL 兩筆合計 % ≠ 300', amt; end if;
  select count(*) into n from public.merchants where ledger_id = l1 and merchant_key = '12345678' and name = '全家便利商店'
     and last_category_id = food and last_account_id = cash;
  if n <> 1 then raise exception 'FAIL 沒有記住店家'; end if;
  checked := checked + 3;

  -- ---------------------------------------------------------------------------
  -- 5. 分類建議：規則優先，其次店家記憶
  -- ---------------------------------------------------------------------------
  select * into suggestion from public.suggest_category(l1, '全家便利商店', '12345678');
  if suggestion.source is distinct from 'history' or suggestion.category_id <> food or suggestion.account_id <> cash then
    raise exception 'FAIL 店家記憶建議不對：%', suggestion;
  end if;
  insert into public.category_rules (ledger_id, pattern, category_id, account_id, sort_order) values (l1, '全家', traffic, bank, 10);
  select * into suggestion from public.suggest_category(l1, '台北全家便利商店', '12345678');
  if suggestion.source is distinct from 'rule' or suggestion.category_id <> traffic or suggestion.account_id <> bank then
    raise exception 'FAIL 規則應該優先：%', suggestion;
  end if;
  select count(*) into n from public.suggest_category(l1, '沒見過的店', '87654321');
  if n <> 0 then raise exception 'FAIL 沒見過的店不該有建議'; end if;
  checked := checked + 3;

  -- ---------------------------------------------------------------------------
  -- 6. 去重與欄位檢查
  -- ---------------------------------------------------------------------------
  begin
    insert into public.inbox_items (ledger_id, source, entry_date, amount, invoice_no) values (l1, 'invoice_csv', current_date, 300, 'AB12345678');
    raise exception 'FAIL 同一張發票可以放進兩次';
  exception when unique_violation then
    checked := checked + 1;
  end;
  begin
    insert into public.recurring_rules (ledger_id, name, amount, from_account_id, frequency, day_of_month, next_date)
    values (l1, '缺類別', 100, cash, 'monthly', 1, current_date);
    raise exception 'FAIL 固定支出缺類別沒被擋';
  exception when check_violation then
    checked := checked + 1;
  end;
  begin
    insert into public.recurring_rules (ledger_id, name, kind, amount, from_account_id, to_account_id, frequency, weekday, next_date)
    values (l1, '轉給自己', 'transfer', 100, cash, cash, 'weekly', 1, current_date);
    raise exception 'FAIL 轉帳兩邊相同沒被擋';
  exception when check_violation then
    checked := checked + 1;
  end;
  begin
    insert into public.recurring_rules (ledger_id, name, kind, amount, to_account_id, category_id, frequency, day_of_month, next_date)
    values (l1, '收入掛費用類別', 'income', 100, bank, food, 'monthly', 1, current_date);
    raise exception 'FAIL 固定收入掛費用類別沒被擋';
  exception when check_violation then
    checked := checked + 1;
  end;
  -- 固定收入：確認後是收入交易
  insert into public.recurring_rules (ledger_id, name, kind, amount, to_account_id, category_id, frequency, day_of_month, next_date)
  values (l1, '薪水', 'income', 50000, bank, salary, 'monthly', 10, date '2026-11-01') returning id into pay;
  perform public.generate_recurring_items(l1, date '2026-11-18');
  select id into item from public.inbox_items where recurring_rule_id = pay;
  ids := public.confirm_inbox_item(item, jsonb_build_object('to_account_id', bank,
           'splits', jsonb_build_array(jsonb_build_object('category_id', salary, 'amount', 50000))));
  select count(*) into n from public.entries where id = ids[1] and kind = 'income' and to_account_id = bank and category_id = salary;
  if n <> 1 then raise exception 'FAIL 固定收入確認後不是收入交易'; end if;
  checked := checked + 1;

  set constraints all immediate;
  raise exception 'ALL_OK（% 項檢查通過，已回滾）', checked;
end $$;
