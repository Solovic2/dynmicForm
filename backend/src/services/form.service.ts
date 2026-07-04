import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { HttpError } from '../lib/errors.js';
import type {
  CreateFormInput,
  CreateQuestionInput,
  SaveFormInput,
  UpdateFormInput,
  UpdateQuestionInput,
} from '../schemas/form.js';

/** Include shape for returning a form with its ordered questions + options. */
const formWithQuestions = {
  questions: {
    orderBy: { position: 'asc' },
    include: { options: { orderBy: { position: 'asc' } } },
  },
} satisfies Prisma.FormInclude;

/** Load a form and assert the given user owns it. Throws 404 otherwise. */
export async function assertOwnedForm(formId: string, userId: string) {
  const form = await prisma.form.findUnique({ where: { id: formId } });
  if (!form || form.ownerId !== userId) {
    throw new HttpError(404, 'Form not found');
  }
  return form;
}

export function listForms(userId: string) {
  return prisma.form.findMany({
    where: { ownerId: userId },
    orderBy: { updatedAt: 'desc' },
    include: { _count: { select: { submissions: true, questions: true } } },
  });
}

export function createForm(userId: string, input: CreateFormInput) {
  return prisma.form.create({
    data: { ownerId: userId, title: input.title, description: input.description ?? null },
    include: formWithQuestions,
  });
}

/** Create a form and all its questions/options in a single transaction. */
export function createFormWithQuestions(userId: string, input: SaveFormInput) {
  return prisma.form.create({
    data: {
      ownerId: userId,
      title: input.title,
      description: input.description ?? null,
      questions: {
        create: input.questions.map((q, i) => ({
          label: q.label,
          type: q.type,
          isRequired: q.isRequired,
          settings: q.settings as Prisma.InputJsonValue,
          position: i,
          options:
            q.type === 'MULTIPLE_CHOICE' && q.options
              ? { create: q.options.map((o, j) => ({ label: o.label, position: j })) }
              : undefined,
        })),
      },
    },
    include: formWithQuestions,
  });
}

/**
 * Replace a whole form (title, description, and the full question/option set)
 * in one transaction. Questions/options with an id are updated, those without
 * are created, and any not present are deleted. Order follows array order.
 */
export async function replaceForm(formId: string, userId: string, input: SaveFormInput) {
  await assertOwnedForm(formId, userId);

  return prisma.$transaction(async (tx) => {
    await tx.form.update({
      where: { id: formId },
      data: { title: input.title, description: input.description ?? null },
    });

    // Delete questions the client removed (cascades their options + answers).
    const keepQuestionIds = input.questions.filter((q) => q.id).map((q) => q.id!);
    await tx.question.deleteMany({
      where: keepQuestionIds.length
        ? { formId, id: { notIn: keepQuestionIds } }
        : { formId },
    });

    for (const [i, q] of input.questions.entries()) {
      const isMulti = q.type === 'MULTIPLE_CHOICE';
      if (q.id) {
        await tx.question.update({
          where: { id: q.id },
          data: {
            label: q.label,
            type: q.type,
            isRequired: q.isRequired,
            settings: q.settings as Prisma.InputJsonValue,
            position: i,
          },
        });
        // Reconcile options: drop all when not multiple-choice, else upsert set.
        if (!isMulti) {
          await tx.questionOption.deleteMany({ where: { questionId: q.id } });
        } else {
          const opts = q.options ?? [];
          const keepOptionIds = opts.filter((o) => o.id).map((o) => o.id!);
          await tx.questionOption.deleteMany({
            where: keepOptionIds.length
              ? { questionId: q.id, id: { notIn: keepOptionIds } }
              : { questionId: q.id },
          });
          for (const [j, o] of opts.entries()) {
            if (o.id) {
              await tx.questionOption.update({
                where: { id: o.id },
                data: { label: o.label, position: j },
              });
            } else {
              await tx.questionOption.create({
                data: { questionId: q.id, label: o.label, position: j },
              });
            }
          }
        }
      } else {
        await tx.question.create({
          data: {
            formId,
            label: q.label,
            type: q.type,
            isRequired: q.isRequired,
            settings: q.settings as Prisma.InputJsonValue,
            position: i,
            options:
              isMulti && q.options
                ? { create: q.options.map((o, j) => ({ label: o.label, position: j })) }
                : undefined,
          },
        });
      }
    }

    return tx.form.findUnique({ where: { id: formId }, include: formWithQuestions });
  });
}

export async function getForm(formId: string, userId: string) {
  await assertOwnedForm(formId, userId);
  return prisma.form.findUnique({ where: { id: formId }, include: formWithQuestions });
}

