-- 里程碑 4（PR D 圖表）：每個月底的淨值（資產 − 負債），給年度封底的淨值走勢用
create or replace function public.net_worth_by_month(p_ledger uuid, p_from date, p_to date)
returns table (month text, net_worth numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  with months as (
    select generate_series(date_trunc('month', p_from)::date, date_trunc('month', p_to)::date, interval '1 month')::date as month_start
  ),
  ends as (
    select month_start, (month_start + interval '1 month' - interval '1 day')::date as month_end from months
  ),
  balances as (
    select a.id as account_id,
           a.type,
           e.entry_date,
           case when a.type = 'asset' then l.debit - l.credit
                when a.type = 'liability' then l.credit - l.debit
                else 0 end as delta
      from public.entry_lines l
      join public.entries e on e.id = l.entry_id
      join public.accounts a on a.id = l.account_id
     where l.ledger_id = p_ledger
       and a.type in ('asset', 'liability')
  )
  select to_char(ends.month_start, 'YYYY-MM'),
         coalesce(sum(b.delta) filter (where b.entry_date <= ends.month_end), 0)::numeric(14, 2)
    from ends
    left join balances b on b.entry_date <= ends.month_end
   group by ends.month_start
   order by ends.month_start
$$;
revoke execute on function public.net_worth_by_month(uuid, date, date) from public, anon;
grant  execute on function public.net_worth_by_month(uuid, date, date) to authenticated;
