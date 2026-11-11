/**
 * Laya (లయ) — Sample Habit Seeder
 * Populates realistic multi-week history for personal tracking exploration.
 */

import { api } from '../core/api.js';

export async function seedSampleHabits(token) {
  const personalGroup = await api('/api/v1/groups', {
    method: 'POST',
    body: JSON.stringify({ name: 'Personal', color: '#8B5CF6', sortOrder: 1 }),
  }, token).catch(() => null);

  await api('/api/v1/groups', {
    method: 'POST',
    body: JSON.stringify({ name: 'Work', color: '#06B6D4', sortOrder: 2 }),
  }, token).catch(() => null);

  const waterTaskRes = await api('/api/v1/tasks', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Drink Water Throughout Day',
      groupId: personalGroup?.group?.id,
      taskType: 'percentage',
      recurrence: 'daily',
      targetValue: 3,
      unit: 'L',
    }),
  }, token).catch(() => null);

  const readTaskRes = await api('/api/v1/tasks', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Deep Focus Reading',
      groupId: personalGroup?.group?.id,
      taskType: 'percentage',
      recurrence: 'daily',
      targetValue: 50,
      unit: 'pages',
    }),
  }, token).catch(() => null);

  const pushupTaskRes = await api('/api/v1/tasks', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Morning Pushups & Mobility Stretch',
      groupId: personalGroup?.group?.id,
      taskType: 'checklist',
      recurrence: 'daily',
    }),
  }, token).catch(() => null);

  const now = new Date();
  const waterId = waterTaskRes?.task?.id;
  const readId = readTaskRes?.task?.id;
  const pushupId = pushupTaskRes?.task?.id;

  for (let i = 21; i >= 1; i--) {
    const pastDate = new Date(now.getTime() - i * 86400000).toISOString();
    if (waterId) {
      const liters = (i % 7 === 0) ? 1.5 : (i % 3 === 0) ? 3.0 : 2.5;
      await api(`/api/v1/tasks/${waterId}/events`, {
        method: 'POST',
        body: JSON.stringify({
          id: `evt_w_${i}_${Date.now()}`,
          occurredAt: pastDate,
          status: liters >= 3 ? 'done' : 'in_progress',
          progressPercentage: Math.round((liters / 3) * 100),
        }),
      }, token).catch(() => null);
    }

    if (readId && i % 2 === 0) {
      const pages = 30 + (i % 5) * 6;
      await api(`/api/v1/tasks/${readId}/events`, {
        method: 'POST',
        body: JSON.stringify({
          id: `evt_r_${i}_${Date.now()}`,
          occurredAt: pastDate,
          status: pages >= 50 ? 'done' : 'in_progress',
          progressPercentage: Math.round((pages / 50) * 100),
        }),
      }, token).catch(() => null);
    }

    if (pushupId) {
      const isRest = i % 6 === 0;
      await api(`/api/v1/tasks/${pushupId}/events`, {
        method: 'POST',
        body: JSON.stringify({
          id: `evt_p_${i}_${Date.now()}`,
          occurredAt: pastDate,
          status: isRest ? 'ignored' : 'done',
          notes: isRest ? 'Intentional rest day' : undefined,
        }),
      }, token).catch(() => null);
    }
  }
}
