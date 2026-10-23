-- =============================================================================
-- 里程碑 1：登入與帳本
--   * ledgers.start_date（期初餘額基準日）、profiles.onboarded_at（引導完成時間）
--   * 類別二層：accounts.parent_id 與檢查 trigger
--   * 註冊時由 trigger 自動建立帳本與預設科目（seed_ledger）
--   * account_balances 檢視表（security_invoker）
--   * RPC：set_opening_balance、complete_onboarding、move_account
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 欄位
-- -----------------------------------------------------------------------------
alter table public.ledgers  add column start_date date not null default current_date;
alter table public.profiles add column onboarded_at timestamptz;

comment on column public.ledgers.start_date   is '帳本起始日；所有期初餘額交易都記在這一天';
comment on column public.profiles.onboarded_at is '完成引導頁的時間；為空代表尚未完成引導';

-- -----------------------------------------------------------------------------
-- 類別二層
-- -----------------------------------------------------------------------------
alter table public.accounts add column parent_id uuid references public.accounts (id) on delete restrict;
create index accounts_parent_idx on public.accounts (parent_id);

alter table public.accounts drop constraint accounts_ledger_id_name_key;
alter table public.accounts add constraint accounts_ledger_parent_name_key
  unique nulls not distinct (ledger_id, parent_id, name);

comment on column public.accounts.parent_id is '父類別；只有收入／費用類別可用，最多兩層';

create or replace function public.check_account_parent()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_parent public.accounts%rowtype;
begin
  if new.parent_id is null then
    return new;
  end if;
  if new.parent_id = new.id then
    raise exception '類別不能以自己為父類別' using errcode = '23514';
  end if;
  if new.type not in ('revenue', 'expense') then
    raise exception '只有收入或費用類別可以設定父類別' using errcode = '23514';
  end if;

  select * into v_parent from public.accounts where id = new.parent_id;
  if not found or v_parent.ledger_id <> new.ledger_id then
    raise exception '父類別不屬於此帳本' using errcode = '23514';
  end if;
  if v_parent.type <> new.type then
    raise exception '父類別必須與子類別同為收入或同為費用' using errcode = '23514';
  end if;
  if v_parent.parent_id is not null then
    raise exception '類別最多兩層' using errcode = '23514';
  end if;
  if exists (select 1 from public.accounts where parent_id = new.id) then
    raise exception '已有子類別的類別不能再設定父類別' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke execute on function public.check_account_parent() from public, anon, authenticated;

create trigger accounts_check_parent
  before insert or update of parent_id, type, ledger_id on public.accounts
  for each row execute function public.check_account_parent();

-- 新科目未指定排序時，排在同層最後
create or replace function public.default_sort_order()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.sort_order = 0 then
    select coalesce(max(sort_order), 0) + 10
      into new.sort_order
      from public.accounts
     where ledger_id = new.ledger_id
       and type = new.type
       and parent_id is not distinct from new.parent_id;
  end if;
  return new;
end;
$$;
revoke execute on function public.default_sort_order() from public, anon, authenticated;

create trigger accounts_default_sort_order
  before insert on public.accounts
  for each row execute function public.default_sort_order();

-- -----------------------------------------------------------------------------
-- 建立帳本與預設科目（內部用，security definer）
-- -----------------------------------------------------------------------------
create or replace function public.seed_ledger(p_owner uuid, p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ledger_id uuid;
begin
  insert into public.ledgers (owner_id, name)
  values (p_owner, coalesce(nullif(trim(p_name), ''), '我的帳本'))
  returning id into v_ledger_id;

  insert into public.accounts (ledger_id, name, type, subtype, icon, color, is_system, sort_order) values
    -- 資產（帳戶）
    (v_ledger_id, '現金',     'asset',     'cash',            'banknote',       'emerald', false, 10),
    (v_ledger_id, '銀行存款', 'asset',     'bank',            'landmark',       'sky',     false, 20),
    (v_ledger_id, '電子支付', 'asset',     'ewallet',         'smartphone',     'violet',  false, 30),
    (v_ledger_id, '投資',     'asset',     'investment',      'trending-up',    'amber',   false, 40),
    -- 負債（帳戶）
    (v_ledger_id, '信用卡',   'liability', 'credit_card',     'credit-card',    'rose',    false, 50),
    -- 權益（系統）
    (v_ledger_id, '期初餘額', 'equity',    'opening_balance', null,             null,      true,  60),
    -- 收入（類別）
    (v_ledger_id, '薪資',     'revenue',   null, 'briefcase',      'emerald', false, 100),
    (v_ledger_id, '獎金',     'revenue',   null, 'gift',           'amber',   false, 110),
    (v_ledger_id, '投資收益', 'revenue',   null, 'trending-up',    'sky',     false, 120),
    (v_ledger_id, '其他收入', 'revenue',   null, 'circle-plus',    'slate',   false, 190),
    -- 費用（類別）
    (v_ledger_id, '飲食',     'expense',   null, 'utensils',       'orange',  false, 200),
    (v_ledger_id, '交通',     'expense',   null, 'bus',            'sky',     false, 210),
    (v_ledger_id, '居住',     'expense',   null, 'house',          'amber',   false, 220),
    (v_ledger_id, '水電網路', 'expense',   null, 'zap',            'yellow',  false, 230),
    (v_ledger_id, '購物',     'expense',   null, 'shopping-bag',   'pink',    false, 240),
    (v_ledger_id, '娛樂',     'expense',   null, 'gamepad-2',      'violet',  false, 250),
    (v_ledger_id, '醫療',     'expense',   null, 'heart-pulse',    'rose',    false, 260),
    (v_ledger_id, '教育',     'expense',   null, 'graduation-cap', 'indigo',  false, 270),
    (v_ledger_id, '保險',     'expense',   null, 'shield',         'teal',    false, 280),
    (v_ledger_id, '其他支出', 'expense',   null, 'ellipsis',       'slate',   false, 290);

  return v_ledger_id;
end;
$$;
revoke execute on function public.seed_ledger(uuid, text) from public, anon, authenticated;

-- 註冊時：建立 profile + 預設帳本
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1)))
  on conflict (id) do nothing;

  if not exists (select 1 from public.ledgers where owner_id = new.id) then
    perform public.seed_ledger(new.id, '我的帳本');
  end if;
  return new;
