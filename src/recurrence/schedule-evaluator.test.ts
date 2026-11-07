import { describe, expect, it } from 'vitest';
import {
  getOperationalDate,
  isScheduleActiveOnDate,
} from './schedule-evaluator.js';
import { WorkSchedule } from '../domain/types.js';

describe('Schedule Evaluator & Night Owl Offset', () => {
  describe('Day-Rollover Anchor (Night Owl Offset)', () => {
    it('shifts 01:45 AM back to yesterday when dayCutoffHour is 3 (03:00 AM)', () => {
      // 2026-11-08 01:45 UTC
      const date = new Date('2026-11-08T01:45:00.000Z');
      const op = getOperationalDate(date, { dayCutoffHour: 3, timezone: 'UTC' });

      expect(op.dateString).toBe('2026-11-07');
      expect(op.dayOfWeek).toBe('sat'); // Nov 7, 2026 is Saturday
    });

    it('keeps 03:00:01 AM as today when dayCutoffHour is 3', () => {
      // 2026-11-08 03:00:01 UTC
      const date = new Date('2026-11-08T03:00:01.000Z');
      const op = getOperationalDate(date, { dayCutoffHour: 3, timezone: 'UTC' });

      expect(op.dateString).toBe('2026-11-08');
      expect(op.dayOfWeek).toBe('sun'); // Nov 8, 2026 is Sunday
    });

    it('correctly handles timezone localization (e.g. Asia/Kolkata UTC+5:30)', () => {
      // 2026-11-07 20:00:00 UTC = 2026-11-08 01:30:00 IST (+5:30)
      // Since 01:30 < 03:00 cutoff, operational date in Kolkata is Nov 7!
      const utcDate = new Date('2026-11-07T20:00:00.000Z');
      const op = getOperationalDate(utcDate, {
        dayCutoffHour: 3,
        timezone: 'Asia/Kolkata',
      });

      expect(op.dateString).toBe('2026-11-07');
    });
  });

  describe('Workweek Schedules (Mon-Fri, Tue-Sat, Sun-Thu)', () => {
    const fridayOp = {
      dateString: '2026-11-06',
      dayOfWeek: 'fri' as const,
      calendarYear: 2026,
      calendarMonth: 11,
      calendarDay: 6,
    };

    const saturdayOp = {
      dateString: '2026-11-07',
      dayOfWeek: 'sat' as const,
      calendarYear: 2026,
      calendarMonth: 11,
      calendarDay: 7,
    };

    const mondayOp = {
      dateString: '2026-11-09',
      dayOfWeek: 'mon' as const,
      calendarYear: 2026,
      calendarMonth: 11,
      calendarDay: 9,
    };

    it('evaluates standard workweek (mon_fri): active Mon-Fri, inactive on weekends', () => {
      const schedule: WorkSchedule = {
        cadence: { type: 'workweek', variant: 'mon_fri' },
      };

      expect(isScheduleActiveOnDate({ schedule, operationalInfo: fridayOp })).toBe(true);
      expect(isScheduleActiveOnDate({ schedule, operationalInfo: saturdayOp })).toBe(false);
      expect(isScheduleActiveOnDate({ schedule, operationalInfo: mondayOp })).toBe(true);
    });

    it('evaluates shift workweek (tue_sat): inactive Monday, active Saturday', () => {
      const schedule: WorkSchedule = {
        cadence: { type: 'workweek', variant: 'tue_sat' },
      };

      expect(isScheduleActiveOnDate({ schedule, operationalInfo: mondayOp })).toBe(false);
      expect(isScheduleActiveOnDate({ schedule, operationalInfo: fridayOp })).toBe(true);
      expect(isScheduleActiveOnDate({ schedule, operationalInfo: saturdayOp })).toBe(true);
    });

    it('evaluates middle-east workweek (sun_thu): active Sunday, inactive Friday/Saturday', () => {
      const sundayOp = {
        dateString: '2026-11-08',
        dayOfWeek: 'sun' as const,
        calendarYear: 2026,
        calendarMonth: 11,
        calendarDay: 8,
      };

      const schedule: WorkSchedule = {
        cadence: { type: 'workweek', variant: 'sun_thu' },
      };

      expect(isScheduleActiveOnDate({ schedule, operationalInfo: sundayOp })).toBe(true);
      expect(isScheduleActiveOnDate({ schedule, operationalInfo: fridayOp })).toBe(false);
      expect(isScheduleActiveOnDate({ schedule, operationalInfo: saturdayOp })).toBe(false);
    });
  });

  describe('Specific Day Masks', () => {
    it('evaluates day_mask e.g. [mon, wed, fri]', () => {
      const schedule: WorkSchedule = {
        cadence: { type: 'day_mask', days: ['mon', 'wed', 'fri'] },
      };

      const monOp = { dateString: '2026-11-09', dayOfWeek: 'mon' as const, calendarYear: 2026, calendarMonth: 11, calendarDay: 9 };
      const tueOp = { dateString: '2026-11-10', dayOfWeek: 'tue' as const, calendarYear: 2026, calendarMonth: 11, calendarDay: 10 };
      const wedOp = { dateString: '2026-11-11', dayOfWeek: 'wed' as const, calendarYear: 2026, calendarMonth: 11, calendarDay: 11 };

      expect(isScheduleActiveOnDate({ schedule, operationalInfo: monOp })).toBe(true);
      expect(isScheduleActiveOnDate({ schedule, operationalInfo: tueOp })).toBe(false);
      expect(isScheduleActiveOnDate({ schedule, operationalInfo: wedOp })).toBe(true);
    });
  });

  describe('Custom Intervals & Cycle Patterns', () => {
    it('evaluates custom_cycle every 5 days from anchor date', () => {
      const schedule: WorkSchedule = {
        cadence: { type: 'custom_cycle', cycleDays: 5, anchorDate: '2026-11-01' },
      };

      // Day 0: Nov 1 -> active
      expect(isScheduleActiveOnDate({
        schedule,
        operationalInfo: { dateString: '2026-11-01', dayOfWeek: 'sun', calendarYear: 2026, calendarMonth: 11, calendarDay: 1 },
      })).toBe(true);

      // Day 3: Nov 4 -> inactive
      expect(isScheduleActiveOnDate({
        schedule,
        operationalInfo: { dateString: '2026-11-04', dayOfWeek: 'wed', calendarYear: 2026, calendarMonth: 11, calendarDay: 4 },
      })).toBe(false);

      // Day 5: Nov 6 -> active
      expect(isScheduleActiveOnDate({
        schedule,
        operationalInfo: { dateString: '2026-11-06', dayOfWeek: 'fri', calendarYear: 2026, calendarMonth: 11, calendarDay: 6 },
      })).toBe(true);

      // Date before anchor: Oct 31 -> inactive
      expect(isScheduleActiveOnDate({
        schedule,
        operationalInfo: { dateString: '2026-10-31', dayOfWeek: 'sat', calendarYear: 2026, calendarMonth: 10, calendarDay: 31 },
      })).toBe(false);
    });

    it('evaluates cycle_pattern (3 days on / 1 day off)', () => {
      const schedule: WorkSchedule = {
        cadence: { type: 'cycle_pattern', daysOn: 3, daysOff: 1, anchorDate: '2026-11-01' },
      };

      // Nov 1 (Day 0) -> on (true)
      expect(isScheduleActiveOnDate({ schedule, operationalInfo: { dateString: '2026-11-01', dayOfWeek: 'sun', calendarYear: 2026, calendarMonth: 11, calendarDay: 1 } })).toBe(true);
      // Nov 2 (Day 1) -> on (true)
      expect(isScheduleActiveOnDate({ schedule, operationalInfo: { dateString: '2026-11-02', dayOfWeek: 'mon', calendarYear: 2026, calendarMonth: 11, calendarDay: 2 } })).toBe(true);
      // Nov 3 (Day 2) -> on (true)
      expect(isScheduleActiveOnDate({ schedule, operationalInfo: { dateString: '2026-11-03', dayOfWeek: 'tue', calendarYear: 2026, calendarMonth: 11, calendarDay: 3 } })).toBe(true);
      // Nov 4 (Day 3) -> off (false)
      expect(isScheduleActiveOnDate({ schedule, operationalInfo: { dateString: '2026-11-04', dayOfWeek: 'wed', calendarYear: 2026, calendarMonth: 11, calendarDay: 4 } })).toBe(false);
      // Nov 5 (Day 4) -> on again (true)
      expect(isScheduleActiveOnDate({ schedule, operationalInfo: { dateString: '2026-11-05', dayOfWeek: 'thu', calendarYear: 2026, calendarMonth: 11, calendarDay: 5 } })).toBe(true);
    });
  });

  describe('Monthly, Quarterly & Yearly Cadences', () => {
    it('evaluates monthly task on day 15', () => {
      const schedule: WorkSchedule = {
        cadence: { type: 'monthly', dayOfMonth: 15 },
      };

      expect(isScheduleActiveOnDate({
        schedule,
        operationalInfo: { dateString: '2026-11-15', dayOfWeek: 'sun', calendarYear: 2026, calendarMonth: 11, calendarDay: 15 },
      })).toBe(true);

      expect(isScheduleActiveOnDate({
        schedule,
        operationalInfo: { dateString: '2026-11-16', dayOfWeek: 'mon', calendarYear: 2026, calendarMonth: 11, calendarDay: 16 },
      })).toBe(false);
    });

    it('clamps 31st to 30th for 30-day months like November', () => {
      const schedule: WorkSchedule = {
        cadence: { type: 'monthly', dayOfMonth: 31 },
      };

      // In November (30 days), 30th acts as effective 31st
      expect(isScheduleActiveOnDate({
        schedule,
        operationalInfo: { dateString: '2026-11-30', dayOfWeek: 'mon', calendarYear: 2026, calendarMonth: 11, calendarDay: 30 },
      })).toBe(true);
    });

    it('evaluates quarterly cadence (active in Jan, Apr, Jul, Oct on target day)', () => {
      const schedule: WorkSchedule = {
        cadence: { type: 'quarterly', dayOfMonth: 1 },
      };

      // January 1st -> active (quarter month)
      expect(isScheduleActiveOnDate({
        schedule,
        operationalInfo: { dateString: '2026-01-01', dayOfWeek: 'thu', calendarYear: 2026, calendarMonth: 1, calendarDay: 1 },
      })).toBe(true);

      // April 1st -> active (quarter month)
      expect(isScheduleActiveOnDate({
        schedule,
        operationalInfo: { dateString: '2026-04-01', dayOfWeek: 'wed', calendarYear: 2026, calendarMonth: 4, calendarDay: 1 },
      })).toBe(true);

      // November 1st -> inactive (not a quarter month)
      expect(isScheduleActiveOnDate({
        schedule,
        operationalInfo: { dateString: '2026-11-01', dayOfWeek: 'sun', calendarYear: 2026, calendarMonth: 11, calendarDay: 1 },
      })).toBe(false);
    });

    it('evaluates yearly cadence on target month and day', () => {
      const schedule: WorkSchedule = {
        cadence: { type: 'yearly', month: 7, dayOfMonth: 15 },
      };

      // July 15th -> active
      expect(isScheduleActiveOnDate({
        schedule,
        operationalInfo: { dateString: '2026-07-15', dayOfWeek: 'wed', calendarYear: 2026, calendarMonth: 7, calendarDay: 15 },
      })).toBe(true);

      // July 16th -> inactive
      expect(isScheduleActiveOnDate({
        schedule,
        operationalInfo: { dateString: '2026-07-16', dayOfWeek: 'thu', calendarYear: 2026, calendarMonth: 7, calendarDay: 16 },
      })).toBe(false);

      // August 15th -> inactive
      expect(isScheduleActiveOnDate({
        schedule,
        operationalInfo: { dateString: '2026-08-15', dayOfWeek: 'sat', calendarYear: 2026, calendarMonth: 8, calendarDay: 15 },
      })).toBe(false);
    });

    it('evaluates days_of_week recurrence with day_mask cadence', () => {
      const schedule: WorkSchedule = {
        cadence: { type: 'day_mask', days: ['mon', 'wed', 'fri'] },
      };

      // Wednesday Nov 4 -> active
      expect(isScheduleActiveOnDate({
        schedule,
        recurrence: 'days_of_week',
        operationalInfo: { dateString: '2026-11-04', dayOfWeek: 'wed', calendarYear: 2026, calendarMonth: 11, calendarDay: 4 },
      })).toBe(true);

      // Saturday Nov 7 -> inactive
      expect(isScheduleActiveOnDate({
        schedule,
        recurrence: 'days_of_week',
        operationalInfo: { dateString: '2026-11-07', dayOfWeek: 'sat', calendarYear: 2026, calendarMonth: 11, calendarDay: 7 },
      })).toBe(false);
    });
  });
});
