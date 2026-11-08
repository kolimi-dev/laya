import { describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { MockJwtVerifier } from './auth/jwt-verifier.js';
import { InMemoryTrackerRepository } from './storage/in-memory-tracker-repository.js';
import { AuthenticatedUser } from './auth/types.js';
import { renderTaskCard } from '../public/js/components/task-card.js';
import { generateTaskChartSvg } from '../public/js/components/chart-svg.js';
import { syncRecurrenceFormFields, syncTaskTypeFormFields } from '../public/js/components/task-modal.js';

describe('Laya (లయ) End-to-End Audit — 6 Realistic Habit Scenarios', () => {
  const alice: AuthenticatedUser = {
    userId: 'usr_alice_123',
    phone: '+919876543210',
    roles: ['user'],
    sessionId: 'sid_alice',
  };

  const authHeader = { authorization: 'Bearer token_for_alice' };

  async function createTestApp() {
    const repository = new InMemoryTrackerRepository();
    const verifier = new (class extends MockJwtVerifier {
      async verifyToken(token: string): Promise<AuthenticatedUser> {
        if (token === 'token_for_alice') return alice;
        return super.verifyToken(token);
      }
    })();

    const app = await buildApp({
      repository,
      jwtVerifier: verifier,
      envOverrides: { NODE_ENV: 'test' },
    });

    return { app, repository };
  }

  // =========================================================================
  // Scenario 1: Daily Quantified Habit — "Drink 4 L Water"
  // =========================================================================
  describe('Scenario 1: Daily Quantified Habit — "Drink 4 L Water"', () => {
    it('verifies form input isolation for Quantified Target vs Milestone inputs', () => {
      // Mock DOM element references as used by task-modal.js
      const percentageGroup = { hidden: true };
      const milestonesGroup = { hidden: false };
      const targetInput = { required: false, value: 'old' };
      const unitInput = { required: false, value: 'old' };

      // Setup global document mock for getElementById inside syncTaskTypeFormFields
      const prevDoc = globalThis.document;
      // @ts-ignore
      globalThis.document = {
        getElementById: (id: string) => {
          if (id === 'task-target-val') return targetInput;
          if (id === 'task-unit-input') return unitInput;
          return null;
        },
        querySelectorAll: () => [],
      };

      try {
        const el = {
          taskTypeSelect: { value: 'percentage' },
          percentageGroup,
          milestonesGroup,
          milestonesBuilderList: { children: [] },
        };

        syncTaskTypeFormFields(el);

        // Form only asks for Target and Unit (no milestone inputs)
        expect(percentageGroup.hidden).toBe(false);
        expect(milestonesGroup.hidden).toBe(true);
        expect(targetInput.required).toBe(true);
        expect(unitInput.required).toBe(true);
      } finally {
        globalThis.document = prevDoc;
      }
    });

    it('creates Drink 4 L Water task, logs 2L (50% Remaining), logs 4L (Completed), pins chart & tests rollover', async () => {
      const { app } = await createTestApp();

      // Step 1: Create task
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/tasks',
        headers: authHeader,
        payload: {
          title: 'Drink 4 L Water',
          taskType: 'percentage',
          targetValue: 4,
          unit: 'L',
          recurrence: 'daily',
        },
      });

      expect(createRes.statusCode).toBe(201);
      const { task } = createRes.json();
      expect(task.title).toBe('Drink 4 L Water');
      expect(task.taskType).toBe('percentage');
      expect(task.targetValue).toBe(4);
      expect(task.unit).toBe('L');
      expect(task.recurrence).toBe('daily');

      // Step 2: Log progress — Enter 2L (50% progress)
      // Progress calculation in client: (2L / 4L) * 100 = 50%
      const log2LRes = await app.inject({
        method: 'POST',
        url: `/api/v1/tasks/${task.id}/events`,
        headers: authHeader,
        payload: {
          id: `evt_water_2L_${Date.now()}`,
          status: 'in_progress',
          progressPercentage: 50,
          occurredAt: '2026-11-08T10:00:00.000Z',
        },
      });
      expect(log2LRes.statusCode).toBe(201);

      // Verify active checklist at 2L
      const activeRes1 = await app.inject({
        method: 'GET',
        url: '/api/v1/tasks/active?asOf=2026-11-08T11:00:00.000Z&dayCutoffHour=3',
        headers: authHeader,
      });
      const checklist1 = activeRes1.json().checklist;
      const waterItem1 = checklist1.items.find((i: any) => i.task.id === task.id);
      expect(waterItem1).toBeDefined();
      expect(waterItem1.evaluation.status).toBe('in_progress');
      expect(waterItem1.evaluation.progressPercentage).toBe(50);

      // Verify UI Card rendering in 'Remaining Tasks' bucket
      const mockState = {
        features: { micronotes: true },
        pinnedCharts: [],
      };
      const cardHtml50 = renderTaskCard(waterItem1, mockState);
      expect(cardHtml50).toContain('2 / 4 L (50%)');
      expect(cardHtml50).toContain('status-in_progress');

      // Step 3: Enter 4L (100% progress) -> moves immediately to Completed bucket
      const log4LRes = await app.inject({
        method: 'POST',
        url: `/api/v1/tasks/${task.id}/events`,
        headers: authHeader,
        payload: {
          id: `evt_water_4L_${Date.now()}`,
          status: 'done',
          progressPercentage: 100,
          occurredAt: '2026-11-08T14:00:00.000Z',
        },
      });
      expect(log4LRes.statusCode).toBe(201);

      const activeRes2 = await app.inject({
        method: 'GET',
        url: '/api/v1/tasks/active?asOf=2026-11-08T15:00:00.000Z&dayCutoffHour=3',
        headers: authHeader,
      });
      const checklist2 = activeRes2.json().checklist;
      const waterItem2 = checklist2.items.find((i: any) => i.task.id === task.id);
      expect(waterItem2.evaluation.status).toBe('done');
      expect(waterItem2.evaluation.progressPercentage).toBe(100);

      const cardHtml100 = renderTaskCard(waterItem2, mockState);
      expect(cardHtml100).toContain('status-done');
      expect(cardHtml100).toContain('4 / 4 L (100%)');

      // Step 4: Pin Chart — Opens "Daily Volume Bars" with horizontal dashed goal line at 4L
      const eventsRes = await app.inject({
        method: 'GET',
        url: `/api/v1/tasks/${task.id}/events`,
        headers: authHeader,
      });
      const events = eventsRes.json().events;

      const chartSvg = generateTaskChartSvg(
        task,
        events,
        'volume_bar',
        { from: '2026-11-01T00:00:00.000Z', to: '2026-11-08T23:59:59.000Z' }
      );

      // Verify horizontal dashed goal line and Goal text
      expect(chartSvg.svgHtml).toContain('stroke-dasharray="4,4"');
      expect(chartSvg.svgHtml).toContain('Goal: 4 L');

      // Step 5: Day rollover — Next operational date progress resets to 0L
      const rolloverRes = await app.inject({
        method: 'GET',
        url: '/api/v1/tasks/active?asOf=2026-11-09T10:00:00.000Z&dayCutoffHour=3',
        headers: authHeader,
      });
      const rolloverChecklist = rolloverRes.json().checklist;
      expect(rolloverChecklist.operationalDate).toBe('2026-11-09');
      const rolloverWater = rolloverChecklist.items.find((i: any) => i.task.id === task.id);
      expect(rolloverWater).toBeDefined();
      expect(rolloverWater.evaluation.status).toBe('pending');
      expect(rolloverWater.evaluation.progressPercentage).toBe(0);

      const rolloverCard = renderTaskCard(rolloverWater, mockState);
      expect(rolloverCard).toContain('0 / 4 L (0%)');
    });
  });

  // =========================================================================
  // Scenario 2: Anytime / One-Time Task — "File Tax Documents"
  // =========================================================================
  describe('Scenario 2: Anytime / One-Time Task — "File Tax Documents"', () => {
    it('verifies form hides all recurrence subgroups when Flexible / Anytime is selected', () => {
      const daysOfWeekGroup = { hidden: false };
      const monthlyGroup = { hidden: false };
      const quarterlyGroup = { hidden: false };
      const yearlyGroup = { hidden: false };
      const cycleDaysGroup = { hidden: false };

      const prevDoc = globalThis.document;
      // @ts-ignore
      globalThis.document = {
        getElementById: (id: string) => {
          if (id === 'freq-days-of-week-group') return daysOfWeekGroup;
          if (id === 'freq-monthly-group') return monthlyGroup;
          if (id === 'freq-quarterly-group') return quarterlyGroup;
          if (id === 'freq-yearly-group') return yearlyGroup;
          if (id === 'cycle-days-group') return cycleDaysGroup;
          return null;
        },
      };

      try {
        const el = {
          recurrenceSelect: { value: 'anytime' },
        };
        syncRecurrenceFormFields(el);

        expect(daysOfWeekGroup.hidden).toBe(true);
        expect(monthlyGroup.hidden).toBe(true);
        expect(quarterlyGroup.hidden).toBe(true);
        expect(yearlyGroup.hidden).toBe(true);
        expect(cycleDaysGroup.hidden).toBe(true);
      } finally {
        globalThis.document = prevDoc;
      }
    });

    it('creates anytime task, toggles complete, verifies no rest button, and persists completed across future dates', async () => {
      const { app } = await createTestApp();

      // Step 1: Create task
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/tasks',
        headers: authHeader,
        payload: {
          title: 'File Tax Documents',
          taskType: 'checklist',
          recurrence: 'anytime',
        },
      });
      expect(createRes.statusCode).toBe(201);
      const { task } = createRes.json();
      expect(task.title).toBe('File Tax Documents');
      expect(task.recurrence).toBe('anytime');

      // Step 2: Verify task card does NOT display a rest-day button
      const activeResPending = await app.inject({
        method: 'GET',
        url: '/api/v1/tasks/active?asOf=2026-11-08T10:00:00.000Z',
        headers: authHeader,
      });
      const pendingItem = activeResPending.json().checklist.items.find((i: any) => i.task.id === task.id);
      expect(pendingItem.evaluation.status).toBe('pending');

      const mockState = {
        features: { micronotes: true },
        pinnedCharts: [],
      };
      const pendingCardHtml = renderTaskCard(pendingItem, mockState);
      // Verify rest-day button is completely absent
      expect(pendingCardHtml).not.toContain('btn-ignore');
      expect(pendingCardHtml).not.toContain('Rest / Skip');
      expect(pendingCardHtml).not.toContain('Resting (Exempt)');

      // Step 3: Toggle checkbox -> task completes and moves to Completed bucket
      const completeRes = await app.inject({
        method: 'POST',
        url: `/api/v1/tasks/${task.id}/events`,
        headers: authHeader,
        payload: {
          id: `evt_tax_${Date.now()}`,
          status: 'done',
          occurredAt: '2026-11-08T12:00:00.000Z',
        },
      });
      expect(completeRes.statusCode).toBe(201);

      const activeResDone = await app.inject({
        method: 'GET',
        url: '/api/v1/tasks/active?asOf=2026-11-08T12:30:00.000Z',
        headers: authHeader,
      });
      const doneItem = activeResDone.json().checklist.items.find((i: any) => i.task.id === task.id);
      expect(doneItem.evaluation.status).toBe('done');

      // Step 4: Verify across future operational dates (tomorrow, next month, next year)
      const futureDates = [
        '2026-11-09T10:00:00.000Z',
        '2026-12-01T10:00:00.000Z',
        '2027-04-15T10:00:00.000Z',
      ];

      for (const futureDate of futureDates) {
        const futureRes = await app.inject({
          method: 'GET',
          url: `/api/v1/tasks/active?asOf=${futureDate}`,
          headers: authHeader,
        });
        const futureChecklist = futureRes.json().checklist;
        const item = futureChecklist.items.find((i: any) => i.task.id === task.id);
        expect(item).toBeDefined();
        // Remains completed without resetting
        expect(item.evaluation.status).toBe('done');
        const futureCardHtml = renderTaskCard(item, mockState);
        expect(futureCardHtml).not.toContain('btn-ignore');
      }
    });
  });

  // =========================================================================
  // Scenario 3: Multi-Frequency Cadences (Daily, Weekly, Monthly, Quarterly, Yearly)
  // =========================================================================
  describe('Scenario 3: Multi-Frequency Cadences (Daily, Weekly, Monthly, Quarterly, Yearly)', () => {
    it('verifies strict form input isolation for each cadence selection', () => {
      const daysOfWeekGroup = { hidden: true };
      const monthlyGroup = { hidden: true };
      const quarterlyGroup = { hidden: true };
      const yearlyGroup = { hidden: true };
      const cycleDaysGroup = { hidden: true };

      const prevDoc = globalThis.document;
      // @ts-ignore
      globalThis.document = {
        getElementById: (id: string) => {
          if (id === 'freq-days-of-week-group') return daysOfWeekGroup;
          if (id === 'freq-monthly-group') return monthlyGroup;
          if (id === 'freq-quarterly-group') return quarterlyGroup;
          if (id === 'freq-yearly-group') return yearlyGroup;
          if (id === 'cycle-days-group') return cycleDaysGroup;
          return null;
        },
      };

      try {
        const el: any = { recurrenceSelect: { value: 'daily' } };

        // Test Daily
        el.recurrenceSelect.value = 'daily';
        syncRecurrenceFormFields(el);
        expect(daysOfWeekGroup.hidden).toBe(true);
        expect(monthlyGroup.hidden).toBe(true);
        expect(quarterlyGroup.hidden).toBe(true);
        expect(yearlyGroup.hidden).toBe(true);

        // Test Specific Days of Week
        el.recurrenceSelect.value = 'days_of_week';
        syncRecurrenceFormFields(el);
        expect(daysOfWeekGroup.hidden).toBe(false);
        expect(monthlyGroup.hidden).toBe(true);
        expect(quarterlyGroup.hidden).toBe(true);
        expect(yearlyGroup.hidden).toBe(true);

        // Test Monthly
        el.recurrenceSelect.value = 'monthly';
        syncRecurrenceFormFields(el);
        expect(daysOfWeekGroup.hidden).toBe(true);
        expect(monthlyGroup.hidden).toBe(false);
        expect(quarterlyGroup.hidden).toBe(true);
        expect(yearlyGroup.hidden).toBe(true);

        // Test Quarterly
        el.recurrenceSelect.value = 'quarterly';
        syncRecurrenceFormFields(el);
        expect(daysOfWeekGroup.hidden).toBe(true);
        expect(monthlyGroup.hidden).toBe(true);
        expect(quarterlyGroup.hidden).toBe(false);
        expect(yearlyGroup.hidden).toBe(true);

        // Test Yearly
        el.recurrenceSelect.value = 'yearly';
        syncRecurrenceFormFields(el);
        expect(daysOfWeekGroup.hidden).toBe(true);
        expect(monthlyGroup.hidden).toBe(true);
        expect(quarterlyGroup.hidden).toBe(true);
        expect(yearlyGroup.hidden).toBe(false);
      } finally {
        globalThis.document = prevDoc;
      }
    });

    it('creates 5 multi-frequency tasks and verifies scheduled vs off-schedule omission', async () => {
      const { app } = await createTestApp();

      // 1. Daily Meditation (Every Day)
      const t1 = (await app.inject({
        method: 'POST',
        url: '/api/v1/tasks',
        headers: authHeader,
        payload: {
          title: 'Daily Meditation',
          taskType: 'checklist',
          recurrence: 'daily',
        },
      })).json().task;

      // 2. Weekly Plan Review (Specific Days of Week -> Monday)
      const t2 = (await app.inject({
        method: 'POST',
        url: '/api/v1/tasks',
        headers: authHeader,
        payload: {
          title: 'Weekly Plan Review',
          taskType: 'checklist',
          recurrence: 'days_of_week',
          schedule: { cadence: { type: 'day_mask', days: ['mon'] } },
        },
      })).json().task;

      // 3. Monthly Budget Audit (Monthly -> Day 1)
      const t3 = (await app.inject({
        method: 'POST',
        url: '/api/v1/tasks',
        headers: authHeader,
        payload: {
          title: 'Monthly Budget Audit',
          taskType: 'checklist',
          recurrence: 'monthly',
          schedule: { cadence: { type: 'monthly', dayOfMonth: 1 } },
        },
      })).json().task;

      // 4. Quarterly OKR Review (Quarterly -> Day 1)
      const t4 = (await app.inject({
        method: 'POST',
        url: '/api/v1/tasks',
        headers: authHeader,
        payload: {
          title: 'Quarterly OKR Review',
          taskType: 'checklist',
          recurrence: 'quarterly',
          schedule: { cadence: { type: 'quarterly', dayOfMonth: 1 } },
        },
      })).json().task;

      // 5. Annual Health Checkup (Yearly -> Month 1, Day 15)
      const t5 = (await app.inject({
        method: 'POST',
        url: '/api/v1/tasks',
        headers: authHeader,
        payload: {
          title: 'Annual Health Checkup',
          taskType: 'checklist',
          recurrence: 'yearly',
          schedule: { cadence: { type: 'yearly', month: 1, dayOfMonth: 15 } },
        },
      })).json().task;

      // Check on 2026-11-08 (Sunday, Day 8, Month 11)
      // Only Daily Meditation should appear; all other 4 are off-schedule
      const resSunday = await app.inject({
        method: 'GET',
        url: '/api/v1/tasks/active?asOf=2026-11-08T12:00:00.000Z',
        headers: authHeader,
      });
      const itemsSunday = resSunday.json().checklist.items;
      const titlesSunday = itemsSunday.map((i: any) => i.task.title);

      expect(titlesSunday).toContain('Daily Meditation');
      expect(titlesSunday).not.toContain('Weekly Plan Review');
      expect(titlesSunday).not.toContain('Monthly Budget Audit');
      expect(titlesSunday).not.toContain('Quarterly OKR Review');
      expect(titlesSunday).not.toContain('Annual Health Checkup');

      // Check on 2024-01-01 (Monday, Month 1, Day 1 - Quarter 1, Day 1)
      // Daily (yes), Weekly Monday (yes), Monthly Day 1 (yes), Quarterly Jan 1 (yes), Annual Jan 15 (no)
      const resJan1 = await app.inject({
        method: 'GET',
        url: '/api/v1/tasks/active?asOf=2024-01-01T12:00:00.000Z',
        headers: authHeader,
      });
      const titlesJan1 = resJan1.json().checklist.items.map((i: any) => i.task.title);
      expect(titlesJan1).toContain('Daily Meditation');
      expect(titlesJan1).toContain('Weekly Plan Review');
      expect(titlesJan1).toContain('Monthly Budget Audit');
      expect(titlesJan1).toContain('Quarterly OKR Review');
      expect(titlesJan1).not.toContain('Annual Health Checkup');

      // Check on 2026-01-15 (Thursday, Month 1, Day 15)
      // Daily (yes), Annual Health Checkup (yes), Weekly (no), Monthly (no), Quarterly (no)
      const resJan15 = await app.inject({
        method: 'GET',
        url: '/api/v1/tasks/active?asOf=2026-01-15T12:00:00.000Z',
        headers: authHeader,
      });
      const titlesJan15 = resJan15.json().checklist.items.map((i: any) => i.task.title);
      expect(titlesJan15).toContain('Daily Meditation');
      expect(titlesJan15).toContain('Annual Health Checkup');
      expect(titlesJan15).not.toContain('Weekly Plan Review');
      expect(titlesJan15).not.toContain('Monthly Budget Audit');
      expect(titlesJan15).not.toContain('Quarterly OKR Review');
    });
  });

  // =========================================================================
  // Scenario 4: Alternate Workout Routine — "Workout Set A & Set B (Sunday Rest)"
  // =========================================================================
  describe('Scenario 4: Alternate Workout Routine — "Workout Set A & Set B (Sunday Rest)"', () => {
    it('verifies alternate days schedule and peaceful Sunday rest', async () => {
      const { app } = await createTestApp();

      // Task 1: "Workout - Set A" [Mon, Wed, Fri]
      await app.inject({
        method: 'POST',
        url: '/api/v1/tasks',
        headers: authHeader,
        payload: {
          title: 'Workout - Set A',
          taskType: 'checklist',
          recurrence: 'days_of_week',
          schedule: { cadence: { type: 'day_mask', days: ['mon', 'wed', 'fri'] } },
        },
      });

      // Task 2: "Workout - Set B" [Tue, Thu, Sat]
      await app.inject({
        method: 'POST',
        url: '/api/v1/tasks',
        headers: authHeader,
        payload: {
          title: 'Workout - Set B',
          taskType: 'checklist',
          recurrence: 'days_of_week',
          schedule: { cadence: { type: 'day_mask', days: ['tue', 'thu', 'sat'] } },
        },
      });

      // 1. Sunday (2026-11-08) — neither Set A nor Set B scheduled
      const sunRes = await app.inject({
        method: 'GET',
        url: '/api/v1/tasks/active?asOf=2026-11-08T12:00:00.000Z',
        headers: authHeader,
      });
      const sunTitles = sunRes.json().checklist.items.map((i: any) => i.task.title);
      expect(sunTitles).not.toContain('Workout - Set A');
      expect(sunTitles).not.toContain('Workout - Set B');
      expect(sunRes.json().checklist.summary.totalDue).toBe(0);

      // 2. Monday (2026-11-09) — only Set A
      const monRes = await app.inject({
        method: 'GET',
        url: '/api/v1/tasks/active?asOf=2026-11-09T12:00:00.000Z',
        headers: authHeader,
      });
      const monTitles = monRes.json().checklist.items.map((i: any) => i.task.title);
      expect(monTitles).toContain('Workout - Set A');
      expect(monTitles).not.toContain('Workout - Set B');

      // 3. Tuesday (2026-11-10) — only Set B
      const tueRes = await app.inject({
        method: 'GET',
        url: '/api/v1/tasks/active?asOf=2026-11-10T12:00:00.000Z',
        headers: authHeader,
      });
      const tueTitles = tueRes.json().checklist.items.map((i: any) => i.task.title);
      expect(tueTitles).not.toContain('Workout - Set A');
      expect(tueTitles).toContain('Workout - Set B');

      // 4. Wednesday (2026-11-11) — only Set A
      const wedRes = await app.inject({
        method: 'GET',
        url: '/api/v1/tasks/active?asOf=2026-11-11T12:00:00.000Z',
        headers: authHeader,
      });
      const wedTitles = wedRes.json().checklist.items.map((i: any) => i.task.title);
      expect(wedTitles).toContain('Workout - Set A');
      expect(wedTitles).not.toContain('Workout - Set B');

      // 5. Thursday (2026-11-12) — only Set B
      const thuRes = await app.inject({
        method: 'GET',
        url: '/api/v1/tasks/active?asOf=2026-11-12T12:00:00.000Z',
        headers: authHeader,
      });
      const thuTitles = thuRes.json().checklist.items.map((i: any) => i.task.title);
      expect(thuTitles).not.toContain('Workout - Set A');
      expect(thuTitles).toContain('Workout - Set B');

      // 6. Friday (2026-11-13) — only Set A
      const friRes = await app.inject({
        method: 'GET',
        url: '/api/v1/tasks/active?asOf=2026-11-13T12:00:00.000Z',
        headers: authHeader,
      });
      const friTitles = friRes.json().checklist.items.map((i: any) => i.task.title);
      expect(friTitles).toContain('Workout - Set A');
      expect(friTitles).not.toContain('Workout - Set B');

      // 7. Saturday (2026-11-14) — only Set B
      const satRes = await app.inject({
        method: 'GET',
        url: '/api/v1/tasks/active?asOf=2026-11-14T12:00:00.000Z',
        headers: authHeader,
      });
      const satTitles = satRes.json().checklist.items.map((i: any) => i.task.title);
      expect(satTitles).not.toContain('Workout - Set A');
      expect(satTitles).toContain('Workout - Set B');
    });
  });

  // =========================================================================
  // Scenario 5: Chart Reordering & Milestone Visualization
  // =========================================================================
  describe('Scenario 5: Chart Reordering & Milestone Visualization', () => {
    it('pins Drinking Water and Pushups charts, reorders with Move Up to top', () => {
      // Simulate pinnedCharts state
      const pinnedCharts = [
        { taskId: 'tsk_pushups_1', chartType: 'auto' },
        { taskId: 'tsk_water_1', chartType: 'auto' },
      ];

      // Click "▲ Move Up" on Drinking Water (index 1)
      const idx = pinnedCharts.findIndex((c) => c.taskId === 'tsk_water_1');
      expect(idx).toBe(1);

      if (idx > 0) {
        const item = pinnedCharts.splice(idx, 1)[0];
        pinnedCharts.splice(idx - 1, 0, item);
      }

      // Drinking Water is now at the very top (index 0)
      expect(pinnedCharts[0].taskId).toBe('tsk_water_1');
      expect(pinnedCharts[1].taskId).toBe('tsk_pushups_1');
    });

    it('renders Rhythm Matrix for milestone task and verifies GitHub-style contribution squares intensity (0%, 25%, 50%, 75%, 100%)', () => {
      const milestoneTask = {
        id: 'tsk_routine_1',
        title: 'Core & Mobility Routine',
        taskType: 'milestone',
        recurrence: 'daily',
        targetValue: null,
        unit: null,
        milestones: [
          { id: 'mls_1', label: 'Plank 2m' },
          { id: 'mls_2', label: 'Stretches' },
          { id: 'mls_3', label: 'Pushups 30' },
          { id: 'mls_4', label: 'Deep Breathing' },
        ],
      };

      // Create events for 5 days demonstrating 0%, 25%, 50%, 75%, 100% completion
      const events = [
        // 2026-11-04: 1 milestone done -> 25%
        { taskId: 'tsk_routine_1', status: 'done', milestoneId: 'mls_1', occurredAt: '2026-11-04T08:00:00.000Z' },
        // 2026-11-05: 2 milestones done -> 50%
        { taskId: 'tsk_routine_1', status: 'done', milestoneId: 'mls_1', occurredAt: '2026-11-05T08:00:00.000Z' },
        { taskId: 'tsk_routine_1', status: 'done', milestoneId: 'mls_2', occurredAt: '2026-11-05T09:00:00.000Z' },
        // 2026-11-06: 3 milestones done -> 75%
        { taskId: 'tsk_routine_1', status: 'done', milestoneId: 'mls_1', occurredAt: '2026-11-06T08:00:00.000Z' },
        { taskId: 'tsk_routine_1', status: 'done', milestoneId: 'mls_2', occurredAt: '2026-11-06T09:00:00.000Z' },
        { taskId: 'tsk_routine_1', status: 'done', milestoneId: 'mls_3', occurredAt: '2026-11-06T10:00:00.000Z' },
        // 2026-11-07: 4 milestones done -> 100%
        { taskId: 'tsk_routine_1', status: 'done', milestoneId: 'mls_1', occurredAt: '2026-11-07T08:00:00.000Z' },
        { taskId: 'tsk_routine_1', status: 'done', milestoneId: 'mls_2', occurredAt: '2026-11-07T09:00:00.000Z' },
        { taskId: 'tsk_routine_1', status: 'done', milestoneId: 'mls_3', occurredAt: '2026-11-07T10:00:00.000Z' },
        { taskId: 'tsk_routine_1', status: 'done', milestoneId: 'mls_4', occurredAt: '2026-11-07T11:00:00.000Z' },
        // 2026-11-08: 0 milestones (rest / open day) -> 0%
      ];

      const chart = generateTaskChartSvg(
        milestoneTask,
        events,
        'rhythm_matrix',
        { from: '2026-11-02T00:00:00.000Z', to: '2026-11-08T23:59:59.000Z' }
      );

      // Verify the generated SVG includes intensity data attributes and colors:
      // Level 0: 0% completion -> rgba(255, 255, 255, 0.06)
      expect(chart.svgHtml).toContain('data-intensity="0"');
      expect(chart.svgHtml).toContain('data-pct="0"');
      expect(chart.svgHtml).toContain('fill="rgba(255, 255, 255, 0.06)"');

      // Level 1: 25% completion -> #064e3b
      expect(chart.svgHtml).toContain('data-intensity="1"');
      expect(chart.svgHtml).toContain('data-pct="25"');
      expect(chart.svgHtml).toContain('fill="#064e3b"');
      expect(chart.svgHtml).toContain('25% Completed');

      // Level 2: 50% completion -> #047857
      expect(chart.svgHtml).toContain('data-intensity="2"');
      expect(chart.svgHtml).toContain('data-pct="50"');
      expect(chart.svgHtml).toContain('fill="#047857"');
      expect(chart.svgHtml).toContain('50% Completed');

      // Level 3: 75% completion -> #059669
      expect(chart.svgHtml).toContain('data-intensity="3"');
      expect(chart.svgHtml).toContain('data-pct="75"');
      expect(chart.svgHtml).toContain('fill="#059669"');
      expect(chart.svgHtml).toContain('75% Completed');

      // Level 4: 100% completion -> #10B981
      expect(chart.svgHtml).toContain('data-intensity="4"');
      expect(chart.svgHtml).toContain('data-pct="100"');
      expect(chart.svgHtml).toContain('fill="#10B981"');
      expect(chart.svgHtml).toContain('100% Completed');
    });
  });

  // =========================================================================
  // Scenario 6: Office Tasks on Weekdays
  // =========================================================================
  describe('Scenario 6: Office Tasks on Weekdays', () => {
    it('assigns task to cyan Work group, verifies badge & dot, tab filtering, and weekend omission', async () => {
      const { app } = await createTestApp();

      // 1. Create Personal group and Work group (cyan #06B6D4)
      const personalGroupRes = await app.inject({
        method: 'POST',
        url: '/api/v1/groups',
        headers: authHeader,
        payload: {
          name: 'Personal',
          color: '#8B5CF6',
          sortOrder: 1,
        },
      });
      const personalGroup = personalGroupRes.json().group;

      const workGroupRes = await app.inject({
        method: 'POST',
        url: '/api/v1/groups',
        headers: authHeader,
        payload: {
          name: 'Work',
          color: '#06B6D4',
          sortOrder: 2,
        },
      });
      const workGroup = workGroupRes.json().group;
      expect(workGroup.color).toBe('#06B6D4');

      // 2. Assign "Daily Standup Notes" to "Work" group with [Mon, Tue, Wed, Thu, Fri]
      const workTaskRes = await app.inject({
        method: 'POST',
        url: '/api/v1/tasks',
        headers: authHeader,
        payload: {
          title: 'Daily Standup Notes',
          groupId: workGroup.id,
          taskType: 'checklist',
          recurrence: 'days_of_week',
          schedule: { cadence: { type: 'day_mask', days: ['mon', 'tue', 'wed', 'thu', 'fri'] } },
        },
      });
      expect(workTaskRes.statusCode).toBe(201);
      const workTask = workTaskRes.json().task;
      expect(workTask.groupId).toBe(workGroup.id);

      // Create a personal task for comparison
      await app.inject({
        method: 'POST',
        url: '/api/v1/tasks',
        headers: authHeader,
        payload: {
          title: 'Personal Journaling',
          groupId: personalGroup.id,
          taskType: 'checklist',
          recurrence: 'daily',
        },
      });

      // 3. Verify task carries cyan Work badge and dot
      const mondayAsOf = '2026-11-09T10:00:00.000Z';
      const mondayRes = await app.inject({
        method: 'GET',
        url: `/api/v1/tasks/active?asOf=${mondayAsOf}`,
        headers: authHeader,
      });
      const mondayChecklist = mondayRes.json().checklist;
      const standupItem = mondayChecklist.items.find((i: any) => i.task.id === workTask.id);
      expect(standupItem).toBeDefined();

      const mockState = {
        features: { micronotes: true },
        pinnedCharts: [],
      };
      const cardHtml = renderTaskCard(standupItem, mockState);

      // Verify cyan dot and Work group label
      expect(cardHtml).toContain('background: #06B6D4');
      expect(cardHtml).toContain('Work');

      // 4. Tab filtering: Clicking "Work" group isolates work tasks; clicking "Personal" hides work tasks
      const allItems = mondayChecklist.items;

      // Filter: Work
      const workFiltered = allItems.filter((i: any) => i.task.groupId === workGroup.id);
      expect(workFiltered.length).toBe(1);
      expect(workFiltered[0].task.title).toBe('Daily Standup Notes');

      // Filter: Personal
      const personalFiltered = allItems.filter((i: any) => i.task.groupId === personalGroup.id);
      expect(personalFiltered.length).toBe(1);
      expect(personalFiltered[0].task.title).toBe('Personal Journaling');
      expect(personalFiltered.map((i: any) => i.task.title)).not.toContain('Daily Standup Notes');

      // 5. Weekend omission: Saturday and Sunday automatically omit Daily Standup Notes
      const saturdayAsOf = '2026-11-14T10:00:00.000Z';
      const satRes = await app.inject({
        method: 'GET',
        url: `/api/v1/tasks/active?asOf=${saturdayAsOf}`,
        headers: authHeader,
      });
      const satTitles = satRes.json().checklist.items.map((i: any) => i.task.title);
      expect(satTitles).not.toContain('Daily Standup Notes');

      const sundayAsOf = '2026-11-15T10:00:00.000Z';
      const sunRes = await app.inject({
        method: 'GET',
        url: `/api/v1/tasks/active?asOf=${sundayAsOf}`,
        headers: authHeader,
      });
      const sunTitles = sunRes.json().checklist.items.map((i: any) => i.task.title);
      expect(sunTitles).not.toContain('Daily Standup Notes');
    });
  });
});