export async function updateForm(formId: string, userId: string, input: UpdateFormInput) {
  await assertOwnedForm(formId, userId);
  return prisma.form.update({
    where: { id: formId },
    data: { title: input.title, description: input.description },
    include: formWithQuestions,
  });
}

export async function deleteForm(formId: string, userId: string): Promise<void> {
  await assertOwnedForm(formId, userId);
  await prisma.form.delete({ where: { id: formId } });
}

/** Publish: set PUBLISHED and generate a portal token on first publish. */
export async function publishForm(formId: string, userId: string) {
  const form = await assertOwnedForm(formId, userId);
  return prisma.form.update({
    where: { id: formId },
    data: {
      status: 'PUBLISHED',
      portalToken: form.portalToken ?? randomUUID().replace(/-/g, ''),
    },
    include: formWithQuestions,
  });
}

/** Unpublish: revert to DRAFT but keep the token so the URL is stable if re-published. */
export async function unpublishForm(formId: string, userId: string) {
  await assertOwnedForm(formId, userId);
  return prisma.form.update({
    where: { id: formId },
    data: { status: 'DRAFT' },
    include: formWithQuestions,
  });
}

// ---- Questions ----

export async function addQuestion(formId: string, userId: string, input: CreateQuestionInput) {
  await assertOwnedForm(formId, userId);
  const count = await prisma.question.count({ where: { formId } });
  return prisma.question.create({
    data: {
      formId,
      label: input.label,
      type: input.type,
      isRequired: input.isRequired,
      settings: input.settings as Prisma.InputJsonValue,
      position: count,
      options:
        input.type === 'MULTIPLE_CHOICE' && input.options
          ? { create: input.options.map((o, i) => ({ label: o.label, position: i })) }
          : undefined,
    },
    include: { options: { orderBy: { position: 'asc' } } },
  });
}

export async function updateQuestion(
  formId: string,
  questionId: string,
  userId: string,
  input: UpdateQuestionInput,
) {
  await assertOwnedForm(formId, userId);
  const question = await prisma.question.findFirst({ where: { id: questionId, formId } });
  if (!question) throw new HttpError(404, 'Question not found');

  return prisma.$transaction(async (tx) => {
    await tx.question.update({
      where: { id: questionId },
      data: {
        label: input.label,
        type: input.type,
        isRequired: input.isRequired,
        settings: input.settings as Prisma.InputJsonValue | undefined,
      },
    });

    // Reconcile options when provided: update existing (by id), create new, delete absent.
    if (input.options) {
      const keepIds = input.options.filter((o) => o.id).map((o) => o.id!);
      await tx.questionOption.deleteMany({
        where: { questionId, id: { notIn: keepIds.length ? keepIds : ['__none__'] } },
      });
      for (const [i, o] of input.options.entries()) {
        if (o.id) {
          await tx.questionOption.update({
            where: { id: o.id },
            data: { label: o.label, position: i },
          });
        } else {
          await tx.questionOption.create({
            data: { questionId, label: o.label, position: i },
          });
        }
      }
    }

    return tx.question.findUnique({
      where: { id: questionId },
      include: { options: { orderBy: { position: 'asc' } } },
    });
  });
}

export async function deleteQuestion(
  formId: string,
  questionId: string,
  userId: string,
): Promise<void> {
  await assertOwnedForm(formId, userId);
  const question = await prisma.question.findFirst({ where: { id: questionId, formId } });
  if (!question) throw new HttpError(404, 'Question not found');
  await prisma.question.delete({ where: { id: questionId } });
}

export async function reorderQuestions(
  formId: string,
  userId: string,
  questionIds: string[],
): Promise<void> {
  await assertOwnedForm(formId, userId);
  const existing = await prisma.question.findMany({
    where: { formId },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((q) => q.id));
  if (questionIds.length !== existingIds.size || !questionIds.every((id) => existingIds.has(id))) {
    throw new HttpError(400, 'questionIds must contain exactly the form\'s question ids');
  }
  await prisma.$transaction(
    questionIds.map((id, i) =>
      prisma.question.update({ where: { id }, data: { position: i } }),
    ),
  );
}

// ---- Public read ----

/** Public form definition by token; only PUBLISHED forms are visible. */
export async function getPublicForm(token: string) {
  const form = await prisma.form.findUnique({
    where: { portalToken: token },
    include: formWithQuestions,
  });
  if (!form || form.status !== 'PUBLISHED') {
    throw new HttpError(404, 'Form not found');
  }
  return form;
}
