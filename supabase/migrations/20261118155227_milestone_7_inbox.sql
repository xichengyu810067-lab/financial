-- 里程碑 7 PR A：待確認匣、固定支出、自動分類規則、店家記憶
-- 發票（PR B／C）與固定支出到期都先變成 inbox_items，使用者確認後才由 confirm_inbox_item 入帳。

-- -----------------------------------------------------------------------------
-- 共用小函式
-- -----------------------------------------------------------------------------

-- 某年某月的第 d 天；超過月底就落在月底（31 號在二月 = 28／29 號）
create or replace function public.month_day(p_year integer, p_month integer, p_day integer)
returns date
language sql
immutable
set search_path = ''
as $$
  select make_date(p_year, p_month,
    least(p_day, extract(day from (make_date(p_year, p_month, 1) + interval '1 month - 1 day'))::integer));
$$;

-- 週期在 p_from 當天或之後的第一個日期。weekly：星期幾（0 = 週日）；monthly：每月第幾天；yearly：每年幾月幾日
create or replace function public.recurrence_on_or_after(p_frequency text, p_day integer, p_weekday integer, p_month integer, p_from date)
returns date
language plpgsql
immutable
set search_path = ''
as $$
declare
  v date;
  v_next date;
begin
  if p_frequency = 'weekly' then
    return p_from + ((p_weekday - extract(dow from p_from)::integer + 7) % 7);
  elsif p_frequency = 'monthly' then
    v := public.month_day(extract(year from p_from)::integer, extract(month from p_from)::integer, p_day);
    if v >= p_from then
      return v;
    end if;
    v_next := (date_trunc('month', p_from) + interval '1 month')::date;
    return public.month_day(extract(year from v_next)::integer, extract(month from v_next)::integer, p_day);
  elsif p_frequency = 'yearly' then
    v := public.month_day(extract(year from p_from)::integer, p_month, p_day);
    if v >= p_from then
      return v;
    end if;
    return public.month_day(extract(year from p_from)::integer + 1, p_month, p_day);
  end if;
  raise exception '不支援的週期：%', p_frequency using errcode = '22023';
end;
$$;

-- 店家識別：有統編用統編，沒有就用小寫店名
create or replace function public.merchant_key(p_name text, p_seller_ban text)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(nullif(trim(p_seller_ban), ''), nullif(lower(trim(p_name)), ''));
$$;

-- 科目是否屬於這本帳本且是指定類型（null 視為通過；RLS 下看不到別人的科目，自然回 false）
create or replace function public.account_in_ledger(p_account uuid, p_ledger uuid, p_types public.account_type[])
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_account is null
      or exists (select 1 from public.accounts a where a.id = p_account and a.ledger_id = p_ledger and a.type = any (p_types));
$$;

-- -----------------------------------------------------------------------------
-- 交易記住來自哪張發票（拆成多筆時同一張發票會有多筆交易，所以不設 unique）
-- -----------------------------------------------------------------------------
alter table public.entries add column invoice_no text;
create index entries_invoice_no_idx on public.entries (ledger_id, invoice_no) where invoice_no is not null;

-- -----------------------------------------------------------------------------
-- 固定支出（也可以是固定收入或轉帳）
-- -----------------------------------------------------------------------------
create table public.recurring_rules (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid not null references public.ledgers (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 30),
  kind public.entry_kind not null default 'expense' check (kind in ('expense', 'income', 'transfer')),
  amount numeric(14, 2) not null check (amount > 0),
  amount_varies boolean not null default false,
  from_account_id uuid references public.accounts (id) on delete cascade,
  to_account_id uuid references public.accounts (id) on delete cascade,
  category_id uuid references public.accounts (id) on delete cascade,
  memo text check (memo is null or char_length(memo) <= 100),
  frequency text not null check (frequency in ('monthly', 'weekly', 'yearly')),
  day_of_month integer check (day_of_month between 1 and 31),
  weekday integer check (weekday between 0 and 6),
  month_of_year integer check (month_of_year between 1 and 12),
  next_date date not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint recurring_rules_schedule check (
    (frequency = 'weekly' and weekday is not null)
    or (frequency = 'monthly' and day_of_month is not null)
    or (frequency = 'yearly' and day_of_month is not null and month_of_year is not null)
  )
);
create index recurring_rules_due_idx on public.recurring_rules (ledger_id, next_date) where is_active;

