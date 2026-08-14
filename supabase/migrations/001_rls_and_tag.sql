-- 覚える君 マイグレーション 001
-- Supabase の SQL Editor に貼って一度だけ実行する。
-- 何度流しても壊れないように書いてある（冪等）。

-- ──────────────────────────────────────────
-- 1. tag カラムの追加
--    アプリ側は以前から tag を送っていたが、DB に列が無く
--    黙って捨てられていた（保存率 0%）。
-- ──────────────────────────────────────────
alter table public.terms add column if not exists tag text default '';
create index if not exists idx_terms_tag on public.terms(tag);

-- ──────────────────────────────────────────
-- 2. Row Level Security の有効化
--    ポリシーを1つも作らない = anon / authenticated からは全拒否。
--    サーバー（service_role キー）だけが RLS をバイパスして通る。
--
--    これを入れないと、ブラウザに配られる anon キーだけで
--    Supabase REST を直接叩かれ、全用語と復習履歴を
--    1リクエストで削除できてしまう。
-- ──────────────────────────────────────────
alter table public.terms         enable row level security;
alter table public.reviews       enable row level security;
alter table public.user_settings enable row level security;

-- 念のため、過去に作られた許可ポリシーが残っていたら消す
drop policy if exists "public read"  on public.terms;
drop policy if exists "public write" on public.terms;
drop policy if exists "public read"  on public.reviews;
drop policy if exists "public write" on public.reviews;
