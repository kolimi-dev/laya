/**
 * Laya (लय) — Zod Validation Schemas
 * Contract-first validation for all domain inputs, schedules, and entities.
 */

import { z } from 'zod';

export const UserIdSchema = z
  .string()
  .regex(/^usr_[0-9A-Za-z_-]+$/, "UserId must start with 'usr_' prefix");

export const GroupIdSchema = z
  .string()
  .regex(/^grp_[0-9A-Za-z_-]+$/, "GroupId must start with 'grp_' prefix");

export const TaskIdSchema = z
  .string()
  .regex(/^tsk_[0-9A-Za-z_-]+$/, "TaskId must start with 'tsk_' prefix");

export const MilestoneIdSchema = z
  .string()
  .regex(/^mls_[0-9A-Za-z_-]+$/, "MilestoneId must start with 'mls_' prefix");

export const EventIdSchema = z
  .string()
  .min(1, 'EventId cannot be empty')
  .refine(
    (val) =>
      val.startsWith('evt_') ||
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        val
      ),
    { message: "EventId must be a valid 'evt_' prefixed string or UUID" }
  );

export const TaskTypeSchema = z.enum(['checklist', 'milestone', 'percentage']);
export const TaskRecurrenceSchema = z.enum(['daily', 'weekly', 'monthly', 'custom', 'anytime']);
export const EventStatusSchema = z.enum(['done', 'in_progress', 'ignored']);
export const TaskProgressStatusSchema = z.enum([
  'pending',
  'in_progress',
  'done',
  'ignored',
]);

export const DayOfWeekSchema = z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
export const WorkweekVariantSchema = z.enum(['mon_fri', 'tue_sat', 'sun_thu']);

export const DateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD');

export const ScheduleCadenceSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('daily'),
  }),
  z.object({
    type: z.literal('workweek'),
    variant: WorkweekVariantSchema,
  }),
  z.object({
    type: z.literal('day_mask'),
    days: z.array(DayOfWeekSchema).min(1, 'At least one day must be selected in day_mask'),
  }),
  z.object({
    type: z.literal('custom_cycle'),
    cycleDays: z.number().int().positive('cycleDays must be >= 1'),
    anchorDate: DateStringSchema,
  }),
  z.object({
    type: z.literal('cycle_pattern'),
    daysOn: z.number().int().positive('daysOn must be >= 1'),
    daysOff: z.number().int().positive('daysOff must be >= 1'),
    anchorDate: DateStringSchema,
  }),
  z.object({
    type: z.literal('weekly'),
    dayOfWeek: DayOfWeekSchema,
  }),
  z.object({
    type: z.literal('monthly'),
    dayOfMonth: z.number().int().min(1, 'dayOfMonth must be >= 1').max(31, 'dayOfMonth must be <= 31'),
  }),
]);

export const WorkScheduleSchema = z.object({
  cadence: ScheduleCadenceSchema,
  timezone: z.string().optional(),
});

export const DayRolloverOptionsSchema = z.object({
  dayCutoffHour: z
    .number()
    .int()
    .min(0, 'dayCutoffHour cannot be negative')
    .max(12, 'dayCutoffHour cannot exceed 12 (noon)')
    .optional(),
  timezone: z.string().optional(),
});

export const UtcTimestampSchema = z
  .string()
  .datetime({ offset: true, message: 'Timestamp must be a valid ISO-8601 UTC string' });

export const CreateTaskGroupInputSchema = z.object({
  name: z.string().trim().min(1, 'Group name cannot be empty').max(64),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a 6-digit hex code e.g. #4F46E5')
    .optional(),
  sortOrder: z.number().int().optional(),
  schedule: WorkScheduleSchema.optional(),
});

export const CreateTaskInputSchema = z
  .object({
    title: z.string().trim().min(1, 'Task title cannot be empty').max(120),
    taskType: TaskTypeSchema,
    recurrence: TaskRecurrenceSchema,
    groupId: GroupIdSchema.optional().nullable(),
    cycleDays: z.number().int().positive('cycleDays must be >= 1').optional().nullable(),
    schedule: WorkScheduleSchema.optional(),
    targetValue: z.number().positive('targetValue must be > 0').optional().nullable(),
    unit: z.string().trim().max(24).optional().nullable(),
    sortOrder: z.number().int().optional(),
    milestones: z
      .array(z.string().trim().min(1, 'Milestone label cannot be empty').max(64))
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.recurrence === 'custom' && !data.schedule && (!data.cycleDays || data.cycleDays < 1)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['cycleDays'],
        message: "cycleDays is required and must be >= 1 when recurrence is 'custom'",
      });
    }
    if (data.taskType === 'milestone') {
      if (!data.milestones || data.milestones.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['milestones'],
          message: "At least one milestone label is required when taskType is 'milestone'",
        });
      }
    }
  });

export const RecordCompletionEventInputSchema = z
  .object({
    id: EventIdSchema,
    taskId: TaskIdSchema,
    milestoneId: MilestoneIdSchema.optional().nullable(),
    userId: UserIdSchema,
    status: EventStatusSchema,
    progressPercentage: z
      .number()
      .min(0.0, 'Progress percentage cannot be less than 0.00')
      .max(100.0, 'Progress percentage cannot exceed 100.00')
      .optional()
      .nullable(),
    notes: z.string().trim().max(280, 'Notes cannot exceed 280 characters').optional().nullable(),
    occurredAt: UtcTimestampSchema,
  })
  .superRefine((data, ctx) => {
    if (data.status === 'in_progress' && data.progressPercentage === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['progressPercentage'],
        message: "progressPercentage is required when status is 'in_progress'",
      });
    }
  });

export type CreateTaskInput = z.infer<typeof CreateTaskInputSchema>;
export type CreateTaskGroupInput = z.infer<typeof CreateTaskGroupInputSchema>;
export type RecordCompletionEventInput = z.infer<typeof RecordCompletionEventInputSchema>;
export type WorkScheduleInput = z.infer<typeof WorkScheduleSchema>;
export type ScheduleCadenceInput = z.infer<typeof ScheduleCadenceSchema>;
