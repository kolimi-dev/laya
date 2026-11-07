# Laya (लय) — Personal Rhythm & Consistency Tracker

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

## 2. Core Pillars

1. **Multi-Flavor Tasks:**
   - **Milestones / Sub-tasks:** Discrete steps (e.g., *Drink 3L of water* $\rightarrow$ `1L`, `2L`, `3L`).
   - **Continuous Percentages:** Continuous progress (e.g., *Read 50 pages* $\rightarrow$ `0%` to `100%`).
   - **Standard Checklists:** Explicit state tracking (`Done`, `Pending`, or `Ignored`).
2. **Guilt-Free Consistency Math (The "Ignore" Action):**
   - Mark a task as `Ignored` for intentional rest days, illness, or scheduled pauses.
   - Ignored items are **excluded from the denominator** so they never penalize your score:
     $$\text{Consistency Rating (\%)} = \frac{\sum \text{Completed Points}}{\text{Total Scheduled Points} - \text{Ignored Points}} \times 100$$
3. **Independent Task Groups & Schedules:**
   - Groups (`Health`, `Office`, `Personal`, `Deep Work`) with independent recurrence patterns (Mon–Fri, Tue–Sat, custom cycle cadences).
4. **Staged Smart Reminders & Voice Engine:**
   - Stage 1 (Silent / Visual) $\rightarrow$ Stage 2 (Voice reminder escalation after grace period) with quiet hour blackouts.
5. **Dual-Control AI Architecture:**
   - 100% functional via manual UI; zero AI requirement to use the app.
   - Administrative assistant & data explainer via structured Tool Calling / MCP.
   - Strictly forbidden from acting as an unsolicited life coach or motivational preacher.

---

## 3. Development Roadmap

- [x] **Phase 1: Pure TypeScript Domain Core & Mathematical Engine** (Multi-flavor math, denominator exemption rule, 100% test coverage)
- [ ] **Phase 2: Task Groups & Recurrence Engine** (Schedules: Mon–Fri, Tue–Sat, custom cycles, Today's active checklist)
- [ ] **Phase 3: Database & Append-Only Event Store** (`tracker.*` PostgreSQL schema, client idempotency keys)
- [ ] **Phase 4: Staged Notification & Voice Escalation Engine** (Visual first $\rightarrow$ Voice + quiet window blackouts)
- [ ] **Phase 5: Auth & Fastify APIs** (Consumes `kolimi-platform` JWKS)
- [ ] **Phase 6: UI Client & Radial Rhythm Dial** (Responsive web/mobile client, concentric radial rhythm visualization)

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