end;
$$;

-- 已登入使用者自行建立帳本（未來多帳本用）
create or replace function public.create_ledger_with_defaults(p_name text default '我的帳本')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception '需要登入' using errcode = '42501';
  end if;
  return public.seed_ledger((select auth.uid()), p_name);
end;
$$;

-- -----------------------------------------------------------------------------
-- 起始日變更時，同步所有期初餘額交易的日期
-- -----------------------------------------------------------------------------
create or replace function public.sync_opening_dates()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.start_date is distinct from old.start_date then
    update public.entries
       set entry_date = new.start_date
     where ledger_id = new.id and kind = 'opening';
  end if;
  return new;
end;
$$;
revoke execute on function public.sync_opening_dates() from public, anon, authenticated;

create trigger ledgers_sync_opening_dates
  after update of start_date on public.ledgers
  for each row execute function public.sync_opening_dates();

-- -----------------------------------------------------------------------------
-- 科目餘額檢視表（依正常餘額方向；受底層 RLS 保護）
-- -----------------------------------------------------------------------------
create view public.account_balances
with (security_invoker = true)
as
select a.id        as account_id,
       a.ledger_id,
       a.type,
       coalesce(sum(case when a.type in ('asset', 'expense') then l.debit - l.credit
                         else l.credit - l.debit end), 0)::numeric(14, 2) as balance,
       count(l.id)::integer as line_count
  from public.accounts a
  left join public.entry_lines l on l.account_id = a.id
 group by a.id;

comment on view public.account_balances is '每個科目的目前餘額與分錄行數；line_count > 0 的科目只能封存不能刪除';

-- -----------------------------------------------------------------------------
-- RPC：設定帳戶期初餘額（每帳戶最多一筆 opening 交易，日期 = 帳本起始日）
-- -----------------------------------------------------------------------------
create or replace function public.set_opening_balance(p_account_id uuid, p_amount numeric)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_acc    public.accounts%rowtype;
  v_ledger public.ledgers%rowtype;
  v_equity uuid;
  v_entry  uuid;
  v_amount numeric := coalesce(p_amount, 0);
  v_lines  jsonb;
begin
  select * into v_acc from public.accounts where id = p_account_id;
  if not found then
    raise exception '找不到帳戶' using errcode = 'P0002';
  end if;
  if v_acc.type not in ('asset', 'liability') then
    raise exception '只有資產或負債帳戶能設定期初餘額' using errcode = '23514';
  end if;
  if v_amount < 0 then
    raise exception '期初餘額不能是負數；負債請建立在負債帳戶' using errcode = '23514';
  end if;

  select * into v_ledger from public.ledgers where id = v_acc.ledger_id;
  select id into v_equity
    from public.accounts
   where ledger_id = v_acc.ledger_id and type = 'equity' and is_system
   order by sort_order limit 1;
  if v_equity is null then
    raise exception '帳本缺少「期初餘額」系統科目' using errcode = 'P0002';
  end if;

  select id into v_entry
    from public.entries
   where ledger_id = v_acc.ledger_id and kind = 'opening' and to_account_id = p_account_id
   order by created_at limit 1;

  if v_amount = 0 then
    if v_entry is not null then
      delete from public.entries where id = v_entry;
    end if;
    return null;
  end if;

  -- 資產：借 帳戶 / 貸 期初餘額；負債：借 期初餘額 / 貸 帳戶
  v_lines := case when v_acc.type = 'asset' then
    jsonb_build_array(
      jsonb_build_object('account_id', p_account_id, 'debit', v_amount, 'credit', 0),
      jsonb_build_object('account_id', v_equity,     'debit', 0,        'credit', v_amount))
  else
    jsonb_build_array(
      jsonb_build_object('account_id', v_equity,     'debit', v_amount, 'credit', 0),
      jsonb_build_object('account_id', p_account_id, 'debit', 0,        'credit', v_amount))
  end;

  return public.save_entry(
    jsonb_build_object(
      'id', v_entry,
      'ledger_id', v_acc.ledger_id,
      'kind', 'opening',
      'entry_date', v_ledger.start_date,
      'amount', v_amount,
      'to_account_id', p_account_id,
      'memo', '期初餘額'),
    v_lines);
