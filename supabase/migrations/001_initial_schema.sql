-- ViralOS Supabase Schema — Step 4
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard → SQL Editor

-- ─── Extensions ───────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─── users ────────────────────────────────────────────────────────────────────
-- Mirrors Clerk users. clerk_user_id is the FK for all other tables.
-- Created automatically on first sign-in via /api/user/sync route.
create table if not exists public.users (
  id              uuid primary key default uuid_generate_v4(),
  clerk_user_id   text not null unique,
  email           text,
  display_name    text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ─── projects ─────────────────────────────────────────────────────────────────
-- One row per generated video project (a completed /api/generate call).
create table if not exists public.projects (
  id              uuid primary key default uuid_generate_v4(),
  clerk_user_id   text not null references public.users(clerk_user_id) on delete cascade,
  title           text not null,
  niche           text,
  format          text not null default '9:16', -- '9:16' | '16:9' | '1:1'
  duration_target int,                           -- requested seconds (30/60/90)
  tone            text,
  caption_style   text,
  voice           text,
  image_engine    text,
  script_json     jsonb,                         -- full GenerateResponse from /api/generate
  characters_json jsonb,                         -- character memory array
  status          text not null default 'draft', -- 'draft' | 'rendering' | 'done' | 'error'
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ─── render_jobs ──────────────────────────────────────────────────────────────
-- One row per render attempt. A project can have multiple renders (re-renders).
create table if not exists public.render_jobs (
  id              uuid primary key default uuid_generate_v4(),
  job_id          text not null unique,           -- matches the render_${userId}_${timestamp} id
  project_id      uuid not null references public.projects(id) on delete cascade,
  clerk_user_id   text not null,
  status          text not null default 'queued', -- 'queued' | 'rendering' | 'done' | 'error'
  format          text not null default '9:16',
  duration_seconds numeric,                       -- actual rendered duration
  scene_count     int,
  r2_key          text,                           -- Cloudflare R2 object key
  r2_url          text,                           -- Public R2 URL (signed or public)
  error_message   text,
  started_at      timestamptz,
  completed_at    timestamptz,
  created_at      timestamptz not null default now()
);

-- ─── scenes ───────────────────────────────────────────────────────────────────
-- Individual scene rows for per-scene editing (Step 6+ storyboard editor).
-- Populated from script_json at project creation for future scene-level ops.
create table if not exists public.scenes (
  id              uuid primary key default uuid_generate_v4(),
  project_id      uuid not null references public.projects(id) on delete cascade,
  scene_number    int not null,
  narration       text,
  image_prompt    text,
  camera_move     text,
  arc_beat        text,
  emotion         text,
  duration_seconds numeric,
  image_url       text,   -- Pollinations/R2 URL used in last render
  created_at      timestamptz not null default now(),
  unique(project_id, scene_number)
);

-- ─── Row Level Security ───────────────────────────────────────────────────────
-- Users can only read/write their own data.
alter table public.users       enable row level security;
alter table public.projects    enable row level security;
alter table public.render_jobs enable row level security;
alter table public.scenes      enable row level security;

-- Users: read/write own row only
create policy "users_own" on public.users
  using (clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Projects: read/write own rows
create policy "projects_own" on public.projects
  using (clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Render jobs: read/write own rows
create policy "render_jobs_own" on public.render_jobs
  using (clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Scenes: access via project ownership
create policy "scenes_own" on public.scenes
  using (
    project_id in (
      select id from public.projects
      where clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub'
    )
  );

-- Service role bypasses RLS (used server-side in API routes)
-- This is automatic for SUPABASE_SERVICE_ROLE_KEY

-- ─── Indexes ──────────────────────────────────────────────────────────────────
create index if not exists idx_projects_clerk_user_id  on public.projects(clerk_user_id);
create index if not exists idx_projects_status         on public.projects(status);
create index if not exists idx_projects_created_at     on public.projects(created_at desc);
create index if not exists idx_render_jobs_project_id  on public.render_jobs(project_id);
create index if not exists idx_render_jobs_job_id      on public.render_jobs(job_id);
create index if not exists idx_scenes_project_id       on public.scenes(project_id);

-- ─── Auto-update updated_at ───────────────────────────────────────────────────
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_users_updated_at
  before update on public.users
  for each row execute function update_updated_at();

create trigger trg_projects_updated_at
  before update on public.projects
  for each row execute function update_updated_at();