create or replace function public.validate_recurring_rule()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.kind = 'expense' and (new.from_account_id is null or new.category_id is null) then
    raise exception '固定支出需要付款帳戶與類別' using errcode = '23514';
  elsif new.kind = 'income' and (new.to_account_id is null or new.category_id is null) then
    raise exception '固定收入需要存入帳戶與類別' using errcode = '23514';
  elsif new.kind = 'transfer' and (new.from_account_id is null or new.to_account_id is null or new.from_account_id = new.to_account_id) then
    raise exception '固定轉帳需要兩個不同的帳戶' using errcode = '23514';
  end if;
  if new.kind = 'expense' then new.to_account_id := null; end if;
  if new.kind = 'income' then new.from_account_id := null; end if;
  if new.kind = 'transfer' then new.category_id := null; end if;

  if not public.account_in_ledger(new.from_account_id, new.ledger_id, array['asset', 'liability']::public.account_type[])
     or not public.account_in_ledger(new.to_account_id, new.ledger_id, array['asset', 'liability']::public.account_type[])
     or not public.account_in_ledger(new.category_id, new.ledger_id,
          case when new.kind = 'income' then array['revenue']::public.account_type[] else array['expense']::public.account_type[] end) then
    raise exception '固定支出的帳戶或類別不屬於這本帳本' using errcode = '23514';
  end if;

  -- 新增或改了週期時，下次日期對齊到週期上
  if tg_op = 'INSERT'
     or new.frequency is distinct from old.frequency or new.day_of_month is distinct from old.day_of_month
     or new.weekday is distinct from old.weekday or new.month_of_year is distinct from old.month_of_year
     or new.next_date is distinct from old.next_date then
    new.next_date := public.recurrence_on_or_after(new.frequency, new.day_of_month, new.weekday, new.month_of_year, new.next_date);
  end if;
  return new;
end;
$$;

create trigger recurring_rules_validate
  before insert or update on public.recurring_rules
  for each row execute function public.validate_recurring_rule();

-- -----------------------------------------------------------------------------
-- 自動分類規則：店名包含 pattern → 類別（與付款帳戶）
-- -----------------------------------------------------------------------------
create table public.category_rules (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid not null references public.ledgers (id) on delete cascade,
  pattern text not null check (char_length(trim(pattern)) between 1 and 30),
  category_id uuid not null references public.accounts (id) on delete cascade,
  account_id uuid references public.accounts (id) on delete set null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index category_rules_ledger_idx on public.category_rules (ledger_id, sort_order);

create or replace function public.validate_category_rule()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.account_in_ledger(new.category_id, new.ledger_id, array['revenue', 'expense']::public.account_type[])
     or not public.account_in_ledger(new.account_id, new.ledger_id, array['asset', 'liability']::public.account_type[]) then
    raise exception '規則的類別或帳戶不屬於這本帳本' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger category_rules_validate
  before insert or update on public.category_rules
  for each row execute function public.validate_category_rule();

-- -----------------------------------------------------------------------------
-- 店家記憶：同一家店上次記到哪個類別、用哪個帳戶付款（確認入帳時更新）
-- -----------------------------------------------------------------------------
create table public.merchants (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid not null references public.ledgers (id) on delete cascade,
  merchant_key text not null,
  name text,
  seller_ban text,
  last_category_id uuid references public.accounts (id) on delete set null,
  last_account_id uuid references public.accounts (id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (ledger_id, merchant_key)
);

create or replace function public.validate_merchant()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.account_in_ledger(new.last_category_id, new.ledger_id, array['revenue', 'expense']::public.account_type[])
     or not public.account_in_ledger(new.last_account_id, new.ledger_id, array['asset', 'liability']::public.account_type[]) then
    raise exception '店家記憶的類別或帳戶不屬於這本帳本' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger merchants_validate
  before insert or update on public.merchants
  for each row execute function public.validate_merchant();

-- -----------------------------------------------------------------------------
-- 待確認匣
-- -----------------------------------------------------------------------------
create table public.inbox_items (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid not null references public.ledgers (id) on delete cascade,
  source text not null check (source in ('recurring', 'invoice_qr', 'invoice_csv')),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'dismissed')),
  kind public.entry_kind not null default 'expense' check (kind in ('expense', 'income', 'transfer')),
  entry_date date not null,
  amount numeric(14, 2) not null check (amount > 0),
  from_account_id uuid references public.accounts (id) on delete set null,
  to_account_id uuid references public.accounts (id) on delete set null,
  category_id uuid references public.accounts (id) on delete set null,
  memo text check (memo is null or char_length(memo) <= 100),
  merchant_name text,
  seller_ban text check (seller_ban is null or seller_ban ~ '^[0-9]{8}$'),
  invoice_no text check (invoice_no is null or invoice_no ~ '^[A-Z]{2}[0-9]{8}$'),
  items jsonb not null default '[]' check (jsonb_typeof(items) = 'array'),
  recurring_rule_id uuid references public.recurring_rules (id) on delete cascade,
  due_date date,
  entry_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (ledger_id, invoice_no),
  unique (recurring_rule_id, due_date)
);
create index inbox_items_pending_idx on public.inbox_items (ledger_id, entry_date) where status = 'pending';

