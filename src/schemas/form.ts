import { z } from 'zod';

export const questionType = z.enum(['TEXT', 'MULTIPLE_CHOICE', 'FILE']);

/** Per-type `settings` blob. Kept permissive; unknown keys are allowed. */
export const questionSettingsSchema = z
  .object({
    // TEXT
    multiline: z.boolean().optional(),
    minLength: z.number().int().positive().optional(),
    maxLength: z.number().int().positive().optional(),
    placeholder: z.string().optional(),
    // Text format constraint (currently just email).
    format: z.enum(['email']).optional(),
    // MULTIPLE_CHOICE
    allowMultiple: z.boolean().optional(),
    // FILE
    acceptedMimeTypes: z.array(z.string()).optional(),
    maxSizeBytes: z.number().int().positive().optional(),
  })
  .default({});

export const createFormSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
});

export const updateFormSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });

const optionInputSchema = z.object({
  id: z.string().uuid().optional(), // present => update existing, absent => create
  label: z.string().min(1).max(200),
});

export const createQuestionSchema = z.object({
  label: z.string().min(1).max(500),
  type: questionType,
  isRequired: z.boolean().default(false),
  settings: questionSettingsSchema,
  options: z.array(optionInputSchema).optional(),
});

export const updateQuestionSchema = z
  .object({
    label: z.string().min(1).max(500).optional(),
    type: questionType.optional(),
    isRequired: z.boolean().optional(),
    settings: questionSettingsSchema.optional(),
    options: z.array(optionInputSchema).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });

export const reorderQuestionsSchema = z.object({
  questionIds: z.array(z.string().uuid()).min(1),
});

/**
 * Full form definition used by the builder's single "Save" action. Questions
 * carry an optional id (present => update existing, absent => create new); any
 * existing question/option not present is deleted. Order follows array order.
 */
export const saveQuestionSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().min(1).max(500),
  type: questionType,
  isRequired: z.boolean().default(false),
  settings: questionSettingsSchema,
  options: z.array(optionInputSchema).optional(),
});

export const saveFormSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  questions: z.array(saveQuestionSchema).default([]),
});

export type SaveFormInput = z.infer<typeof saveFormSchema>;

export type QuestionSettings = z.infer<typeof questionSettingsSchema>;
export type CreateFormInput = z.infer<typeof createFormSchema>;
export type UpdateFormInput = z.infer<typeof updateFormSchema>;
export type CreateQuestionInput = z.infer<typeof createQuestionSchema>;
export type UpdateQuestionInput = z.infer<typeof updateQuestionSchema>;
