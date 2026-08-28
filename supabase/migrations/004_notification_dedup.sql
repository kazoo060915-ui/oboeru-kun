-- 004_notification_dedup.sql
-- 朝の通知（Cron）が複数プロジェクトや再試行で1日に2回以上送られるのを防ぐための記録カラム

alter table public.user_settings
  add column if not exists last_notified_date date;
