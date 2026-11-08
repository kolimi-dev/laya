/**
 * Laya (లయ) — Recurrence & Work Schedule Evaluator
 * Evaluates whether tasks are due on a specific operational day based on:
 * - Workweek models (Mon–Fri, Tue–Sat, Sun–Thu)
 * - Specific day masks ([Mon, Wed, Fri])
 * - Custom cycle intervals (every N days from anchor)
 * - Dynamic Day-Rollover Anchor (Night Owl Offset e.g. 03:00 AM cutoff)
 */

import {
  DayOfWeek,
  DayRolloverOptions,
  TaskRecurrence,
  WorkSchedule,
} from '../domain/types.js';

const DAY_MAP: Record<number, DayOfWeek> = {
  0: 'sun',
  1: 'mon',
  2: 'tue',
  3: 'wed',
  4: 'thu',
  5: 'fri',
  6: 'sat',
};

export interface OperationalDateInfo {
  dateString: string; // YYYY-MM-DD
  dayOfWeek: DayOfWeek;
  calendarYear: number;
  calendarMonth: number; // 1-12
  calendarDay: number; // 1-31
}

/**
 * Computes the operational date for habit tracking, applying the Day-Rollover Anchor (Night Owl Offset).
 *
 * If a user completes tasks at 01:30 AM and dayCutoffHour is 3 (03:00 AM),
 * the operational day is yesterday's date, as the user has not yet ended their active night.
 */
export function getOperationalDate(
  dateInput: Date | string = new Date(),
  options: DayRolloverOptions = {}
): OperationalDateInfo {
  const { dayCutoffHour = 3, timezone = 'UTC' } = options;
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;

  // Format parts according to target timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const partMap: Record<string, string> = {};
  for (const p of parts) {
    partMap[p.type] = p.value;
  }

  let year = parseInt(partMap.year, 10);
  let month = parseInt(partMap.month, 10);
  let day = parseInt(partMap.day, 10);
  let hour = parseInt(partMap.hour, 10);
  if (hour === 24) hour = 0; // Handle 24:00 edge in some formatters

  // Create a UTC date representing this localized day
  const localizedUtcDate = new Date(Date.UTC(year, month - 1, day, hour));

  // If the localized time is before the cutoff hour, roll back by 24 hours
  if (hour < dayCutoffHour) {
    localizedUtcDate.setUTCDate(localizedUtcDate.getUTCDate() - 1);
    year = localizedUtcDate.getUTCFullYear();
    month = localizedUtcDate.getUTCMonth() + 1;
    day = localizedUtcDate.getUTCDate();
  }

  const dayOfWeekIndex = localizedUtcDate.getUTCDay();
  const dayOfWeek = DAY_MAP[dayOfWeekIndex];
  const dateString = `${year.toString().padStart(4, '0')}-${month
    .toString()
    .padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

  return {
    dateString,
    dayOfWeek,
    calendarYear: year,
    calendarMonth: month,
    calendarDay: day,
  };
}

/**
 * Evaluates whether a task or group schedule is active on a specific operational date.
 */
export function isScheduleActiveOnDate(params: {
  schedule?: WorkSchedule;
  recurrence?: TaskRecurrence;
  cycleDays?: number | null;
  operationalInfo: OperationalDateInfo;
}): boolean {
  const { schedule, recurrence = 'daily', cycleDays, operationalInfo } = params;
  const { dateString, dayOfWeek, calendarDay, calendarMonth, calendarYear } = operationalInfo;

  // 1. If explicit WorkSchedule is defined, evaluate cadence
  if (schedule && schedule.cadence) {
    const { cadence } = schedule;

    switch (cadence.type) {
      case 'daily':
        return true;

      case 'workweek': {
        if (cadence.variant === 'mon_fri') {
          return ['mon', 'tue', 'wed', 'thu', 'fri'].includes(dayOfWeek);
        }
        if (cadence.variant === 'tue_sat') {
          return ['tue', 'wed', 'thu', 'fri', 'sat'].includes(dayOfWeek);
        }
        if (cadence.variant === 'sun_thu') {
          return ['sun', 'mon', 'tue', 'wed', 'thu'].includes(dayOfWeek);
        }
        return false;
      }

      case 'day_mask':
        return cadence.days.includes(dayOfWeek);

      case 'custom_cycle': {
        const diffDays = calculateDayDifference(cadence.anchorDate, dateString);
        if (diffDays < 0) return false; // Before anchor date
        return diffDays % cadence.cycleDays === 0;
      }

      case 'cycle_pattern': {
        const diffDays = calculateDayDifference(cadence.anchorDate, dateString);
        if (diffDays < 0) return false;
        const totalCycle = cadence.daysOn + cadence.daysOff;
        if (totalCycle <= 0) return false;
        const position = diffDays % totalCycle;
        return position < cadence.daysOn; // Active during "days on"
      }

      case 'weekly':
        return dayOfWeek === cadence.dayOfWeek;

      case 'monthly': {
        // Clamp to last day of month if target day exceeds month length (e.g. 31st in Feb or Apr)
        const daysInMonth = new Date(Date.UTC(calendarYear, calendarMonth, 0)).getUTCDate();
        const effectiveTargetDay = Math.min(cadence.dayOfMonth, daysInMonth);
        return calendarDay === effectiveTargetDay;
      }

      case 'quarterly': {
        // Active on the specified day of each quarter month (Jan, Apr, Jul, Oct)
        const isQuarterMonth = [1, 4, 7, 10].includes(calendarMonth);
        const daysInMonth = new Date(Date.UTC(calendarYear, calendarMonth, 0)).getUTCDate();
        const effectiveTargetDay = Math.min(cadence.dayOfMonth, daysInMonth);
        return isQuarterMonth && calendarDay === effectiveTargetDay;
      }

      case 'yearly': {
        // Active on the specified month and day of year
        const daysInMonth = new Date(Date.UTC(calendarYear, cadence.month, 0)).getUTCDate();
        const effectiveTargetDay = Math.min(cadence.dayOfMonth, daysInMonth);
        return calendarMonth === cadence.month && calendarDay === effectiveTargetDay;
      }

      default:
        return true;
    }
  }

  // 2. Fallback to standard TaskRecurrence
  switch (recurrence) {
    case 'daily':
    case 'anytime':
    case 'days_of_week':
      return true;

    case 'weekly':
      // Standard weekly defaults to Mondays
      return dayOfWeek === 'mon';

    case 'monthly':
      // Standard monthly defaults to the 1st of the month
      return calendarDay === 1;

    case 'quarterly':
      return [1, 4, 7, 10].includes(calendarMonth) && calendarDay === 1;

    case 'yearly':
      return calendarMonth === 1 && calendarDay === 1;

    case 'custom': {
      if (!cycleDays || cycleDays <= 1) return true;
      // Without an explicit anchorDate, treat day 1 of cycle as active
      const epochDays = Math.floor(
        Date.UTC(calendarYear, calendarMonth - 1, calendarDay) / (1000 * 60 * 60 * 24)
      );
      return epochDays % cycleDays === 0;
    }

    default:
      return true;
  }
}

/**
 * Calculates whole calendar days between two YYYY-MM-DD strings.
 */
export function calculateDayDifference(anchorDateStr: string, targetDateStr: string): number {
  const [ay, am, ad] = anchorDateStr.split('-').map(Number);
  const [ty, tm, td] = targetDateStr.split('-').map(Number);

  const anchorUtc = Date.UTC(ay, am - 1, ad);
  const targetUtc = Date.UTC(ty, tm - 1, td);

  return Math.round((targetUtc - anchorUtc) / (1000 * 60 * 60 * 24));
}
