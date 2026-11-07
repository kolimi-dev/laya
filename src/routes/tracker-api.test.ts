import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { buildApp } from '../app.js';
import { MockJwtVerifier } from '../auth/jwt-verifier.js';
import { InMemoryTrackerRepository } from '../storage/in-memory-tracker-repository.js';
import { AuthenticatedUser } from '../auth/types.js';

describe('Laya Tracker Fastify API Endpoints', () => {
  const userA: AuthenticatedUser = {
    userId: 'usr_alice_123',
    phone: '+919876543210',
    roles: ['user'],
    sessionId: 'sid_alice',
  };

  const userB: AuthenticatedUser = {
    userId: 'usr_bob_456',
    phone: '+919876543211',
    roles: ['user'],
    sessionId: 'sid_bob',
  };

  const authHeaderA = { authorization: 'Bearer token_for_alice' };
  const authHeaderB = { authorization: 'Bearer token_for_bob' };

  async function createTestApp() {
    const repository = new InMemoryTrackerRepository();
    const verifier = new (class extends MockJwtVerifier {
      async verifyToken(token: string): Promise<AuthenticatedUser> {
        if (token === 'token_for_alice') return userA;
        if (token === 'token_for_bob') return userB;
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

  // 1. Healthcheck
  it('GET /api/v1/health returns 200 without authentication', async () => {
    const { app } = await createTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/health',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.status).toBe('ok');
    expect(body.service).toBe('laya');
  });

  // 2. Authentication and RFC 7807 Error Handling
  it('rejects unauthenticated requests with RFC 7807 401 Unauthorized', async () => {
    const { app } = await createTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/groups',
    });

    expect(response.statusCode).toBe(401);
    expect(response.headers['content-type']).toContain('application/problem+json');
    const body = response.json();
    expect(body.code).toBe('AUTH_UNAUTHORIZED');
    expect(body.status).toBe(401);
  });

  it('rejects malformed token with RFC 7807 401', async () => {
    const { app } = await createTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/groups',
      headers: { authorization: 'Bearer invalid_token' },
    });

    expect(response.statusCode).toBe(401);
    const body = response.json();
    expect(body.code).toBe('AUTH_INVALID_TOKEN');
  });

  it('rejects expired token with RFC 7807 401', async () => {
    const { app } = await createTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/groups',
      headers: { authorization: 'Bearer expired_token' },
    });

    expect(response.statusCode).toBe(401);
    const body = response.json();
    expect(body.code).toBe('AUTH_EXPIRED_TOKEN');
  });

  it('returns RFC 7807 404 for non-existent routes', async () => {
    const { app } = await createTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/unknown-route',
    });

    expect(response.statusCode).toBe(404);
    const body = response.json();
    expect(body.code).toBe('ROUTE_NOT_FOUND');
  });

  // 3. Group Operations
  it('manages user groups (CRUD) with validation', async () => {
    const { app } = await createTestApp();

    // Validation failure on empty name
    const invalidCreate = await app.inject({
      method: 'POST',
      url: '/api/v1/groups',
      headers: authHeaderA,
      payload: { name: '' },
    });
    expect(invalidCreate.statusCode).toBe(400);
    expect(invalidCreate.json().code).toBe('VALIDATION_FAILED');

    // Create group
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/groups',
      headers: authHeaderA,
      payload: {
        name: 'Health & Fitness',
        color: '#10B981',
        sortOrder: 1,
      },
    });
    expect(createRes.statusCode).toBe(201);
    const createdGroup = createRes.json().group;
    expect(createdGroup.id).toMatch(/^grp_/);
    expect(createdGroup.name).toBe('Health & Fitness');

    // List groups
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/v1/groups',
      headers: authHeaderA,
    });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json().groups).toHaveLength(1);

    // Get single group
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/v1/groups/${createdGroup.id}`,
      headers: authHeaderA,
    });
    expect(getRes.statusCode).toBe(200);
    expect(getRes.json().group.name).toBe('Health & Fitness');

    // Update group
    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/groups/${createdGroup.id}`,
      headers: authHeaderA,
      payload: { name: 'Active Living' },
    });
    expect(patchRes.statusCode).toBe(200);
    expect(patchRes.json().group.name).toBe('Active Living');

    // Soft delete group
    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/groups/${createdGroup.id}`,
      headers: authHeaderA,
    });
    expect(deleteRes.statusCode).toBe(204);

    // Check it is deleted
    const postDeleteList = await app.inject({
      method: 'GET',
      url: '/api/v1/groups',
      headers: authHeaderA,
    });
    expect(postDeleteList.json().groups).toHaveLength(0);
  });

  // 4. Task Operations & Flavors
  it('creates and manages milestone, percentage, and checklist tasks', async () => {
    const { app } = await createTestApp();

    // 1. Milestone Task
    const milestoneRes = await app.inject({
      method: 'POST',
      url: '/api/v1/tasks',
      headers: authHeaderA,
      payload: {
        title: 'Drink 3L Daily Water',
        taskType: 'milestone',
        recurrence: 'daily',
        unit: 'L',
        milestones: ['1L', '2L', '3L'],
      },
    });
    expect(milestoneRes.statusCode).toBe(201);
    const milestoneBody = milestoneRes.json();
    expect(milestoneBody.task.id).toMatch(/^tsk_/);
    expect(milestoneBody.milestones).toHaveLength(3);
    expect(milestoneBody.milestones[0].label).toBe('1L');

    // 2. Percentage Task
    const percentageRes = await app.inject({
      method: 'POST',
      url: '/api/v1/tasks',
      headers: authHeaderA,
      payload: {
        title: 'Read Book Module',
        taskType: 'percentage',
        recurrence: 'daily',
        targetValue: 50,
        unit: 'pages',
      },
    });
    expect(percentageRes.statusCode).toBe(201);
    expect(percentageRes.json().task.taskType).toBe('percentage');

    // 3. Binary Checklist Task
    const checklistRes = await app.inject({
      method: 'POST',
      url: '/api/v1/tasks',
      headers: authHeaderA,
      payload: {
        title: 'Morning Pushups',
        taskType: 'checklist',
        recurrence: 'daily',
      },
    });
    expect(checklistRes.statusCode).toBe(201);
    const taskId = checklistRes.json().task.id;

    // 4. List Tasks
    const listTasks = await app.inject({
      method: 'GET',
      url: '/api/v1/tasks',
      headers: authHeaderA,
    });
    expect(listTasks.statusCode).toBe(200);
    expect(listTasks.json().tasks).toHaveLength(3);

    // 5. Update Task
    const updateTaskRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/tasks/${taskId}`,
      headers: authHeaderA,
      payload: { title: 'Morning Pushups (Set 1 & 2)' },
    });
    expect(updateTaskRes.statusCode).toBe(200);
    expect(updateTaskRes.json().task.title).toBe('Morning Pushups (Set 1 & 2)');

    // 6. Archive Task
    const archiveRes = await app.inject({
      method: 'POST',
      url: `/api/v1/tasks/${taskId}/archive`,
      headers: authHeaderA,
    });
    expect(archiveRes.statusCode).toBe(200);
    expect(archiveRes.json().task.archivedAt).toBeDefined();

    // List without archived should now return 2
    const activeOnly = await app.inject({
      method: 'GET',
      url: '/api/v1/tasks',
      headers: authHeaderA,
    });
    expect(activeOnly.json().tasks).toHaveLength(2);
  });

  // 5. Active Today's Checklist
  it('computes dynamic active checklist as of a reference date', async () => {
    const { app } = await createTestApp();

    await app.inject({
      method: 'POST',
      url: '/api/v1/tasks',
      headers: authHeaderA,
      payload: {
        title: 'Daily Meditation',
        taskType: 'checklist',
        recurrence: 'daily',
      },
    });

    const activeRes = await app.inject({
      method: 'GET',
      url: '/api/v1/tasks/active?asOf=2026-11-07T10:00:00.000Z',
      headers: authHeaderA,
    });

    expect(activeRes.statusCode).toBe(200);
    const body = activeRes.json();
    expect(body.checklist).toBeDefined();
    expect(body.checklist.items).toHaveLength(1);
    expect(body.checklist.items[0].task.title).toBe('Daily Meditation');
  });

  // 6. Event Logging & Idempotency
  it('records completion events with client UUID idempotency', async () => {
    const { app } = await createTestApp();

    const taskRes = await app.inject({
      method: 'POST',
      url: '/api/v1/tasks',
      headers: authHeaderA,
      payload: {
        title: 'Evening Run',
        taskType: 'checklist',
        recurrence: 'daily',
      },
    });
    const taskId = taskRes.json().task.id;
    const clientEventId = randomUUID();

    // 1. Record event
    const eventRes1 = await app.inject({
      method: 'POST',
      url: `/api/v1/tasks/${taskId}/events`,
      headers: authHeaderA,
      payload: {
        id: clientEventId,
        status: 'done',
        notes: 'Ran 5km smoothly',
      },
    });
    expect(eventRes1.statusCode).toBe(201);
    expect(eventRes1.json().recorded).toBe(true);
    expect(eventRes1.json().isDuplicate).toBe(false);

    // 2. Re-send exact same client UUID (Idempotent duplicate check)
    const eventRes2 = await app.inject({
      method: 'POST',
      url: `/api/v1/tasks/${taskId}/events`,
      headers: authHeaderA,
      payload: {
        id: clientEventId,
        status: 'done',
        notes: 'Ran 5km smoothly',
      },
    });
    expect(eventRes2.statusCode).toBe(200);
    expect(eventRes2.json().isDuplicate).toBe(true);

    // 3. Get event history
    const historyRes = await app.inject({
      method: 'GET',
      url: `/api/v1/tasks/${taskId}/events`,
      headers: authHeaderA,
    });
    expect(historyRes.statusCode).toBe(200);
    expect(historyRes.json().events).toHaveLength(1);
  });

  // 7. Guilt-Free Consistency Summary
  it('computes guilt-free consistency rating excluding Ignored tasks from denominator', async () => {
    const { app } = await createTestApp();

    // Task 1: Done
    const t1Res = await app.inject({
      method: 'POST',
      url: '/api/v1/tasks',
      headers: authHeaderA,
      payload: { title: 'Habit 1', taskType: 'checklist', recurrence: 'daily' },
    });
    const t1Id = t1Res.json().task.id;

    // Task 2: Ignored (Rest day / Illness)
    const t2Res = await app.inject({
      method: 'POST',
      url: '/api/v1/tasks',
      headers: authHeaderA,
      payload: { title: 'Habit 2', taskType: 'checklist', recurrence: 'daily' },
    });
    const t2Id = t2Res.json().task.id;

    // Log Done on Task 1
    await app.inject({
      method: 'POST',
      url: `/api/v1/tasks/${t1Id}/events`,
      headers: authHeaderA,
      payload: { id: randomUUID(), status: 'done' },
    });

    // Log Ignored on Task 2
    await app.inject({
      method: 'POST',
      url: `/api/v1/tasks/${t2Id}/events`,
      headers: authHeaderA,
      payload: { id: randomUUID(), status: 'ignored', notes: 'Rest day' },
    });

    // Calculate Consistency
    const summaryRes = await app.inject({
      method: 'GET',
      url: '/api/v1/consistency/summary',
      headers: authHeaderA,
    });

    expect(summaryRes.statusCode).toBe(200);
    const summary = summaryRes.json().overall;

    // Total: 2 tasks scheduled. 1 Ignored. Effective denominator = 1. Completed = 1.
    // Consistency = (1 / (2 - 1)) * 100 = 100.00%
    expect(summary.totalScheduledTasks).toBe(2);
    expect(summary.totalIgnoredPoints).toBe(1.0);
    expect(summary.effectiveDenominator).toBe(1.0);
    expect(summary.totalCompletedPoints).toBe(1.0);
    expect(summary.consistencyPercentage).toBe(100.0);
  });

  // 8. Data Portability (Export & Import)
  it('exports user data and supports full backup restore', async () => {
    const { app } = await createTestApp();

    await app.inject({
      method: 'POST',
      url: '/api/v1/tasks',
      headers: authHeaderA,
      payload: { title: 'Exportable Habit', taskType: 'checklist', recurrence: 'daily' },
    });

    // Export data
    const exportRes = await app.inject({
      method: 'GET',
      url: '/api/v1/data/export',
      headers: authHeaderA,
    });
    expect(exportRes.statusCode).toBe(200);
    const exportPayload = exportRes.json().data;
    expect(exportPayload.userId).toBe('usr_alice_123');
    expect(exportPayload.tasks).toHaveLength(1);

    // Simulate restoring onto a clean/new device
    const { app: newDeviceApp } = await createTestApp();
    const importRes = await newDeviceApp.inject({
      method: 'POST',
      url: '/api/v1/data/import',
      headers: authHeaderA,
      payload: {
        groups: exportPayload.groups,
        tasks: exportPayload.tasks,
        milestones: exportPayload.milestones,
        events: exportPayload.events,
      },
    });
    expect(importRes.statusCode).toBe(200);
    expect(importRes.json().success).toBe(true);

    // Verify Alice has the restored task on her new device
    const restoredTasks = await newDeviceApp.inject({
      method: 'GET',
      url: '/api/v1/tasks',
      headers: authHeaderA,
    });
    expect(restoredTasks.json().tasks).toHaveLength(1);
    expect(restoredTasks.json().tasks[0].task.title).toBe('Exportable Habit');
  });

  // 9. Universal Feedback Submission
  it('accepts user feedback and returns 201 with feedbackId', async () => {
    const { app } = await createTestApp();

    const feedbackRes = await app.inject({
      method: 'POST',
      url: '/api/v1/feedback',
      headers: authHeaderA,
      payload: {
        category: 'feature_request',
        message: 'Would love an Apple Watch complication for checking habits!',
      },
    });

    expect(feedbackRes.statusCode).toBe(201);
    const body = feedbackRes.json();
    expect(body.success).toBe(true);
    expect(body.feedbackId).toMatch(/^fbk_/);
    expect(body.category).toBe('feature_request');
  });

  // 10. Multi-tenant Isolation
  it('enforces strict multi-tenant data isolation between users', async () => {
    const { app } = await createTestApp();

    // Alice creates a task
    const aliceTaskRes = await app.inject({
      method: 'POST',
      url: '/api/v1/tasks',
      headers: authHeaderA,
      payload: { title: "Alice's Secret Habit", taskType: 'checklist', recurrence: 'daily' },
    });
    const aliceTaskId = aliceTaskRes.json().task.id;

    // Bob tries to access Alice's task -> 404
    const bobAccessRes = await app.inject({
      method: 'GET',
      url: `/api/v1/tasks/${aliceTaskId}`,
      headers: authHeaderB,
    });
    expect(bobAccessRes.statusCode).toBe(404);
    expect(bobAccessRes.json().code).toBe('TRACKER_TASK_NOT_FOUND');

    // Bob tries to log event on Alice's task -> 404
    const bobEventRes = await app.inject({
      method: 'POST',
      url: `/api/v1/tasks/${aliceTaskId}/events`,
      headers: authHeaderB,
      payload: { id: randomUUID(), status: 'done' },
    });
    expect(bobEventRes.statusCode).toBe(404);
  });
});
