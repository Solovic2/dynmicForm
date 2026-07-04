import type { FastifyInstance } from 'fastify';
import { sendServiceError } from '../lib/http.js';
import { getPublicForm } from '../services/form.service.js';
import {
  createSubmission,
  type RawQuestionInput,
} from '../services/submission.service.js';

interface TokenParams {
  token: string;
}

/** Strip owner-only fields; expose just what a respondent needs to render the form. */
function toPublicShape(form: Awaited<ReturnType<typeof getPublicForm>>) {
  return {
    id: form.id,
    title: form.title,
    description: form.description,
    questions: form.questions.map((q) => ({
      id: q.id,
      label: q.label,
      type: q.type,
      isRequired: q.isRequired,
      position: q.position,
      settings: q.settings,
      options: q.options.map((o) => ({ id: o.id, label: o.label, position: o.position })),
    })),
  };
}

/** Field-name prefix that maps a multipart part to a question. */
const FIELD_PREFIX = 'q_';

/**
 * Unauthenticated public routes. Registered OUTSIDE the protected scope.
 */
export async function publicRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: TokenParams }>('/public/forms/:token', async (request, reply) => {
    try {
      return toPublicShape(await getPublicForm(request.params.token));
    } catch (err) {
      return sendServiceError(app, reply, err);
    }
  });

  app.post<{ Params: TokenParams }>(
    '/public/forms/:token/submit',
    async (request, reply) => {
      if (!request.isMultipart()) {
        return reply.send(app.httpErrors.badRequest('Expected multipart/form-data'));
      }

      // Collect parts, grouping by question id (field name `q_<questionId>`).
      const inputs = new Map<string, RawQuestionInput>();
      const get = (qid: string): RawQuestionInput => {
        let entry = inputs.get(qid);
        if (!entry) {
          entry = { texts: [], files: [] };
          inputs.set(qid, entry);
        }
        return entry;
      };

      try {
        for await (const part of request.parts()) {
          if (!part.fieldname.startsWith(FIELD_PREFIX)) continue;
          const qid = part.fieldname.slice(FIELD_PREFIX.length);
          if (part.type === 'file') {
            const buffer = await part.toBuffer();
            get(qid).files.push({
              filename: part.filename,
              mimeType: part.mimetype,
              buffer,
            });
          } else {
            get(qid).texts.push(String(part.value));
          }
        }
      } catch (err) {
        // @fastify/multipart throws when a file exceeds the configured limit.
        request.log.warn({ err }, 'multipart parse failed');
        return reply.send(app.httpErrors.payloadTooLarge('Uploaded file is too large'));
      }

      try {
        const result = await createSubmission(request.params.token, inputs);
        return reply.code(201).send(result);
      } catch (err) {
        return sendServiceError(app, reply, err);
      }
    },
  );
}
