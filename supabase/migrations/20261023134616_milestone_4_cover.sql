-- 里程碑 4（PR A 外殼）：帳本封面的顏色與材質
alter table public.ledgers
  add column if not exists cover_color text,
  add column if not exists cover_material text;

comment on column public.ledgers.cover_color is '封面顏色（主題色 id 或自訂 hex；null = 跟隨主題色）';
comment on column public.ledgers.cover_material is '封面材質：linen / leather / kraft；null = linen';
