-- 里程碑 6（PR A 安全審查）：RLS 測試發現 budgets 可以在自己的帳本建一列、卻掛在別人帳本的類別上。
-- 補上參照檢查：類別必須是同一本帳本的費用類別（同 entries／goals 的做法）。
create or replace function public.validate_budget_category()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.accounts a
     where a.id = new.category_id and a.ledger_id = new.ledger_id and a.type = 'expense'
  ) then
    raise exception '預算只能設定在這本帳本的費用類別' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke execute on function public.validate_budget_category() from public, anon, authenticated;

create trigger budgets_validate_category
  before insert or update of category_id, ledger_id on public.budgets
  for each row execute function public.validate_budget_category();
