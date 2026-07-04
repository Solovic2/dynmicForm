import type { FastifyInstance } from 'fastify';
import { parseBody, sendServiceError } from '../lib/http.js';
import {
  createQuestionSchema,
  reorderQuestionsSchema,
  saveFormSchema,
  updateFormSchema,
  updateQuestionSchema,
} from '../schemas/form.js';
import * as forms from '../services/form.service.js';
import * as submissions from '../services/submission.service.js';

interface IdParams {
  id: string;
}
interface QuestionParams {
  id: string;
  qid: string;
}
interface SubmissionParams {
  id: string;
  sid: string;
}
interface FileParams {
  id: string;
}

/**
 * Authenticated form-management routes. Registered inside the protected scope,
 * so `request.user` is always set.
 */
export async function formRoutes(app: FastifyInstance): Promise<void> {
  const uid = (req: { user?: { id: string } }) => req.user!.id;

  // ---- Forms ----
  app.get('/forms', async (request) => forms.listForms(uid(request)));

  // Accepts a full definition (title + optional inline questions) so the whole
  // form can be created in one request.
  app.post('/forms', async (request, reply) => {
    const input = parseBody(app, saveFormSchema, request.body, reply);
    if (!input) return;
    return reply.code(201).send(await forms.createFormWithQuestions(uid(request), input));
  });

  app.get<{ Params: IdParams }>('/forms/:id', async (request, reply) => {
    try {
      return await forms.getForm(request.params.id, uid(request));
    } catch (err) {
      return sendServiceError(app, reply, err);
    }
  });

  app.patch<{ Params: IdParams }>('/forms/:id', async (request, reply) => {
    const input = parseBody(app, updateFormSchema, request.body, reply);
    if (!input) return;
    try {
      return await forms.updateForm(request.params.id, uid(request), input);
    } catch (err) {
      return sendServiceError(app, reply, err);
    }
  });

  // Full replace of the form (title + questions + options) in one call.
  app.put<{ Params: IdParams }>('/forms/:id', async (request, reply) => {
    const input = parseBody(app, saveFormSchema, request.body, reply);
    if (!input) return;
    try {
      return await forms.replaceForm(request.params.id, uid(request), input);
    } catch (err) {
      return sendServiceError(app, reply, err);
    }
  });

  app.delete<{ Params: IdParams }>('/forms/:id', async (request, reply) => {
    try {
      await forms.deleteForm(request.params.id, uid(request));
      return reply.code(204).send();
    } catch (err) {
      return sendServiceError(app, reply, err);
    }
  });

  app.post<{ Params: IdParams }>('/forms/:id/publish', async (request, reply) => {
    try {
      return await forms.publishForm(request.params.id, uid(request));
    } catch (err) {
      return sendServiceError(app, reply, err);
    }
  });

  app.post<{ Params: IdParams }>('/forms/:id/unpublish', async (request, reply) => {
    try {
      return await forms.unpublishForm(request.params.id, uid(request));
    } catch (err) {
      return sendServiceError(app, reply, err);
    }
  });

  // ---- Questions ----
  app.post<{ Params: IdParams }>('/forms/:id/questions', async (request, reply) => {
    const input = parseBody(app, createQuestionSchema, request.body, reply);
    if (!input) return;
    try {
      return reply.code(201).send(await forms.addQuestion(request.params.id, uid(request), input));
    } catch (err) {
      return sendServiceError(app, reply, err);
    }
  });

  // NB: register the static `/reorder` path before the dynamic `/:qid`.
  app.patch<{ Params: IdParams }>('/forms/:id/questions/reorder', async (request, reply) => {
    const input = parseBody(app, reorderQuestionsSchema, request.body, reply);
    if (!input) return;
    try {
      await forms.reorderQuestions(request.params.id, uid(request), input.questionIds);
      return reply.code(204).send();
    } catch (err) {
      return sendServiceError(app, reply, err);
    }
  });

  app.patch<{ Params: QuestionParams }>('/forms/:id/questions/:qid', async (request, reply) => {
    const input = parseBody(app, updateQuestionSchema, request.body, reply);
    if (!input) return;
    try {
      return await forms.updateQuestion(
        request.params.id,
        request.params.qid,
        uid(request),
        input,
      );
    } catch (err) {
      return sendServiceError(app, reply, err);
    }
  });

  app.delete<{ Params: QuestionParams }>('/forms/:id/questions/:qid', async (request, reply) => {
    try {
      await forms.deleteQuestion(request.params.id, request.params.qid, uid(request));
      return reply.code(204).send();
    } catch (err) {
      return sendServiceError(app, reply, err);
    }
  });

  // ---- Submission viewing ----
  app.get<{ Params: IdParams }>('/forms/:id/submissions', async (request, reply) => {
    try {
      return await submissions.listSubmissions(request.params.id, uid(request));
    } catch (err) {
      return sendServiceError(app, reply, err);
    }
  });

  app.get<{ Params: SubmissionParams }>(
    '/forms/:id/submissions/:sid',
    async (request, reply) => {
      try {
        return await submissions.getSubmission(
          request.params.id,
          request.params.sid,
          uid(request),
        );
      } catch (err) {
        return sendServiceError(app, reply, err);
      }
    },
  );

  // ---- File download (owner-gated presigned URL) ----
  // ?disposition=inline renders in-browser (preview); default forces download.
  app.get<{ Params: FileParams; Querystring: { disposition?: string } }>(
    '/files/:id',
    async (request, reply) => {
      try {
        const disposition = request.query.disposition === 'inline' ? 'inline' : 'attachment';
        const url = await submissions.getFileDownloadUrl(request.params.id, uid(request), disposition);
        return { url };
      } catch (err) {
        return sendServiceError(app, reply, err);
      }
    },
  );
}
