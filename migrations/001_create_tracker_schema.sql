-- Migration 001: Create tracker schema, tables, and append-only event store
-- Adheres strictly to Kolimi Studio Ground Rules (shared/00-ground-rules.md)

CREATE SCHEMA IF NOT EXISTS tracker;

-- Shared timestamp trigger function
CREATE OR REPLACE FUNCTION public.trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. Task Groups Table (e.g. Health & Fitness, Office, Personal)
CREATE TABLE IF NOT EXISTS tracker.groups (
    id VARCHAR(36) PRIMARY KEY,                  -- grp_01H...
    user_id VARCHAR(36) NOT NULL,                -- usr_01H... master identity
    name VARCHAR(64) NOT NULL,
    color VARCHAR(16) NOT NULL DEFAULT '#4F46E5',
    sort_order INT NOT NULL DEFAULT 0,
    schedule JSONB NULL,                         -- WorkSchedule configuration
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(36),
    updated_by VARCHAR(36),
    deleted_at TIMESTAMPTZ NULL                  -- Soft-delete recovery
);

CREATE INDEX IF NOT EXISTS idx_groups_user_active ON tracker.groups(user_id) WHERE deleted_at IS NULL;

-- 2. Tasks Definition Table (Polymorphic: checklist, milestone, percentage)
CREATE TABLE IF NOT EXISTS tracker.tasks (
    id VARCHAR(36) PRIMARY KEY,                  -- tsk_01H...
    user_id VARCHAR(36) NOT NULL,
    group_id VARCHAR(36) REFERENCES tracker.groups(id) ON DELETE SET NULL,
    title VARCHAR(120) NOT NULL,
    task_type VARCHAR(20) NOT NULL,              -- 'checklist', 'milestone', 'percentage'
    recurrence VARCHAR(20) NOT NULL,             -- 'daily', 'weekly', 'monthly', 'custom', 'anytime'
    cycle_days INT NULL,                         -- Interval if recurrence is 'custom'
    schedule JSONB NULL,                         -- Task-level schedule override
    target_value NUMERIC(8,2) NULL,              -- Target value e.g. 100.00
    unit VARCHAR(24) NULL,                       -- e.g. 'L', 'pages', 'minutes', 'reps'
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(36),
    updated_by VARCHAR(36),
    deleted_at TIMESTAMPTZ NULL,                 -- Soft-delete
    archived_at TIMESTAMPTZ NULL                 -- Archived completed goals (preserves past consistency)
);

CREATE INDEX IF NOT EXISTS idx_tasks_user_active ON tracker.tasks(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_group ON tracker.tasks(group_id);

-- 3. Discrete Milestones Table (For milestone task types e.g. '1L', '2L', '3L')
CREATE TABLE IF NOT EXISTS tracker.task_milestones (
    id VARCHAR(36) PRIMARY KEY,                  -- mls_01H...
    task_id VARCHAR(36) NOT NULL REFERENCES tracker.tasks(id) ON DELETE CASCADE,
    label VARCHAR(64) NOT NULL,
    step_order INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(36),
    updated_by VARCHAR(36)
);

CREATE INDEX IF NOT EXISTS idx_milestones_task ON tracker.task_milestones(task_id, step_order);

-- 4. Append-Only Completion Event Stream (Idempotent Mobile Sync)
CREATE TABLE IF NOT EXISTS tracker.completion_events (
    id VARCHAR(36) PRIMARY KEY,                  -- Client-generated UUID or evt_01H...
    task_id VARCHAR(36) NOT NULL REFERENCES tracker.tasks(id) ON DELETE CASCADE,
    milestone_id VARCHAR(36) REFERENCES tracker.task_milestones(id) ON DELETE CASCADE,
    user_id VARCHAR(36) NOT NULL,
    status VARCHAR(20) NOT NULL,                 -- 'done', 'in_progress', 'ignored'
    progress_percentage NUMERIC(5,2) NULL,       -- Continuous percentage (0.00 to 100.00)
    notes VARCHAR(280) NULL,                     -- Optional micro-notes
    occurred_at TIMESTAMPTZ NOT NULL,            -- Client timestamp (when action happened in real life)
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- Server receipt timestamp
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(36),
    updated_by VARCHAR(36)
);

CREATE INDEX IF NOT EXISTS idx_events_task_user_occurred ON tracker.completion_events(task_id, user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_user_occurred ON tracker.completion_events(user_id, occurred_at DESC);

-- 5. Updated_at Triggers
DROP TRIGGER IF EXISTS set_groups_timestamp ON tracker.groups;
CREATE TRIGGER set_groups_timestamp BEFORE UPDATE ON tracker.groups FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();

DROP TRIGGER IF EXISTS set_tasks_timestamp ON tracker.tasks;
CREATE TRIGGER set_tasks_timestamp BEFORE UPDATE ON tracker.tasks FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();

DROP TRIGGER IF EXISTS set_milestones_timestamp ON tracker.task_milestones;
CREATE TRIGGER set_milestones_timestamp BEFORE UPDATE ON tracker.task_milestones FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();

DROP TRIGGER IF EXISTS set_events_timestamp ON tracker.completion_events;
CREATE TRIGGER set_events_timestamp BEFORE UPDATE ON tracker.completion_events FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();
