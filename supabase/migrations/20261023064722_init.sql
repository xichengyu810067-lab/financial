-- =============================================================================
-- 0001_init.sql — 互動式財報記帳平台 初始資料結構
--
-- 設計重點
--   * 使用者只輸入「簡易交易」(entries)：收入 / 支出 / 轉帳 / 期初餘額。
--   * 系統依交易種類產生借貸平衡的「分錄明細」(entry_lines)。
--   * 「帳戶」(資產 / 負債) 與「類別」(收入 / 費用) 都是會計科目 (accounts)。
--   * 所有資料表皆以 ledger_id 隔離並啟用 RLS，只有帳本擁有者能讀寫。
--   * 借貸平衡由 deferrable constraint trigger 在 commit 時強制檢查。
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 列舉型別
-- -----------------------------------------------------------------------------
create type public.account_type as enum ('asset', 'liability', 'equity', 'revenue', 'expense');
create type public.entry_kind   as enum ('income', 'expense', 'transfer', 'opening', 'adjustment');

-- -----------------------------------------------------------------------------
-- 使用者資料
-- -----------------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at   timestamptz not null default now()
);
comment on table public.profiles is '使用者基本資料，id 對應 auth.users.id';

-- 新使用者註冊時自動建立 profile
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 帳本
-- -----------------------------------------------------------------------------
create table public.ledgers (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null,
  currency   char(3) not null default 'TWD',
  created_at timestamptz not null default now()
);
create index ledgers_owner_idx on public.ledgers (owner_id);
comment on table public.ledgers is '帳本；一個使用者可擁有多個帳本（例如個人、家庭）';

-- -----------------------------------------------------------------------------
-- 會計科目（使用者看到的「帳戶」與「類別」）
-- -----------------------------------------------------------------------------
create table public.accounts (
  id          uuid primary key default gen_random_uuid(),
  ledger_id   uuid not null references public.ledgers (id) on delete cascade,
  name        text not null,
  type        public.account_type not null,
  subtype     text,                      -- cash / bank / ewallet / investment / credit_card / opening_balance / 自訂
  icon        text,
  color       text,
  is_system   boolean not null default false,   -- 系統科目（如期初餘額）不可刪除
  is_archived boolean not null default false,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  unique (ledger_id, name)
);
create index accounts_ledger_idx on public.accounts (ledger_id);
comment on table public.accounts is '會計科目：asset/liability = 帳戶；revenue/expense = 類別；equity = 權益';

