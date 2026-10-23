-- =============================================================================
-- 里程碑 3：三大報表的資料庫函式
--   * report_income_statement(p_ledger, p_from, p_to)：各收入／費用類別的期間金額
--   * report_balance_sheet(p_ledger, p_as_of)：各資產／負債／權益帳戶截至日餘額 + 累積損益
--   * report_cash_flow(p_ledger, p_from, p_to)：期初／期末現金與三活動流入流出
--   * monthly_summary(p_ledger, p_from, p_to)：每月收入／支出
-- 全部 security invoker：RLS 保證只看得到自己的帳本。
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 損益表
--   收入 = 貸 − 借；費用 = 借 − 貸。子類別各自一列，由前端彙總到父類別。
-- -----------------------------------------------------------------------------
create or replace function public.report_income_statement(p_ledger uuid, p_from date, p_to date)
returns table (
  account_id uuid,
  parent_id uuid,
  name text,
  type public.account_type,
  icon text,
  color text,
  sort_order integer,
  amount numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  select a.id,
         a.parent_id,
         a.name,
         a.type,
         a.icon,
         a.color,
         a.sort_order,
         coalesce(sum(case when a.type = 'revenue' then l.credit - l.debit else l.debit - l.credit end), 0)::numeric(14, 2)
    from public.accounts a
    join public.entry_lines l on l.account_id = a.id
    join public.entries e on e.id = l.entry_id
   where a.ledger_id = p_ledger
     and a.type in ('revenue', 'expense')
     and e.entry_date between p_from and p_to
   group by a.id
$$;
revoke execute on function public.report_income_statement(uuid, date, date) from public, anon;
grant  execute on function public.report_income_statement(uuid, date, date) to authenticated;

-- -----------------------------------------------------------------------------
-- 資產負債表（截至某日）
--   資產 = 借 − 貸；負債、權益 = 貸 − 借。
--   最後一列「累積損益」= 開帳以來到截至日的收入 − 費用（account_id 為 null）。
-- -----------------------------------------------------------------------------
create or replace function public.report_balance_sheet(p_ledger uuid, p_as_of date)
returns table (
  account_id uuid,
  name text,
  type public.account_type,
  subtype text,
  icon text,
  color text,
  is_system boolean,
  is_archived boolean,
  sort_order integer,
  balance numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  with bal as (
    select l.account_id, sum(l.debit) as d, sum(l.credit) as c
      from public.entry_lines l
      join public.entries e on e.id = l.entry_id
     where l.ledger_id = p_ledger
       and e.entry_date <= p_as_of
     group by l.account_id
  )
  select a.id,
         a.name,
         a.type,
         a.subtype,
         a.icon,
         a.color,
         a.is_system,
         a.is_archived,
         a.sort_order,
         coalesce(case when a.type = 'asset' then bal.d - bal.c else bal.c - bal.d end, 0)::numeric(14, 2)
    from public.accounts a
    left join bal on bal.account_id = a.id
   where a.ledger_id = p_ledger
     and a.type in ('asset', 'liability', 'equity')
  union all
  select null::uuid,
         '累積損益'::text,
         'equity'::public.account_type,
         'retained_earnings'::text,
         null::text,
         null::text,
         true,
         false,
         9999,
         coalesce(sum(case when a.type = 'revenue' then l.credit - l.debit else l.credit - l.debit end), 0)::numeric(14, 2)
    from public.accounts a
    join public.entry_lines l on l.account_id = a.id
    join public.entries e on e.id = l.entry_id
   where a.ledger_id = p_ledger
     and a.type in ('revenue', 'expense')
     and e.entry_date <= p_as_of
$$;
revoke execute on function public.report_balance_sheet(uuid, date) from public, anon;
grant  execute on function public.report_balance_sheet(uuid, date) to authenticated;

-- -----------------------------------------------------------------------------
-- 現金流量表（直接法簡化版）
--   現金及等價物 = 資產帳戶中 subtype 為 cash / bank / ewallet 者。
--   每筆交易：現金帳戶的淨變動，依金額比例分攤到該交易的非現金對方科目；
--   對方科目是收入／費用 → 營業、非現金資產 → 投資、負債／權益 → 融資。
--   現金帳戶之間的轉帳淨變動為 0，自然不列。
--   section = 'opening' / 'closing' 兩列的 inflow 欄放期初／期末現金餘額。
-- -----------------------------------------------------------------------------
create or replace function public.report_cash_flow(p_ledger uuid, p_from date, p_to date)
returns table (
  section text,
  activity text,
  account_id uuid,
  name text,
  icon text,
  color text,
  inflow numeric,
  outflow numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  with cash as (
    select id from public.accounts
     where ledger_id = p_ledger and type = 'asset' and subtype in ('cash', 'bank', 'ewallet')
  ),
  period_entries as (
    select e.id from public.entries e
     where e.ledger_id = p_ledger and e.entry_date between p_from and p_to
  ),
  cash_delta as (
    select l.entry_id, sum(l.debit - l.credit) as delta
      from public.entry_lines l
      join period_entries e on e.id = l.entry_id
     where l.account_id in (select id from cash)
     group by l.entry_id
  ),
  counterpart as (
    select l.entry_id, l.account_id, (l.debit - l.credit) as net
      from public.entry_lines l
      join period_entries e on e.id = l.entry_id
     where l.account_id not in (select id from cash)
  ),
  alloc as (
    select c.entry_id,
           c.account_id,
           cd.delta * (abs(c.net) / nullif(sum(abs(c.net)) over (partition by c.entry_id), 0)) as cash_change
      from counterpart c
      join cash_delta cd on cd.entry_id = c.entry_id
     where cd.delta <> 0
  )
  select 'flow'::text,
         case when a.type in ('revenue', 'expense') then 'operating'
              when a.type = 'asset' then 'investing'
              else 'financing' end,
         a.id,
         a.name,
         a.icon,
         a.color,
         coalesce(sum(case when alloc.cash_change > 0 then alloc.cash_change else 0 end), 0)::numeric(14, 2),
         coalesce(sum(case when alloc.cash_change < 0 then -alloc.cash_change else 0 end), 0)::numeric(14, 2)
    from alloc
    join public.accounts a on a.id = alloc.account_id
   group by a.id
  union all
  select 'opening'::text, null::text, null::uuid, '期初現金'::text, null::text, null::text,
         coalesce((select sum(l.debit - l.credit)
                     from public.entry_lines l
                     join public.entries e on e.id = l.entry_id
                    where l.account_id in (select id from cash) and e.entry_date < p_from), 0)::numeric(14, 2),
         0::numeric
  union all
  select 'closing'::text, null::text, null::uuid, '期末現金'::text, null::text, null::text,
         coalesce((select sum(l.debit - l.credit)
                     from public.entry_lines l
                     join public.entries e on e.id = l.entry_id
                    where l.account_id in (select id from cash) and e.entry_date <= p_to), 0)::numeric(14, 2),
         0::numeric
$$;
revoke execute on function public.report_cash_flow(uuid, date, date) from public, anon;
grant  execute on function public.report_cash_flow(uuid, date, date) to authenticated;

-- -----------------------------------------------------------------------------
-- 月度摘要：每月收入／支出（以分錄計算，與損益表一致）
-- -----------------------------------------------------------------------------
create or replace function public.monthly_summary(p_ledger uuid, p_from date, p_to date)
returns table (month text, income numeric, expense numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  select to_char(date_trunc('month', e.entry_date), 'YYYY-MM') as month,
         coalesce(sum(case when a.type = 'revenue' then l.credit - l.debit else 0 end), 0)::numeric(14, 2) as income,
         coalesce(sum(case when a.type = 'expense' then l.debit - l.credit else 0 end), 0)::numeric(14, 2) as expense
    from public.entry_lines l
    join public.entries e on e.id = l.entry_id
    join public.accounts a on a.id = l.account_id
   where l.ledger_id = p_ledger
     and a.type in ('revenue', 'expense')
     and e.entry_date between p_from and p_to
   group by 1
   order by 1
$$;
revoke execute on function public.monthly_summary(uuid, date, date) from public, anon;
grant  execute on function public.monthly_summary(uuid, date, date) to authenticated;
