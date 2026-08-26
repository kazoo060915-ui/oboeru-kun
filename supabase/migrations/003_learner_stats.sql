-- 覚える君 マイグレーション 003
-- Supabase の SQL Editor に貼って一度だけ実行する。
-- 何度流しても壊れないように書いてある（冪等）。

-- ──────────────────────────────────────────
-- 称号ランクの累計復習回数をサーバー側に保存する。
--
-- 以前は localStorage にのみ保存していたため、PC とスマホなど
-- 端末が違うと累計回数が別々にカウントされ、同じアカウントなのに
-- 表示されるランク（「忘れん坊」「ひよっこ」等）が端末ごとにズレていた。
-- ──────────────────────────────────────────
alter table public.user_settings
  add column if not exists total_reviews integer not null default 0,
  add column if not exists total_correct integer not null default 0;
