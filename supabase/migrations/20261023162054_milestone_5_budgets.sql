-- 里程碑 5（PR A 預算）：每月總支出上限；類別統計多回傳當月覆寫的預算
alter table public.ledgers
  add column if not exists monthly_spending_limit numeric(14, 2)
  check (monthly_spending_limit is null or monthly_spending_limit >= 0);

comment on column public.ledgers.monthly_spending_limit is '每月總支出上限（跨類別）；null = 未設定';

-- 回傳欄位改變，必須先刪再建
drop function if exists public.category_spending_stats(uuid, date);

create function public.category_spending_stats(p_ledger uuid, p_as_of date)
returns table (
  account_id uuid,
  parent_id uuid,
  name text,
  icon text,
  color text,
  is_archived boolean,
  sort_order integer,
  monthly_budget numeric,
  month_budget numeric,
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
         mb.amount,
         coalesce(sum(ex.amount) filter (where ex.entry_date >= bo.month_start), 0)::numeric(14, 2),
         (count(ex.amount) filter (where ex.entry_date >= bo.month_start))::integer,
         (coalesce(sum(ex.amount) filter (where ex.entry_date >= bo.prev_start and ex.entry_date < bo.month_start), 0) / 3)::numeric(14, 2),
         (count(distinct date_trunc('month', ex.entry_date)) filter (where ex.entry_date >= bo.prev_start and ex.entry_date < bo.month_start))::integer,
         coalesce(avg(ex.amount) filter (where ex.entry_date >= bo.recent_start and ex.entry_date < p_as_of), 0)::numeric(14, 2),
         (count(ex.amount) filter (where ex.entry_date >= bo.recent_start and ex.entry_date < p_as_of))::integer
    from public.accounts a
    cross join bounds bo
    left join ex on ex.category_id = a.id
    left join public.budgets mb on mb.ledger_id = p_ledger and mb.category_id = a.id and mb.month = bo.month_start
   where a.ledger_id = p_ledger
     and a.type = 'expense'
   group by a.id, bo.month_start, bo.prev_start, bo.recent_start, mb.amount
$$;
revoke execute on function public.category_spending_stats(uuid, date) from public, anon;
grant  execute on function public.category_spending_stats(uuid, date) to authenticated;
