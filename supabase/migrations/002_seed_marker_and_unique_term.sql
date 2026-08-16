-- 覚える君 マイグレーション 002
-- Supabase の SQL Editor に貼って一度だけ実行する。
-- 何度流しても壊れないように書いてある（冪等）。

-- ──────────────────────────────────────────
-- 1. 初期シードの目印（seeded_at）
--    以前は「terms が0件＝初回」と判定していたため、自分の用語を
--    全部消して0件にすると、次のリロードで初期サンプル8件が復活し、
--    単語帳を永久に空にできなかった。
--
--    既に用語を持っている環境は「シード済み」として記録しておく
--    （そうしないと、整理して0件にした瞬間にサンプルが生えてくる）。
-- ──────────────────────────────────────────
alter table public.user_settings
  add column if not exists seeded_at timestamp with time zone;

insert into public.user_settings (user_id, seeded_at)
select 'default_user', now()
where exists (select 1 from public.terms)
on conflict (user_id) do update
  set seeded_at = coalesce(public.user_settings.seeded_at, excluded.seeded_at);

-- ──────────────────────────────────────────
-- 2. 用語の重複防止
--    POST /api/terms に重複チェックが無く、解説画面の「＋追加」を
--    2回押すと同じ用語が2件入って、復習キューに同じお題が並んでいた。
--
--    まず既存の重複を掃除してから一意インデックスを張る
--    （残すのは最初に登録した1件。reviews は cascade で追随する）。
-- ──────────────────────────────────────────
delete from public.terms t
using public.terms keep
where t.user_id = keep.user_id
  and lower(trim(t.term)) = lower(trim(keep.term))
  and (
    t.created_at > keep.created_at
    or (t.created_at = keep.created_at and t.id > keep.id)
  );

create unique index if not exists idx_terms_unique_term
  on public.terms (user_id, lower(trim(term)));
