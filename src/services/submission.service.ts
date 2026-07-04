import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { HttpError } from '../lib/errors.js';
import { deleteObject, presignGetUrl, putObject } from '../lib/storage.js';
import { assertOwnedForm, getPublicForm } from './form.service.js';
import type { QuestionSettings } from '../schemas/form.js';

/** A file part read from the multipart request. */
export interface UploadedFilePart {
  filename: string;
  mimeType: string;
  buffer: Buffer;
}

/** Raw, per-question input collected from the multipart body by the route. */
export interface RawQuestionInput {
  /** Text value(s) for TEXT, or selected option id(s) for MULTIPLE_CHOICE. */
  texts: string[];
  files: UploadedFilePart[];
}

type AnswerSpec =
  | { kind: 'text'; questionId: string; textValue: string }
  | { kind: 'option'; questionId: string; optionIds: string[] }
  | { kind: 'file'; questionId: string; part: UploadedFilePart; storageKey: string };

function settingsOf(raw: unknown): QuestionSettings {
  return (raw ?? {}) as QuestionSettings;
}

/**
 * Validate a public submission against the form definition, upload any files to
 * S3, then persist the submission + answers atomically. Uploaded objects are
 * cleaned up best-effort if the DB write fails.
 */
export async function createSubmission(
  token: string,
  inputs: Map<string, RawQuestionInput>,
): Promise<{ id: string }> {
  const form = await getPublicForm(token);

  const errors: string[] = [];
  const specs: AnswerSpec[] = [];

  for (const question of form.questions) {
    const input = inputs.get(question.id) ?? { texts: [], files: [] };
    const settings = settingsOf(question.settings);
    const label = question.label;

    if (question.type === 'TEXT') {
      const value = (input.texts[0] ?? '').trim();
      if (!value) {
        if (question.isRequired) errors.push(`"${label}" is required`);
        continue;
      }
      if (settings.minLength && value.length < settings.minLength) {
        errors.push(`"${label}" must be at least ${settings.minLength} characters`);
        continue;
      }
      if (settings.maxLength && value.length > settings.maxLength) {
        errors.push(`"${label}" exceeds ${settings.maxLength} characters`);
        continue;
      }
      if (settings.format === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        errors.push(`"${label}" must be a valid email address`);
        continue;
      }
      specs.push({ kind: 'text', questionId: question.id, textValue: value });
    } else if (question.type === 'MULTIPLE_CHOICE') {
      const optionIds = input.texts.filter(Boolean);
      if (optionIds.length === 0) {
        if (question.isRequired) errors.push(`"${label}" is required`);
        continue;
      }
      const validIds = new Set(question.options.map((o) => o.id));
      if (!optionIds.every((id) => validIds.has(id))) {
        errors.push(`"${label}" has an invalid option`);
        continue;
      }
      if (!settings.allowMultiple && optionIds.length > 1) {
        errors.push(`"${label}" accepts only one choice`);
        continue;
      }
      specs.push({ kind: 'option', questionId: question.id, optionIds });
    } else if (question.type === 'FILE') {
      const part = input.files[0];
      if (!part) {
        if (question.isRequired) errors.push(`"${label}" is required`);
        continue;
      }
      if (
        settings.acceptedMimeTypes?.length &&
        !settings.acceptedMimeTypes.includes(part.mimeType)
      ) {
        errors.push(`"${label}" has an unsupported file type (${part.mimeType})`);
        continue;
      }
      if (settings.maxSizeBytes && part.buffer.length > settings.maxSizeBytes) {
        errors.push(`"${label}" file is too large`);
        continue;
      }
      const storageKey = `submissions/${form.id}/${randomUUID()}-${part.filename}`;
      specs.push({ kind: 'file', questionId: question.id, part, storageKey });
    }
  }

  if (errors.length) {
    throw new HttpError(400, errors.join('; '));
  }

  // Upload files to S3 before the transaction; track keys for rollback cleanup.
  const uploadedKeys: string[] = [];
  try {
    for (const spec of specs) {
      if (spec.kind === 'file') {
        await putObject(spec.storageKey, spec.part.buffer, spec.part.mimeType);
        uploadedKeys.push(spec.storageKey);
      }
    }

    const submission = await prisma.$transaction(async (tx) => {
      const created = await tx.submission.create({ data: { formId: form.id } });
      for (const spec of specs) {
        if (spec.kind === 'text') {
          await tx.answer.create({
            data: {
              submissionId: created.id,
              questionId: spec.questionId,
              textValue: spec.textValue,
            },
          });
        } else if (spec.kind === 'option') {
          for (const optionId of spec.optionIds) {
            await tx.answer.create({
              data: { submissionId: created.id, questionId: spec.questionId, optionId },
            });
          }
        } else {
          const file = await tx.file.create({
            data: {
              storageKey: spec.storageKey,
              filename: spec.part.filename,
              mimeType: spec.part.mimeType,
              sizeBytes: spec.part.buffer.length,
            },
          });
          await tx.answer.create({
            data: {
              submissionId: created.id,
              questionId: spec.questionId,
              fileId: file.id,
            },
          });
        }
      }
      return created;
    });

    return { id: submission.id };
  } catch (err) {
    await Promise.all(uploadedKeys.map((k) => deleteObject(k)));
    throw err;
  }
}

export async function listSubmissions(formId: string, userId: string) {
  await assertOwnedForm(formId, userId);
  const subs = await prisma.submission.findMany({
    where: { formId },
    orderBy: { submittedAt: 'desc' },
    select: {
      id: true,
      submittedAt: true,
      _count: { select: { answers: true } },
      // Best-effort submitter name: the first text answer to a "name"-ish question.
      answers: {
        where: {
          textValue: { not: null },
          question: { type: 'TEXT', label: { contains: 'name', mode: 'insensitive' } },
        },
        orderBy: { question: { position: 'asc' } },
        select: { textValue: true },
        take: 1,
      },
    },
  });
  return subs.map(({ answers, ...s }) => ({
    ...s,
    submitterName: answers[0]?.textValue ?? null,
  }));
}

const answerInclude = {
  answers: {
    include: {
      question: true,
      option: true,
      file: { select: { id: true, filename: true, mimeType: true, sizeBytes: true } },
    },
  },
} satisfies Prisma.SubmissionInclude;

export async function getSubmission(formId: string, submissionId: string, userId: string) {
  await assertOwnedForm(formId, userId);
  const submission = await prisma.submission.findFirst({
    where: { id: submissionId, formId },
    include: answerInclude,
  });
  if (!submission) throw new HttpError(404, 'Submission not found');
  return submission;
}

/**
 * Return a presigned download URL for a file, but only if it belongs to a
 * submission of a form owned by the requesting user.
 */
export async function getFileDownloadUrl(
  fileId: string,
  userId: string,
  disposition: 'inline' | 'attachment' = 'attachment',
): Promise<string> {
  const file = await prisma.file.findUnique({
    where: { id: fileId },
    include: {
      answer: { include: { submission: { include: { form: true } } } },
    },
  });
  if (!file || file.answer?.submission.form.ownerId !== userId) {
    throw new HttpError(404, 'File not found');
  }
  return presignGetUrl(file.storageKey, file.filename, { disposition });
}