create or replace function public.validate_inbox_item()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.account_in_ledger(new.from_account_id, new.ledger_id, array['asset', 'liability']::public.account_type[])
     or not public.account_in_ledger(new.to_account_id, new.ledger_id, array['asset', 'liability']::public.account_type[])
     or not public.account_in_ledger(new.category_id, new.ledger_id, array['revenue', 'expense']::public.account_type[]) then
    raise exception '待確認項目的帳戶或類別不屬於這本帳本' using errcode = '23514';
  end if;
  if new.recurring_rule_id is not null
     and not exists (select 1 from public.recurring_rules r where r.id = new.recurring_rule_id and r.ledger_id = new.ledger_id) then
    raise exception '固定支出不屬於這本帳本' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger inbox_items_validate
  before insert or update on public.inbox_items
  for each row execute function public.validate_inbox_item();

-- -----------------------------------------------------------------------------
-- RLS：帳本擁有者才能讀寫
-- -----------------------------------------------------------------------------
alter table public.recurring_rules enable row level security;
alter table public.category_rules enable row level security;
alter table public.merchants enable row level security;
alter table public.inbox_items enable row level security;

create policy "recurring_rules: 帳本擁有者" on public.recurring_rules for all to authenticated
  using (public.is_ledger_owner(ledger_id)) with check (public.is_ledger_owner(ledger_id));
create policy "category_rules: 帳本擁有者" on public.category_rules for all to authenticated
  using (public.is_ledger_owner(ledger_id)) with check (public.is_ledger_owner(ledger_id));
create policy "merchants: 帳本擁有者" on public.merchants for all to authenticated
  using (public.is_ledger_owner(ledger_id)) with check (public.is_ledger_owner(ledger_id));
create policy "inbox_items: 帳本擁有者" on public.inbox_items for all to authenticated
  using (public.is_ledger_owner(ledger_id)) with check (public.is_ledger_owner(ledger_id));

-- -----------------------------------------------------------------------------
-- RPC：固定支出到期 → 待確認項目
-- 打開今天這一頁時呼叫（p_until = 瀏覽器的今天），錯過的期數一起補上；可重複呼叫
-- -----------------------------------------------------------------------------
create or replace function public.generate_recurring_items(p_ledger uuid, p_until date)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  r public.recurring_rules%rowtype;
  v_due date;
  v_guard integer;
  v_count integer := 0;
begin
  if not public.is_ledger_owner(p_ledger) then
    raise exception '找不到這本帳本' using errcode = '42501';
  end if;

  for r in
    select * from public.recurring_rules
     where ledger_id = p_ledger and is_active and next_date <= p_until
     for update
  loop
    v_due := r.next_date;
    v_guard := 0;
    while v_due <= p_until and v_guard < 120 loop
      insert into public.inbox_items
        (ledger_id, source, kind, entry_date, amount, from_account_id, to_account_id, category_id, memo, recurring_rule_id, due_date)
      values
        (p_ledger, 'recurring', r.kind, v_due, r.amount, r.from_account_id, r.to_account_id, r.category_id,
         coalesce(nullif(trim(r.memo), ''), r.name), r.id, v_due)
      on conflict (recurring_rule_id, due_date) do nothing;
      if found then
        v_count := v_count + 1;
      end if;
      v_due := public.recurrence_on_or_after(r.frequency, r.day_of_month, r.weekday, r.month_of_year, v_due + 1);
      v_guard := v_guard + 1;
    end loop;
    update public.recurring_rules set next_date = v_due where id = r.id;
  end loop;

  return v_count;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC：依店名／統編建議類別與帳戶：先看自訂規則，再看店家記憶
