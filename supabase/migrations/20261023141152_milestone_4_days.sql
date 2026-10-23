-- 里程碑 4（PR B 一天一頁與警示）：類別每月基準線、每日摘要、類別支出統計
alter table public.accounts
  add column if not exists monthly_budget numeric(14, 2)
  check (monthly_budget is null or monthly_budget >= 0);

comment on column public.accounts.monthly_budget is '費用類別的每月基準線（花過頭警示的尺）；null = 未設定';

-- -----------------------------------------------------------------------------
-- 每日摘要：每一天的收入、支出與筆數（以交易計算，與交易頁一致；不含期初餘額）
-- -----------------------------------------------------------------------------
create or replace function public.daily_summary(p_ledger uuid, p_from date, p_to date)
returns table (day date, income numeric, expense numeric, entry_count integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select e.entry_date,
         coalesce(sum(case when e.kind = 'income' then e.amount end), 0)::numeric(14, 2),
         coalesce(sum(case when e.kind = 'expense' then e.amount end), 0)::numeric(14, 2),
         (count(*) filter (where e.kind <> 'opening'))::integer
    from public.entries e
   where e.ledger_id = p_ledger
     and e.entry_date between p_from and p_to
   group by e.entry_date
   order by e.entry_date
$$;
revoke execute on function public.daily_summary(uuid, date, date) from public, anon;
grant  execute on function public.daily_summary(uuid, date, date) to authenticated;

-- -----------------------------------------------------------------------------
-- 類別支出統計（截至 p_as_of 那天）：供「花過頭」判斷
--   month_to_date / month_count：p_as_of 所在月份 1 日到 p_as_of 的支出與筆數
--   prev3_avg / prev3_months：前三個完整月的平均月支出（總和 ÷ 3）與有支出的月數
--   recent_avg_entry / recent_count：p_as_of 前 90 天（不含當天）的平均單筆與筆數
--   子類別各自一列，父類別含子類別的彙總由前端做。
-- -----------------------------------------------------------------------------
create or replace function public.category_spending_stats(p_ledger uuid, p_as_of date)
returns table (
  account_id uuid,
  parent_id uuid,
  name text,
  icon text,
  color text,
  is_archived boolean,
  sort_order integer,
  monthly_budget numeric,
  month_to_date numeric,
  month_count integer,
  prev3_avg numeric,
  prev3_months integer,
  recent_avg_entry numeric,
  recent_count integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  with bounds as (
    select date_trunc('month', p_as_of)::date as month_start,
           (date_trunc('month', p_as_of) - interval '3 months')::date as prev_start,
           (p_as_of - interval '90 days')::date as recent_start
  ),
  ex as (
    select e.category_id, e.entry_date, e.amount
      from public.entries e
     where e.ledger_id = p_ledger
       and e.kind = 'expense'
       and e.category_id is not null
       and e.entry_date >= (select least(prev_start, recent_start) from bounds)
       and e.entry_date <= p_as_of
  )
  select a.id,
         a.parent_id,
         a.name,
         a.icon,
         a.color,
         a.is_archived,
         a.sort_order,
         a.monthly_budget,
         coalesce(sum(ex.amount) filter (where ex.entry_date >= b.month_start), 0)::numeric(14, 2),
         (count(ex.amount) filter (where ex.entry_date >= b.month_start))::integer,
         (coalesce(sum(ex.amount) filter (where ex.entry_date >= b.prev_start and ex.entry_date < b.month_start), 0) / 3)::numeric(14, 2),
         (count(distinct date_trunc('month', ex.entry_date)) filter (where ex.entry_date >= b.prev_start and ex.entry_date < b.month_start))::integer,
         coalesce(avg(ex.amount) filter (where ex.entry_date >= b.recent_start and ex.entry_date < p_as_of), 0)::numeric(14, 2),
         (count(ex.amount) filter (where ex.entry_date >= b.recent_start and ex.entry_date < p_as_of))::integer
    from public.accounts a
    cross join bounds b
    left join ex on ex.category_id = a.id
   where a.ledger_id = p_ledger
     and a.type = 'expense'
   group by a.id, b.month_start, b.prev_start, b.recent_start
$$;
revoke execute on function public.category_spending_stats(uuid, date) from public, anon;
grant  execute on function public.category_spending_stats(uuid, date) to authenticated;
