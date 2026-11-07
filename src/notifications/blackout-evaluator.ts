/**
 * Laya (లయ) — Quiet Window Blackout Evaluator
 * Evaluates whether a given timestamp falls within an active quiet blackout window.
 * Supports cross-midnight windows (e.g. 10:00 PM to 07:30 AM), day-of-week filters, and group scopes.
 */

import { DayOfWeek, GroupId, QuietWindow } from '../domain/types.js';

const DAY_MAP: Record<number, DayOfWeek> = {
  0: 'sun',
  1: 'mon',
  2: 'tue',
  3: 'wed',
  4: 'thu',
  5: 'fri',
  6: 'sat',
};

export interface EvaluateQuietWindowParams {
  referenceTime?: Date | string;
  quietWindows: QuietWindow[];
  groupId?: GroupId | null;
  timezone?: string;
}

export interface QuietWindowEvaluationResult {
  isBlackout: boolean;
  activeWindow?: QuietWindow;
}

/**
 * Checks whether the current moment falls within any quiet window blackout.
 */
export function evaluateQuietWindow(
  params: EvaluateQuietWindowParams
): QuietWindowEvaluationResult {
  const {
    referenceTime = new Date(),
    quietWindows = [],
    groupId = null,
    timezone = 'UTC',
  } = params;

  if (quietWindows.length === 0) {
    return { isBlackout: false };
  }

  const date = typeof referenceTime === 'string' ? new Date(referenceTime) : referenceTime;

  // Localize reference time into target timezone
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

  const year = parseInt(partMap.year, 10);
  const month = parseInt(partMap.month, 10);
  const day = parseInt(partMap.day, 10);
  let hour = parseInt(partMap.hour, 10);
  if (hour === 24) hour = 0;
  const minute = parseInt(partMap.minute, 10);

  // Determine localized day of week
  const localizedUtcDate = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const dayOfWeek = DAY_MAP[localizedUtcDate.getUTCDay()];
  const currentTotalMinutes = hour * 60 + minute;

  for (const window of quietWindows) {
    // 1. Group Scope Filter: If window has a specific groupId, it only restricts that group
    if (window.groupId && window.groupId !== groupId) {
      continue;
    }

    // 2. Day of Week Filter: If daysOfWeek specified, check if today is in list
    if (window.daysOfWeek && window.daysOfWeek.length > 0) {
      if (!window.daysOfWeek.includes(dayOfWeek)) {
        continue;
      }
    }

    // 3. Time Window Evaluation
    const startMinutes = window.startHour * 60 + window.startMinute;
    const endMinutes = window.endHour * 60 + window.endMinute;

    let isInside = false;

    if (startMinutes <= endMinutes) {
      // Standard daytime window e.g. 14:00 to 16:00
      isInside = currentTotalMinutes >= startMinutes && currentTotalMinutes < endMinutes;
    } else {
      // Cross-midnight window e.g. 22:00 to 07:30
      // Active if >= 22:00 OR < 07:30
      isInside = currentTotalMinutes >= startMinutes || currentTotalMinutes < endMinutes;
    }

    if (isInside) {
      return {
        isBlackout: true,
        activeWindow: window,
      };
    }
  }

  return { isBlackout: false };
}