end;
$$;
revoke execute on function public.set_opening_balance(uuid, numeric) from public, anon;
grant  execute on function public.set_opening_balance(uuid, numeric) to authenticated;

-- -----------------------------------------------------------------------------
-- RPC：完成引導頁
--   p_accounts = [{ id, name, keep, opening_amount }, ...]（只處理資產／負債帳戶）
-- -----------------------------------------------------------------------------
create or replace function public.complete_onboarding(p_name text, p_start_date date, p_accounts jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_ledger uuid;
  r record;
begin
  select id into v_ledger
    from public.ledgers
   where owner_id = (select auth.uid())
   order by created_at limit 1;
  if v_ledger is null then
    raise exception '找不到帳本' using errcode = 'P0002';
  end if;

  update public.ledgers
     set name       = coalesce(nullif(trim(p_name), ''), name),
         start_date = coalesce(p_start_date, start_date)
   where id = v_ledger;

  for r in
    select (x ->> 'id')::uuid                          as id,
           x ->> 'name'                                as name,
           coalesce((x ->> 'keep')::boolean, true)     as keep,
           coalesce((x ->> 'opening_amount')::numeric, 0) as opening
      from jsonb_array_elements(coalesce(p_accounts, '[]'::jsonb)) x
  loop
    if not r.keep then
      delete from public.accounts
       where id = r.id and ledger_id = v_ledger and type in ('asset', 'liability') and not is_system;
    else
      if nullif(trim(r.name), '') is not null then
        update public.accounts set name = trim(r.name) where id = r.id and ledger_id = v_ledger;
      end if;
      if r.opening > 0 then
        perform public.set_opening_balance(r.id, r.opening);
      end if;
    end if;
  end loop;

  update public.profiles set onboarded_at = now() where id = (select auth.uid());
end;
$$;
revoke execute on function public.complete_onboarding(text, date, jsonb) from public, anon;
grant  execute on function public.complete_onboarding(text, date, jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- RPC：同層內上移／下移
-- -----------------------------------------------------------------------------
create or replace function public.move_account(p_account_id uuid, p_direction text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_acc public.accounts%rowtype;
  v_sib public.accounts%rowtype;
begin
  if p_direction not in ('up', 'down') then
    raise exception '方向必須是 up 或 down' using errcode = '22023';
  end if;

  select * into v_acc from public.accounts where id = p_account_id;
  if not found then
    raise exception '找不到科目' using errcode = 'P0002';
  end if;

  -- 先把同層重新編號（10, 20, 30…），避免重複的 sort_order
  with ranked as (
    select id, (row_number() over (order by sort_order, created_at) * 10)::integer as so
      from public.accounts
     where ledger_id = v_acc.ledger_id
       and type = v_acc.type
       and parent_id is not distinct from v_acc.parent_id
  )
  update public.accounts a
     set sort_order = ranked.so
    from ranked
   where a.id = ranked.id and a.sort_order <> ranked.so;

  select * into v_acc from public.accounts where id = p_account_id;

  if p_direction = 'up' then
    select * into v_sib
      from public.accounts
     where ledger_id = v_acc.ledger_id
       and type = v_acc.type
       and parent_id is not distinct from v_acc.parent_id
       and not is_archived
       and sort_order < v_acc.sort_order
     order by sort_order desc limit 1;
  else
    select * into v_sib
      from public.accounts
     where ledger_id = v_acc.ledger_id
       and type = v_acc.type
       and parent_id is not distinct from v_acc.parent_id
       and not is_archived
       and sort_order > v_acc.sort_order
     order by sort_order asc limit 1;
  end if;

  if not found then
    return;  -- 已在最前／最後
  end if;

  update public.accounts set sort_order = v_sib.sort_order where id = v_acc.id;
  update public.accounts set sort_order = v_acc.sort_order where id = v_sib.id;
end;
$$;
revoke execute on function public.move_account(uuid, text) from public, anon;
grant  execute on function public.move_account(uuid, text) to authenticated;
