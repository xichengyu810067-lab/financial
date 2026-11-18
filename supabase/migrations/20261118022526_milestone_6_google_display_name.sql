-- 里程碑 6 PR B：Google 登入的新使用者，顯示名稱依序取 display_name（Email 註冊時填的）→ full_name → name（Google 提供）→ 信箱 @ 前面那段，最多 40 字
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(
      coalesce(
        nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
        nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
        nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
        split_part(new.email, '@', 1)
      ),
      40
    )
  )
  on conflict (id) do nothing;

  if not exists (select 1 from public.ledgers where owner_id = new.id) then
    perform public.seed_ledger(new.id, '我的帳本');
  end if;
  return new;
end;
$$;
