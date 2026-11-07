import { describe, expect, it } from 'vitest';
import {
  DuplicateEventError,
  InvalidIdPrefixError,
  InvalidPercentageError,
  InvalidTaskConfigError,
  LayaDomainError,
  MilestoneNotFoundError,
  TaskNotFoundError,
} from './errors.js';

describe('Domain Errors (RFC 7807 Compliance)', () => {
  it('formats ProblemDetails correctly via toJSON', () => {
    const err = new TaskNotFoundError('tsk_123');
    expect(err).toBeInstanceOf(LayaDomainError);
    expect(err.toJSON()).toEqual({
      code: 'TRACKER_TASK_NOT_FOUND',
      title: 'Task Not Found',
      status: 404,
      detail: "The task with id 'tsk_123' could not be found.",
    });
  });

  it('formats MilestoneNotFoundError with and without taskId', () => {
    const err1 = new MilestoneNotFoundError('mls_456', 'tsk_123');
    expect(err1.detail).toContain("The milestone 'mls_456' does not exist for task 'tsk_123'");

    const err2 = new MilestoneNotFoundError('mls_456');
    expect(err2.detail).toContain("The specified milestone step 'mls_456' does not exist");
  });

  it('formats InvalidPercentageError', () => {
    const err = new InvalidPercentageError(120);
    expect(err.code).toBe('TRACKER_INVALID_PERCENTAGE');
    expect(err.status).toBe(400);
    expect(err.detail).toContain('120');
  });

  it('formats DuplicateEventError', () => {
    const err = new DuplicateEventError('evt_789');
    expect(err.code).toBe('TRACKER_EVENT_DUPLICATE');
    expect(err.status).toBe(409);
  });

  it('formats InvalidIdPrefixError', () => {
    const err = new InvalidIdPrefixError('bad_id', 'tsk_');
    expect(err.code).toBe('TRACKER_INVALID_ID_PREFIX');
    expect(err.status).toBe(400);
    expect(err.detail).toContain("Expected domain prefix 'tsk_'");
  });

  it('formats InvalidTaskConfigError', () => {
    const err = new InvalidTaskConfigError('Custom cadence missing cycleDays');
    expect(err.code).toBe('TRACKER_INVALID_CONFIG');
    expect(err.status).toBe(400);
  });
});
