# Laya (లయ) — Personal Rhythm & Consistency Tracker

> **Pressure-free personal consistency tracking on your own terms.**

Part of the [Kolimi Studio](https://github.com/kolimi-dev) ecosystem.

---

## 1. Product Vision & Tracking Philosophy

Conventional habit trackers impose toxic, guilt-inducing mechanics:
- **Streak Anxiety:** Missing a single day resets progress to zero, inducing shame and app abandonment.
- **Binary Traps:** Activities are forced into binary pass/fail, ignoring meaningful partial progress.
- **Rigid Calendar Weeks:** Enforcing 7-day calendar weeks when users operate on custom cadences (e.g., 5-day sprints, 10-day review cycles).
- **Gamification Gimmicks:** Artificial badges, confetti, and social leaderboards that trivialize genuine discipline.

**Laya rejects these patterns.** The user defines what consistency means; Laya provides objective mathematical recording and calming visualizations without judgment, unsolicited coaching, or pressure.

---

## 2. Core Pillars & Human-First UX

1. **Human-First Daily View (Remaining vs. Completed):**
   - Eliminates AI-feel formulas and dashboard clutter.
   - **Remaining Today:** Active focus displaying pending and in-progress tasks at the top.
   - **Completed & Rested Today:** Quiet section below showing finished items and intentional rest days.
2. **Default Groups (Personal & Work Only):**
   - Seeded with two clean, color-coded groups: 👤 **Personal** and 💼 **Work**.
   - No `(Unassigned / General)` pseudo-groups; every task has an intentional home.
   - Users can rename, recolor, or add custom groups anytime (`+ New Group`).
3. **Strict Form Field Isolation & Dynamic Milestones:**
   - **Discrete Milestones:** Displays ONLY dynamic checkpoint row inputs (`[ Checkpoint ] [✕]` with `+ Add Checkpoint`). Target Amount and Unit Label are completely hidden.
   - **Quantified Target:** Displays ONLY paired fields: **Target Amount** (`___`) and **Unit Label** (`___`) (e.g. `10 min`, `40 g`, `3 L`, `50 pages`). Milestones are completely hidden.
   - **Standard Checklist:** Binary Yes/No checkoff; neither milestone nor unit fields are displayed.
4. **Human Repeat Frequencies ℹ️:**
   - Replaces technical jargon ("Schedule cadence", "Interval days") with plain human schedules and `(i)` info tooltips:
     - **Every Day** (daily)
     - **Specific Days of Week** (`[M] [T] [W] [T] [F] [S] [S]` interactive day pills)
     - **Monthly** (specific day of the month `1–31`)
     - **Quarterly** (every 3 months on date X)
     - **Yearly** (every year on date X)
     - **Flexible / Anytime** (backlog tasks without a strict calendar date)
5. **Opt-In Per-Task Custom Charts:**
   - **Zero Default Charts:** No charts are visible by default, keeping the dashboard calm. Users add only what they want.
   - **1 Dedicated Block Per Task:**
     - E.g. `Drinking Water` $\rightarrow$ **1 block** (Daily volume bars in Liters + 3L goal threshold).
     - E.g. `Exercise` $\rightarrow$ **1 block** (Rhythm matrix heatmap blocks: Done, Rest/Exempt, Open).
   - **Customizable Styles:** Daily Volume Bars, Rhythm Matrix, Progress Trend Line.
   - **Time Filter:** *This Week*, *This Month*, *Last 30 Days*, *90 Days*, *1 Year*, *Custom*.
6. **Guilt-Free Consistency Math (The "Ignore" Action):**
   - Mark a task as `Ignored` for intentional rest days, illness, or scheduled pauses.
   - Ignored items are **excluded from the denominator** so they never penalize your score:
     $$\text{Consistency Rating (\%)} = \frac{\sum \text{Completed Points}}{\text{Total Scheduled Points} - \text{Ignored Points}} \times 100$$
7. **Guarded Local Data Purge (OTP Verification):**
   - Clearing local cache requires entering a generated 6-digit confirmation code before deletion executes.

---

## 3. Development Roadmap

- [x] **Phase 1: Pure TypeScript Domain Core & Mathematical Engine** (Multi-flavor math, denominator exemption rule, 100% test coverage)
- [x] **Phase 2: Task Groups & Recurrence Engine** (Personal & Work groups, Day masks, Custom cycles, Today's active checklist)
- [x] **Phase 3: Database & Append-Only Event Store** (`tracker.*` PostgreSQL schema, client idempotency keys)
- [x] **Phase 4: Staged Notification & Voice Escalation Engine** (Visual first $\rightarrow$ Voice + quiet window blackouts)
- [x] **Phase 5: Auth & Fastify APIs** (Consumes `kolimi-platform` JWKS)
- [x] **Phase 6: Human-First UI Client** (Remaining vs. Completed buckets, Per-Task Charts, OTP purge guard)

---

## 4. Development & Testing

```bash
# Install dependencies
npm install

# Run unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Build TypeScript
npm run build
```

---

## 5. License

Apache-2.0 © Kolimi Studio