-- -----------------------------------------------------------------------------
-- 交易（使用者輸入的簡易表單）
-- -----------------------------------------------------------------------------
create table public.entries (
  id              uuid primary key default gen_random_uuid(),
  ledger_id       uuid not null references public.ledgers (id) on delete cascade,
  kind            public.entry_kind not null,
  entry_date      date not null,
  amount          numeric(14, 2) not null check (amount > 0),
  from_account_id uuid references public.accounts (id),   -- 資金來源（支出 / 轉帳）
  to_account_id   uuid references public.accounts (id),   -- 資金去向（收入 / 轉帳 / 期初）
  category_id     uuid references public.accounts (id),   -- 收入 / 費用科目
  memo            text,
  created_by      uuid not null default auth.uid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index entries_ledger_date_idx on public.entries (ledger_id, entry_date desc);
comment on table public.entries is '交易；每筆交易對應一組借貸平衡的 entry_lines';

-- -----------------------------------------------------------------------------
-- 分錄明細（複式簿記的借 / 貸行）
-- -----------------------------------------------------------------------------
create table public.entry_lines (
  id         uuid primary key default gen_random_uuid(),
  entry_id   uuid not null references public.entries (id) on delete cascade,
  ledger_id  uuid not null references public.ledgers (id) on delete cascade,
  account_id uuid not null references public.accounts (id),
  debit      numeric(14, 2) not null default 0 check (debit >= 0),
  credit     numeric(14, 2) not null default 0 check (credit >= 0),
  check (debit = 0 or credit = 0),
  check (debit > 0 or credit > 0)
);
create index entry_lines_entry_idx on public.entry_lines (entry_id);
create index entry_lines_ledger_account_idx on public.entry_lines (ledger_id, account_id);
comment on table public.entry_lines is '分錄明細；同一 entry 的 Σdebit 必須等於 Σcredit';

-- -----------------------------------------------------------------------------
-- 預算與目標
-- -----------------------------------------------------------------------------
create table public.budgets (
  id          uuid primary key default gen_random_uuid(),
  ledger_id   uuid not null references public.ledgers (id) on delete cascade,
  category_id uuid not null references public.accounts (id) on delete cascade,
  month       date not null check (extract(day from month) = 1),   -- 每月 1 日代表該月
  amount      numeric(14, 2) not null check (amount >= 0),
  created_at  timestamptz not null default now(),
  unique (ledger_id, category_id, month)
);
comment on table public.budgets is '每月類別預算';

create table public.goals (
  id            uuid primary key default gen_random_uuid(),
  ledger_id     uuid not null references public.ledgers (id) on delete cascade,
  name          text not null,
  target_amount numeric(14, 2) not null check (target_amount > 0),
  target_date   date,
  account_id    uuid references public.accounts (id) on delete set null,  -- 連結的儲蓄帳戶（可空）
  note          text,
  created_at    timestamptz not null default now()
);
comment on table public.goals is '儲蓄目標';

-- -----------------------------------------------------------------------------
-- 共用觸發函式
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

create trigger entries_set_updated_at
  before update on public.entries
  for each row execute function public.set_updated_at();

-- 交易的參照檢查：各科目必須屬於同一帳本，且依交易種類具備必要欄位
create or replace function public.check_entry_refs()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_from_ledger uuid;
  v_to_ledger   uuid;
  v_cat_ledger  uuid;
  v_cat_type    public.account_type;
begin
  if new.from_account_id is not null then
    select ledger_id into v_from_ledger from public.accounts where id = new.from_account_id;
    if v_from_ledger is distinct from new.ledger_id then
      raise exception '來源帳戶不屬於此帳本' using errcode = '23514';
    end if;
  end if;

  if new.to_account_id is not null then
    select ledger_id into v_to_ledger from public.accounts where id = new.to_account_id;
    if v_to_ledger is distinct from new.ledger_id then
      raise exception '去向帳戶不屬於此帳本' using errcode = '23514';
    end if;
  end if;

  if new.category_id is not null then
    select ledger_id, type into v_cat_ledger, v_cat_type from public.accounts where id = new.category_id;
    if v_cat_ledger is distinct from new.ledger_id then
      raise exception '類別不屬於此帳本' using errcode = '23514';
    end if;
    if v_cat_type not in ('revenue', 'expense') then
      raise exception '類別必須是收入或費用科目' using errcode = '23514';
    end if;
  end if;

  case new.kind
    when 'expense' then
      if new.from_account_id is null or new.category_id is null then
        raise exception '支出需要來源帳戶與費用類別' using errcode = '23514';
      end if;
    when 'income' then
      if new.to_account_id is null or new.category_id is null then
        raise exception '收入需要去向帳戶與收入類別' using errcode = '23514';
      end if;
    when 'transfer' then
      if new.from_account_id is null or new.to_account_id is null then
        raise exception '轉帳需要來源與去向帳戶' using errcode = '23514';
      end if;
      if new.from_account_id = new.to_account_id then
        raise exception '轉帳的來源與去向帳戶不能相同' using errcode = '23514';
      end if;
    when 'opening' then
      if new.to_account_id is null then
        raise exception '期初餘額需要指定帳戶' using errcode = '23514';
      end if;
    else
      null;  -- adjustment：手動分錄，不限制欄位
  end case;

  return new;
end;
$$;
revoke execute on function public.check_entry_refs() from public, anon, authenticated;

create trigger entries_check_refs
  before insert or update on public.entries
  for each row execute function public.check_entry_refs();

-- 分錄行的參照檢查：科目與交易都必須屬於同一帳本
create or replace function public.check_line_refs()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_acc_ledger   uuid;
  v_entry_ledger uuid;
begin
  select ledger_id into v_acc_ledger from public.accounts where id = new.account_id;
  if v_acc_ledger is distinct from new.ledger_id then
    raise exception '分錄科目不屬於此帳本' using errcode = '23514';
  end if;
  select ledger_id into v_entry_ledger from public.entries where id = new.entry_id;
  if v_entry_ledger is distinct from new.ledger_id then
    raise exception '分錄行與交易不屬於同一帳本' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke execute on function public.check_line_refs() from public, anon, authenticated;

create trigger entry_lines_check_refs
  before insert or update on public.entry_lines
  for each row execute function public.check_line_refs();

-- 借貸平衡檢查（供 trigger 與 save_entry 共用）
create or replace function public.assert_entry_balanced(p_entry_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_debit  numeric;
  v_credit numeric;
  v_count  integer;
begin
  -- 交易已被刪除（cascade）時不需檢查
  if not exists (select 1 from public.entries where id = p_entry_id) then
    return;
  end if;

  select coalesce(sum(debit), 0), coalesce(sum(credit), 0), count(*)
    into v_debit, v_credit, v_count
    from public.entry_lines
   where entry_id = p_entry_id;

  if v_count < 2 then
    raise exception '分錄至少需要兩行（entry %）', p_entry_id using errcode = '23514';
  end if;
  if v_debit <> v_credit then
    raise exception '借貸不平衡：借方 % ≠ 貸方 %（entry %）', v_debit, v_credit, p_entry_id using errcode = '23514';
  end if;
end;
$$;
revoke execute on function public.assert_entry_balanced(uuid) from public, anon, authenticated;

create or replace function public.trg_lines_balanced()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform public.assert_entry_balanced(coalesce(new.entry_id, old.entry_id));
  return null;
end;
$$;
revoke execute on function public.trg_lines_balanced() from public, anon, authenticated;

create or replace function public.trg_entry_balanced()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform public.assert_entry_balanced(new.id);
  return null;
end;
$$;
revoke execute on function public.trg_entry_balanced() from public, anon, authenticated;

-- commit 時才檢查，讓 save_entry 能先刪舊行再插新行
create constraint trigger entry_lines_balanced
  after insert or update or delete on public.entry_lines
  deferrable initially deferred
  for each row execute function public.trg_lines_balanced();

create constraint trigger entries_balanced
  after insert on public.entries
  deferrable initially deferred
  for each row execute function public.trg_entry_balanced();

-- -----------------------------------------------------------------------------
-- RLS（Row Level Security）
-- -----------------------------------------------------------------------------
create or replace function public.is_ledger_owner(p_ledger_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.ledgers l
     where l.id = p_ledger_id
       and l.owner_id = (select auth.uid())
  );
$$;

alter table public.profiles    enable row level security;
alter table public.ledgers     enable row level security;
alter table public.accounts    enable row level security;
alter table public.entries     enable row level security;
alter table public.entry_lines enable row level security;
alter table public.budgets     enable row level security;
alter table public.goals       enable row level security;

create policy "profiles: 本人" on public.profiles
  for all to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "ledgers: 擁有者" on public.ledgers
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "accounts: 帳本擁有者" on public.accounts
  for all to authenticated
  using (public.is_ledger_owner(ledger_id))
  with check (public.is_ledger_owner(ledger_id));

create policy "entries: 帳本擁有者" on public.entries
  for all to authenticated
  using (public.is_ledger_owner(ledger_id))
  with check (public.is_ledger_owner(ledger_id));

create policy "entry_lines: 帳本擁有者" on public.entry_lines
  for all to authenticated
  using (public.is_ledger_owner(ledger_id))
  with check (public.is_ledger_owner(ledger_id));

create policy "budgets: 帳本擁有者" on public.budgets
  for all to authenticated
  using (public.is_ledger_owner(ledger_id))
  with check (public.is_ledger_owner(ledger_id));

create policy "goals: 帳本擁有者" on public.goals
  for all to authenticated
  using (public.is_ledger_owner(ledger_id))
  with check (public.is_ledger_owner(ledger_id));

-- -----------------------------------------------------------------------------
-- RPC：建立帳本並附上預設科目表
-- -----------------------------------------------------------------------------
create or replace function public.create_ledger_with_defaults(p_name text default '我的帳本')
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_ledger_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception '需要登入' using errcode = '42501';
  end if;

  insert into public.ledgers (owner_id, name)
  values ((select auth.uid()), coalesce(nullif(trim(p_name), ''), '我的帳本'))
  returning id into v_ledger_id;

  insert into public.accounts (ledger_id, name, type, subtype, is_system, sort_order) values
    -- 資產（帳戶）
    (v_ledger_id, '現金',     'asset',     'cash',            false, 10),
    (v_ledger_id, '銀行存款', 'asset',     'bank',            false, 20),
    (v_ledger_id, '電子支付', 'asset',     'ewallet',         false, 30),
    (v_ledger_id, '投資',     'asset',     'investment',      false, 40),
    -- 負債（帳戶）
    (v_ledger_id, '信用卡',   'liability', 'credit_card',     false, 50),
    -- 權益（系統）
    (v_ledger_id, '期初餘額', 'equity',    'opening_balance', true,  60),
    -- 收入（類別）
    (v_ledger_id, '薪資',     'revenue',   null, false, 100),
    (v_ledger_id, '獎金',     'revenue',   null, false, 110),
    (v_ledger_id, '投資收益', 'revenue',   null, false, 120),
    (v_ledger_id, '其他收入', 'revenue',   null, false, 190),
    -- 費用（類別）
    (v_ledger_id, '飲食',     'expense',   null, false, 200),
    (v_ledger_id, '交通',     'expense',   null, false, 210),
    (v_ledger_id, '居住',     'expense',   null, false, 220),
    (v_ledger_id, '水電網路', 'expense',   null, false, 230),
    (v_ledger_id, '購物',     'expense',   null, false, 240),
    (v_ledger_id, '娛樂',     'expense',   null, false, 250),
    (v_ledger_id, '醫療',     'expense',   null, false, 260),
    (v_ledger_id, '教育',     'expense',   null, false, 270),
    (v_ledger_id, '保險',     'expense',   null, false, 280),
    (v_ledger_id, '其他支出', 'expense',   null, false, 290);

  return v_ledger_id;
end;
$$;
revoke execute on function public.create_ledger_with_defaults(text) from public, anon;
grant  execute on function public.create_ledger_with_defaults(text) to authenticated;

-- -----------------------------------------------------------------------------
-- RPC：新增 / 更新交易與分錄（單一資料庫交易內完成）
--   p_entry: { id?, ledger_id, kind, entry_date, amount, from_account_id?, to_account_id?, category_id?, memo? }
--   p_lines: [ { account_id, debit, credit }, ... ]
-- -----------------------------------------------------------------------------
create or replace function public.save_entry(p_entry jsonb, p_lines jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id     uuid;
  v_ledger uuid := (p_entry ->> 'ledger_id')::uuid;
begin
  if v_ledger is null then
    raise exception 'ledger_id 必填' using errcode = '22023';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) < 2 then
    raise exception '分錄至少需要兩行' using errcode = '22023';
  end if;

  if nullif(p_entry ->> 'id', '') is not null then
    v_id := (p_entry ->> 'id')::uuid;
    update public.entries set
      kind            = (p_entry ->> 'kind')::public.entry_kind,
      entry_date      = (p_entry ->> 'entry_date')::date,
      amount          = (p_entry ->> 'amount')::numeric,
      from_account_id = nullif(p_entry ->> 'from_account_id', '')::uuid,
      to_account_id   = nullif(p_entry ->> 'to_account_id', '')::uuid,
      category_id     = nullif(p_entry ->> 'category_id', '')::uuid,
      memo            = p_entry ->> 'memo'
    where id = v_id and ledger_id = v_ledger;
    if not found then
      raise exception '找不到交易 %', v_id using errcode = 'P0002';
    end if;
    delete from public.entry_lines where entry_id = v_id;
  else
    insert into public.entries
      (ledger_id, kind, entry_date, amount, from_account_id, to_account_id, category_id, memo)
    values
      (v_ledger,
       (p_entry ->> 'kind')::public.entry_kind,
       (p_entry ->> 'entry_date')::date,
       (p_entry ->> 'amount')::numeric,
       nullif(p_entry ->> 'from_account_id', '')::uuid,
       nullif(p_entry ->> 'to_account_id', '')::uuid,
       nullif(p_entry ->> 'category_id', '')::uuid,
       p_entry ->> 'memo')
    returning id into v_id;
  end if;

  insert into public.entry_lines (entry_id, ledger_id, account_id, debit, credit)
  select v_id,
         v_ledger,
         (l ->> 'account_id')::uuid,
         coalesce((l ->> 'debit')::numeric, 0),
         coalesce((l ->> 'credit')::numeric, 0)
    from jsonb_array_elements(p_lines) as l;

  -- 立即檢查平衡；constraint trigger 於 commit 時會再檢查一次
  perform public.assert_entry_balanced(v_id);

  return v_id;
end;
$$;
revoke execute on function public.save_entry(jsonb, jsonb) from public, anon;
grant  execute on function public.save_entry(jsonb, jsonb) to authenticated;
