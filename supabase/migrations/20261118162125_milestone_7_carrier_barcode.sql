-- 里程碑 7 PR B：手機條碼載具（只存條碼本身，不存驗證碼）。格式：/ 加 7 碼（0-9、A-Z、+、-、.）
alter table public.profiles
  add column carrier_barcode text
  constraint profiles_carrier_barcode_format check (carrier_barcode is null or carrier_barcode ~ '^/[0-9A-Z.+-]{7}$');
