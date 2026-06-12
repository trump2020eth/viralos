-- ViralOS Supabase Migration 003 — Health check indexes + missing FK fix
-- Run AFTER 001_initial_schema.sql and 002_stripe_subscriptions.sql

-- ─── Fix render_jobs project_id nullable ──────────────────────────────────────
-- Original schema requires project_id NOT NULL, but /api/render can be called
-- without a projectId (render without saving). Make it nullable.
ALTER TABLE public.render_jobs
  ALTER COLUMN project_id DROP NOT NULL;

-- ─── Additional performance indexes ───────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_render_jobs_clerk_status
  ON public.render_jobs(clerk_user_id, status);

CREATE INDEX IF NOT EXISTS idx_render_jobs_created_at
  ON public.render_jobs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_scenes_project_scene
  ON public.scenes(project_id, scene_number);

CREATE INDEX IF NOT EXISTS idx_usage_records_created_at
  ON public.usage_records(created_at DESC);

-- ─── View: user_render_summary ──────────────────────────────────────────────
-- Convenient view for the dashboard stats query.
CREATE OR REPLACE VIEW public.user_render_summary AS
SELECT
  u.clerk_user_id,
  COUNT(DISTINCT p.id)                        AS total_projects,
  COUNT(DISTINCT rj.id) FILTER (
    WHERE rj.status = 'done'
  )                                            AS completed_renders,
  COALESCE(SUM(rj.duration_seconds) FILTER (
    WHERE rj.status = 'done'
  ), 0)                                        AS total_duration_seconds,
  MAX(rj.completed_at)                         AS last_render_at
FROM public.users u
LEFT JOIN public.projects    p  ON p.clerk_user_id  = u.clerk_user_id
LEFT JOIN public.render_jobs rj ON rj.clerk_user_id = u.clerk_user_id
GROUP BY u.clerk_user_id;

COMMENT ON VIEW public.user_render_summary IS
  'Aggregate render stats per user — used by dashboard stats panel.';
