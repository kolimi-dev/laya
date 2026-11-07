/**
 * Laya (लय) — Standard RFC 7807 Domain Errors
 * Zero silent fallbacks (Ground Rule 6).
 */

export interface ProblemDetails {
  code: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
}

export class LayaDomainError extends Error {
  public readonly code: string;
  public readonly title: string;
  public readonly status: number;
  public readonly detail: string;

  constructor(problem: ProblemDetails) {
    super(problem.detail);
    this.name = 'LayaDomainError';
    this.code = problem.code;
    this.title = problem.title;
    this.status = problem.status;
    this.detail = problem.detail;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  public toJSON(): ProblemDetails {
    return {
      code: this.code,
      title: this.title,
      status: this.status,
      detail: this.detail,
    };
  }
}

export class TaskNotFoundError extends LayaDomainError {
  constructor(taskId: string) {
    super({
      code: 'TRACKER_TASK_NOT_FOUND',
      title: 'Task Not Found',
      status: 404,
      detail: `The task with id '${taskId}' could not be found.`,
    });
  }
}

export class MilestoneNotFoundError extends LayaDomainError {
  constructor(milestoneId: string, taskId?: string) {
    super({
      code: 'TRACKER_MILESTONE_NOT_FOUND',
      title: 'Milestone Not Found',
      status: 404,
      detail: taskId
        ? `The milestone '${milestoneId}' does not exist for task '${taskId}'.`
        : `The specified milestone step '${milestoneId}' does not exist.`,
    });
  }
}

export class InvalidPercentageError extends LayaDomainError {
  constructor(value: number) {
    super({
      code: 'TRACKER_INVALID_PERCENTAGE',
      title: 'Invalid Progress Percentage',
      status: 400,
      detail: `Progress percentage must be between 0.00 and 100.00. Received: ${value}.`,
    });
  }
}

export class DuplicateEventError extends LayaDomainError {
  constructor(eventId: string) {
    super({
      code: 'TRACKER_EVENT_DUPLICATE',
      title: 'Duplicate Event Log',
      status: 409,
      detail: `This event '${eventId}' was already recorded (idempotent duplicate).`,
    });
  }
}

export class InvalidIdPrefixError extends LayaDomainError {
  constructor(id: string, expectedPrefix: string) {
    super({
      code: 'TRACKER_INVALID_ID_PREFIX',
      title: 'Invalid Entity Identifier Prefix',
      status: 400,
      detail: `Identifier '${id}' is invalid. Expected domain prefix '${expectedPrefix}'.`,
    });
  }
}

export class InvalidTaskConfigError extends LayaDomainError {
  constructor(detail: string) {
    super({
      code: 'TRACKER_INVALID_CONFIG',
      title: 'Invalid Task Configuration',
      status: 400,
      detail,
    });
  }
}
