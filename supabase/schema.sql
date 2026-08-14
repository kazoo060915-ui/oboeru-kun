-- Supabase DB Schema for 覚える君 (Oboeru-kun)

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Terms Table
create table if not exists public.terms (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default 'default_user',
  term text not null,
  note text default '',
  tag text default '',
  level integer not null default 0 check (level >= 0 and level <= 4),
  next_review_at date not null default current_date,
  last_score integer,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Reviews Table (History)
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  term_id uuid references public.terms(id) on delete cascade not null,
  score integer not null,
  answer_text text,
  tsukkomi text,
  correct text,
  missed_keywords jsonb default '[]'::jsonb,
  mission text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. User Settings Table (Notification configuration)
create table if not exists public.user_settings (
  user_id text primary key default 'default_user',
  notification_channel text default 'both' check (notification_channel in ('line', 'email', 'both', 'none')),
  line_token text default '',
  email_address text default '',
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Index for fast review querying
create index if not exists idx_terms_next_review on public.terms(next_review_at);
create index if not exists idx_terms_tag on public.terms(tag);
create index if not exists idx_reviews_term_id on public.reviews(term_id);

-- ──────────────────────────────────────────
-- Row Level Security
-- ポリシーを1つも作らない = anon / authenticated からは全拒否。
-- サーバー（service_role キー）だけが RLS をバイパスする。
-- ブラウザに配られる anon キーで DB を直接操作されるのを防ぐ要。
-- ──────────────────────────────────────────
alter table public.terms         enable row level security;
alter table public.reviews       enable row level security;
alter table public.user_settings enable row level security;