-- -----------------------------------------------------------------------------
create or replace function public.suggest_category(p_ledger uuid, p_merchant text, p_seller_ban text)
returns table (category_id uuid, account_id uuid, source text)
language sql
stable
security invoker
set search_path = ''
as $$
  select s.category_id, s.account_id, s.source
    from (
      (select r.category_id, r.account_id, 'rule'::text as source, 1 as priority, r.sort_order, r.created_at
         from public.category_rules r
        where r.ledger_id = p_ledger
          and nullif(trim(p_merchant), '') is not null
          and position(lower(trim(r.pattern)) in lower(p_merchant)) > 0)
      union all
      (select m.last_category_id, m.last_account_id, 'history'::text, 2, 0, m.updated_at
         from public.merchants m
        where m.ledger_id = p_ledger
          and m.merchant_key = public.merchant_key(p_merchant, p_seller_ban)
          and m.last_category_id is not null)
    ) s
   order by s.priority, s.sort_order, s.created_at
   limit 1;
$$;

-- -----------------------------------------------------------------------------
-- RPC：確認待確認項目 → 一到多筆交易
-- p_entry = { entry_date?, from_account_id?, to_account_id?, splits: [{ category_id?, amount, memo? }] }
-- 發票來源的拆分合計必須等於發票金額；固定支出可以改金額（例如電費）
-- -----------------------------------------------------------------------------
create or replace function public.confirm_inbox_item(p_item uuid, p_entry jsonb)
returns uuid[]
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_item public.inbox_items%rowtype;
  v_date date;
  v_from uuid := nullif(p_entry ->> 'from_account_id', '')::uuid;
  v_to uuid := nullif(p_entry ->> 'to_account_id', '')::uuid;
  v_splits jsonb := p_entry -> 'splits';
  v_split jsonb;
  v_amount numeric;
  v_cat uuid;
  v_first_cat uuid;
  v_total numeric := 0;
  v_lines jsonb;
  v_id uuid;
  v_ids uuid[] := '{}';
