-- 修正：save_entry（security invoker）與 commit 時的平衡 trigger 都以登入者身分呼叫
-- assert_entry_balanced，因此 authenticated 需要 EXECUTE 權限。此函式只做唯讀檢查。
grant execute on function public.assert_entry_balanced(uuid) to authenticated;
