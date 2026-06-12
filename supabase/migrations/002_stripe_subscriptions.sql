-- ViralOS Supabase Schema — Step 6: Stripe Subscriptions + Usage Metering
-- Run this in Supabase SQL Editor AFTER 001_initial_schema.sql

-- ─── subscriptions ────────────────────────────────────────────────────────────
-- One row per user. Tracks their Stripe subscription state and plan tier.
-- Created on first sign-in (free tier). Updated by Stripe webhook.
create table if not exists public.subscriptions (
  id                    uuid primary key default uuid_generate_v4(),
  clerk_user_id         text not null unique references public.users(clerk_user_id) on delete cascade,
  stripe_customer_id    text unique,                    -- cus_xxx
  stripe_subscription_id text unique,                  -- sub_xxx
  plan                  text not null default 'free',   -- 'free' | 'pro' | 'studio'
  status                text not null default 'active', -- 'active' | 'past_due' | 'canceled' | 'trialing'
  current_period_start  timestamptz,
  current_period_end    timestamptz,
  cancel_at_period_end  boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ─── usage_records ────────────────────────────────────────────────────────────
-- Tracks render consumption per billing period. One row per render job completed.
create table if not exists public.usage_records (
  id              uuid primary key default uuid_generate_v4(),
  clerk_user_id   text not null references public.users(clerk_user_id) on delete cascade,
  render_job_id   text,                                 -- references render_jobs.job_id
  period_start    timestamptz not null,                 -- billing period start (from subscription)
  period_end      timestamptz not null,                 -- billing period end
  created_at      timestamptz not null default now()
);

-- ─── RLS ──────────────────────────────────────────────────────────────────────
alter table public.subscriptions  enable row level security;
alter table public.usage_records  enable row level security;

create policy "subscriptions_own" on public.subscriptions
  using (clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub');

create policy "usage_records_own" on public.usage_records
  using (clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- ─── Indexes ──────────────────────────────────────────────────────────────────
create index if not exists idx_subscriptions_clerk_user_id    on public.subscriptions(clerk_user_id);
create index if not exists idx_subscriptions_stripe_customer  on public.subscriptions(stripe_customer_id);
create index if not exists idx_subscriptions_stripe_sub       on public.subscriptions(stripe_subscription_id);
create index if not exists idx_usage_records_clerk_user_id    on public.usage_records(clerk_user_id);
create index if not exists idx_usage_records_period           on public.usage_records(clerk_user_id, period_start, period_end);

-- ─── Auto-update updated_at ───────────────────────────────────────────────────
create trigger trg_subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function update_updated_at();
