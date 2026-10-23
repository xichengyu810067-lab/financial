-- 個人小標語（顯示在儀表板歡迎語下方）
alter table public.profiles add column slogan text;
comment on column public.profiles.slogan is '使用者自訂的小標語，顯示在儀表板歡迎語下方';