begin
  select * into v_item from public.inbox_items where id = p_item for update;
  if not found then
    raise exception '找不到待確認項目' using errcode = 'P0002';
  end if;
  if v_item.status <> 'pending' then
    raise exception '這筆已經處理過了' using errcode = '22023';
  end if;
  v_date := coalesce(nullif(p_entry ->> 'entry_date', '')::date, v_item.entry_date);

  if jsonb_typeof(v_splits) is distinct from 'array' or jsonb_array_length(v_splits) = 0 then
    raise exception '至少要有一筆' using errcode = '22023';
  end if;
  if v_item.kind = 'transfer' and jsonb_array_length(v_splits) <> 1 then
    raise exception '轉帳不能拆成多筆' using errcode = '22023';
  end if;
  if v_item.kind in ('expense', 'transfer') and v_from is null then
    raise exception '請選擇付款帳戶' using errcode = '22023';
  end if;
  if v_item.kind in ('income', 'transfer') and v_to is null then
    raise exception '請選擇存入帳戶' using errcode = '22023';
  end if;

  for v_split in select * from jsonb_array_elements(v_splits) loop
    v_amount := nullif(v_split ->> 'amount', '')::numeric;
    if v_amount is null or v_amount <= 0 then
      raise exception '每一筆的金額都要大於 0' using errcode = '22023';
    end if;
    if v_item.kind <> 'transfer' and nullif(v_split ->> 'category_id', '') is null then
      raise exception '每一筆都要選類別' using errcode = '22023';
    end if;
    v_total := v_total + v_amount;
  end loop;
  if v_item.source <> 'recurring' and v_total <> v_item.amount then
    raise exception '拆開的金額合計 % 要等於發票金額 %', v_total, v_item.amount using errcode = '22023';
  end if;

  for v_split in select * from jsonb_array_elements(v_splits) loop
    v_amount := (v_split ->> 'amount')::numeric;
    v_cat := nullif(v_split ->> 'category_id', '')::uuid;
    v_first_cat := coalesce(v_first_cat, v_cat);
    v_lines := case v_item.kind
      when 'expense' then jsonb_build_array(
        jsonb_build_object('account_id', v_cat, 'debit', v_amount, 'credit', 0),
        jsonb_build_object('account_id', v_from, 'debit', 0, 'credit', v_amount))
      when 'income' then jsonb_build_array(
        jsonb_build_object('account_id', v_to, 'debit', v_amount, 'credit', 0),
        jsonb_build_object('account_id', v_cat, 'debit', 0, 'credit', v_amount))
      else jsonb_build_array(
        jsonb_build_object('account_id', v_to, 'debit', v_amount, 'credit', 0),
        jsonb_build_object('account_id', v_from, 'debit', 0, 'credit', v_amount))
    end;
    v_id := public.save_entry(
      jsonb_build_object(
        'ledger_id', v_item.ledger_id,
        'kind', v_item.kind,
        'entry_date', v_date,
        'amount', v_amount,
        'from_account_id', case when v_item.kind in ('expense', 'transfer') then v_from end,
        'to_account_id', case when v_item.kind in ('income', 'transfer') then v_to end,
        'category_id', case when v_item.kind <> 'transfer' then v_cat end,
        'memo', coalesce(nullif(trim(v_split ->> 'memo'), ''), v_item.memo)),
      v_lines);
    if v_item.invoice_no is not null then
      update public.entries set invoice_no = v_item.invoice_no where id = v_id;
    end if;
    v_ids := v_ids || v_id;
  end loop;

  update public.inbox_items
     set status = 'confirmed', entry_ids = v_ids, resolved_at = now(), entry_date = v_date, amount = v_total,
         from_account_id = v_from, to_account_id = v_to, category_id = v_first_cat
   where id = p_item;

  if public.merchant_key(v_item.merchant_name, v_item.seller_ban) is not null then
    insert into public.merchants as m (ledger_id, merchant_key, name, seller_ban, last_category_id, last_account_id, updated_at)
    values (v_item.ledger_id, public.merchant_key(v_item.merchant_name, v_item.seller_ban), v_item.merchant_name, v_item.seller_ban,
            v_first_cat, coalesce(v_from, v_to), now())
    on conflict (ledger_id, merchant_key) do update
      set name = coalesce(excluded.name, m.name),
          seller_ban = coalesce(excluded.seller_ban, m.seller_ban),
          last_category_id = excluded.last_category_id,
          last_account_id = excluded.last_account_id,
          updated_at = now();
  end if;

  return v_ids;
end;
$$;

-- -----------------------------------------------------------------------------
-- 權限：新函式只給登入者
-- -----------------------------------------------------------------------------
revoke execute on function public.month_day(integer, integer, integer) from public, anon;
revoke execute on function public.recurrence_on_or_after(text, integer, integer, integer, date) from public, anon;
revoke execute on function public.merchant_key(text, text) from public, anon;
revoke execute on function public.account_in_ledger(uuid, uuid, public.account_type[]) from public, anon;
revoke execute on function public.generate_recurring_items(uuid, date) from public, anon;
revoke execute on function public.suggest_category(uuid, text, text) from public, anon;
revoke execute on function public.confirm_inbox_item(uuid, jsonb) from public, anon;
grant execute on function public.month_day(integer, integer, integer) to authenticated;
grant execute on function public.recurrence_on_or_after(text, integer, integer, integer, date) to authenticated;
grant execute on function public.merchant_key(text, text) to authenticated;
grant execute on function public.account_in_ledger(uuid, uuid, public.account_type[]) to authenticated;
grant execute on function public.generate_recurring_items(uuid, date) to authenticated;
grant execute on function public.suggest_category(uuid, text, text) to authenticated;
grant execute on function public.confirm_inbox_item(uuid, jsonb) to authenticated;
