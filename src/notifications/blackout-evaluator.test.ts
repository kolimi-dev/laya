import { describe, expect, it } from 'vitest';
import { QuietWindow } from '../domain/types.js';
import { evaluateQuietWindow } from './blackout-evaluator.js';

describe('Quiet Window Blackout Evaluator', () => {
  describe('Standard Same-Day Window (e.g. Deep Work 14:00 - 16:00)', () => {
    const deepWorkWindow: QuietWindow = {
      id: 'qw_deep_work',
      name: 'Deep Work Hours',
      startHour: 14,
      startMinute: 0,
      endHour: 16,
      endMinute: 0,
      action: 'downgrade_to_silent',
    };

    it('identifies 14:30 as active blackout', () => {
      const res = evaluateQuietWindow({
        referenceTime: '2026-11-07T14:30:00.000Z',
        quietWindows: [deepWorkWindow],
        timezone: 'UTC',
      });
      expect(res.isBlackout).toBe(true);
      expect(res.activeWindow?.id).toBe('qw_deep_work');
    });

    it('identifies 16:15 as outside blackout', () => {
      const res = evaluateQuietWindow({
        referenceTime: '2026-11-07T16:15:00.000Z',
        quietWindows: [deepWorkWindow],
        timezone: 'UTC',
      });
      expect(res.isBlackout).toBe(false);
    });
  });

  describe('Cross-Midnight Sleep Window (22:00 - 07:30)', () => {
    const sleepWindow: QuietWindow = {
      id: 'qw_sleep',
      name: 'Night Sleep',
      startHour: 22,
      startMinute: 0,
      endHour: 7,
      endMinute: 30,
      action: 'downgrade_to_silent',
    };

    it('identifies late evening 23:15 as inside blackout', () => {
      const res = evaluateQuietWindow({
        referenceTime: '2026-11-07T23:15:00.000Z',
        quietWindows: [sleepWindow],
        timezone: 'UTC',
      });
      expect(res.isBlackout).toBe(true);
      expect(res.activeWindow?.id).toBe('qw_sleep');
    });

    it('identifies early morning 02:30 as inside blackout', () => {
      const res = evaluateQuietWindow({
        referenceTime: '2026-11-08T02:30:00.000Z',
        quietWindows: [sleepWindow],
        timezone: 'UTC',
      });
      expect(res.isBlackout).toBe(true);
      expect(res.activeWindow?.id).toBe('qw_sleep');
    });

    it('identifies 07:15 as inside blackout', () => {
      const res = evaluateQuietWindow({
        referenceTime: '2026-11-08T07:15:00.000Z',
        quietWindows: [sleepWindow],
        timezone: 'UTC',
      });
      expect(res.isBlackout).toBe(true);
    });

    it('identifies 08:00 as outside blackout', () => {
      const res = evaluateQuietWindow({
        referenceTime: '2026-11-08T08:00:00.000Z',
        quietWindows: [sleepWindow],
        timezone: 'UTC',
      });
      expect(res.isBlackout).toBe(false);
    });
  });

  describe('Group-Scoped & Day-Filtered Blackouts', () => {
    const officeWeekendWindow: QuietWindow = {
      id: 'qw_office_weekend',
      name: 'No Office Reminders on Weekends',
      startHour: 0,
      startMinute: 0,
      endHour: 23,
      endMinute: 59,
      daysOfWeek: ['sat', 'sun'],
      groupId: 'grp_01H7AF12C3D4E5F6G7H8J9K0O1', // Applies only to Office
      action: 'downgrade_to_silent',
    };

    it('silences office tasks on Saturday', () => {
      // 2026-11-07 is Saturday
      const res = evaluateQuietWindow({
        referenceTime: '2026-11-07T11:00:00.000Z',
        quietWindows: [officeWeekendWindow],
        groupId: 'grp_01H7AF12C3D4E5F6G7H8J9K0O1',
        timezone: 'UTC',
      });
      expect(res.isBlackout).toBe(true);
    });

    it('allows health tasks on Saturday even when office is silenced', () => {
      const res = evaluateQuietWindow({
        referenceTime: '2026-11-07T11:00:00.000Z',
        quietWindows: [officeWeekendWindow],
        groupId: 'grp_01H7AF12C3D4E5F6G7H8J9K0H1', // Health group
        timezone: 'UTC',
      });
      expect(res.isBlackout).toBe(false);
    });

    it('allows office tasks on Tuesday (outside weekend blackout)', () => {
      // 2026-11-10 is Tuesday
      const res = evaluateQuietWindow({
        referenceTime: '2026-11-10T11:00:00.000Z',
        quietWindows: [officeWeekendWindow],
        groupId: 'grp_01H7AF12C3D4E5F6G7H8J9K0O1',
        timezone: 'UTC',
      });
      expect(res.isBlackout).toBe(false);
    });
  });
});
