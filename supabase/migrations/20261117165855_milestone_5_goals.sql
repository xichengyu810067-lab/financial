-- 里程碑 5（PR B 儲蓄目標）：目標封存／達標日／排序、手動存入表、進度函式
--   * 綁帳戶的目標：進度 = 該資產帳戶截至當日餘額；手動目標：進度 = 存入合計（二選一）
--   * goal_progress(p_ledger, p_as_of) 回傳 saved 與最近 90 天的增加 saved_90d，預測在前端算

alter table public.goals
  add column if not exists is_archived boolean not null default false,
  add column if not exists achieved_at date,
  add column if not exists sort_order integer not null default 0;

comment on column public.goals.is_archived is '封存後不在今天這一頁與封面出現';
comment on column public.goals.achieved_at is '第一次達到目標金額的日期；之後餘額變動也不清掉';

-- 讓存入表可以用 (goal_id, ledger_id) 複合外鍵，保證存入與目標在同一本帳本
alter table public.goals
  add constraint goals_id_ledger_key unique (id, ledger_id);

-- 綁定的帳戶必須是同一本帳本的資產帳戶
create or replace function public.validate_goal_account()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.account_id is not null and not exists (
    select 1 from public.accounts a
     where a.id = new.account_id and a.ledger_id = new.ledger_id and a.type = 'asset'
  ) then
    raise exception '目標只能綁定這本帳本的資產帳戶' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke execute on function public.validate_goal_account() from public, anon, authenticated;

create trigger goals_validate_account
  before insert or update of account_id, ledger_id on public.goals
  for each row execute function public.validate_goal_account();

create table public.goal_deposits (
  id           uuid primary key default gen_random_uuid(),
  ledger_id    uuid not null references public.ledgers (id) on delete cascade,
  goal_id      uuid not null,
  amount       numeric(14, 2) not null check (amount > 0),
  deposit_date date not null default current_date,
  note         text,
  created_at   timestamptz not null default now(),
  foreign key (goal_id, ledger_id) references public.goals (id, ledger_id) on delete cascade
);
create index goal_deposits_goal_date_idx on public.goal_deposits (goal_id, deposit_date);
create index goal_deposits_ledger_idx on public.goal_deposits (ledger_id);
comment on table public.goal_deposits is '手動儲蓄目標的存入紀錄；綁帳戶的目標不能手動存入';

alter table public.goal_deposits enable row level security;

create policy "goal_deposits: 帳本擁有者" on public.goal_deposits
  for all to authenticated
  using (public.is_ledger_owner(ledger_id))
  with check (public.is_ledger_owner(ledger_id));

-- 綁了帳戶的目標不收手動存入
create or replace function public.validate_goal_deposit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if exists (select 1 from public.goals g where g.id = new.goal_id and g.account_id is not null) then
    raise exception '這個目標綁定了帳戶，進度看帳戶餘額，不能手動存入' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke execute on function public.validate_goal_deposit() from public, anon, authenticated;

create trigger goal_deposits_validate
  before insert or update of goal_id on public.goal_deposits
  for each row execute function public.validate_goal_deposit();

-- 每個目標截至某天的進度
create or replace function public.goal_progress(p_ledger uuid, p_as_of date)
returns table (
  goal_id uuid,
  saved numeric,
  saved_90d numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  with g as (
    select id, account_id from public.goals where ledger_id = p_ledger
  ),
  acct as (
    select l.account_id,
           coalesce(sum(l.debit - l.credit), 0) as bal_now,
           coalesce(sum(l.debit - l.credit) filter (where e.entry_date <= p_as_of - 90), 0) as bal_then
      from public.entry_lines l
      join public.entries e on e.id = l.entry_id
     where l.ledger_id = p_ledger
       and e.entry_date <= p_as_of
       and l.account_id in (select account_id from g where account_id is not null)
     group by l.account_id
  ),
  dep as (
    select d.goal_id,
           sum(d.amount) as total,
           coalesce(sum(d.amount) filter (where d.deposit_date > p_as_of - 90), 0) as recent
      from public.goal_deposits d
     where d.ledger_id = p_ledger
       and d.deposit_date <= p_as_of
     group by d.goal_id
  )
  select g.id,
         (case when g.account_id is null then coalesce(dep.total, 0) else coalesce(acct.bal_now, 0) end)::numeric(14, 2),
         (case when g.account_id is null then coalesce(dep.recent, 0) else coalesce(acct.bal_now, 0) - coalesce(acct.bal_then, 0) end)::numeric(14, 2)
    from g
    left join acct on acct.account_id = g.account_id
    left join dep on dep.goal_id = g.id
$$;
revoke execute on function public.goal_progress(uuid, date) from public, anon;
grant  execute on function public.goal_progress(uuid, date) to authenticated;
