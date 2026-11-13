-- Migration 002: Add ADR-0011 & ADR-0012 fields to tracker schema
-- Supports 4 flavors, decimal stepAmount, disjunctive OR milestones, and Inactive Habit lifecycle states

-- 1. Extend tracker.tasks with ADR-0011 and ADR-0012 fields
ALTER TABLE tracker.tasks
  ADD COLUMN IF NOT EXISTS step_amount NUMERIC(8,2) NULL,
  ADD COLUMN IF NOT EXISTS milestone_mode VARCHAR(10) NOT NULL DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS lifecycle_status VARCHAR(20) NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS target_date DATE NULL;

-- 2. Extend tracker.completion_events with quantified values and skipped milestones
ALTER TABLE tracker.completion_events
  ADD COLUMN IF NOT EXISTS quantified_value NUMERIC(8,2) NULL,
  ADD COLUMN IF NOT EXISTS skipped_milestones JSONB NULL DEFAULT '[]'::jsonb;

-- 3. Add index on lifecycle_status for fast filtering of active vs not_active habits
CREATE INDEX IF NOT EXISTS idx_tasks_lifecycle ON tracker.tasks(user_id, lifecycle_status) WHERE deleted_at IS NULL;
