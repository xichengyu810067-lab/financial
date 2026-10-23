-- 里程碑 4（PR C 記帳回饋動畫）：是否播放記帳後的動畫
alter table public.profiles
  add column if not exists animations_enabled boolean not null default true;

comment on column public.profiles.animations_enabled is '記帳後是否播放回饋動畫（撲滿、印章、紙鈔）';
