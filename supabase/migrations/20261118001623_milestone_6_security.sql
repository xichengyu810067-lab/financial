-- 里程碑 6（PR A 安全審查）：create_ledger_with_defaults 是 SECURITY DEFINER，前端沒有用到
-- （帳本由註冊 trigger handle_new_user → seed_ledger 建立），收回登入者的執行權限。
-- 之後做多帳本時再改成 security invoker 並加上數量限制後開放。
revoke execute on function public.create_ledger_with_defaults(text) from public, anon, authenticated;

comment on function public.create_ledger_with_defaults(text) is '保留給未來的多帳本功能；目前不開放呼叫（里程碑 6 收回權限）';
