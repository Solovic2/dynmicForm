import { api } from './client.ts';

export type QuestionType = 'TEXT' | 'MULTIPLE_CHOICE' | 'FILE';
export type FormStatus = 'DRAFT' | 'PUBLISHED';

export interface QuestionSettings {
  multiline?: boolean;
  minLength?: number;
  maxLength?: number;
  placeholder?: string;
  format?: 'email';
  allowMultiple?: boolean;
  minSelected?: number;
  maxSelected?: number;
  acceptedMimeTypes?: string[];
  maxSizeBytes?: number;
}

export interface QuestionOption {
  id: string;
  label: string;
  position: number;
}

export interface Question {
  id: string;
  label: string;
  type: QuestionType;
  isRequired: boolean;
  position: number;
  settings: QuestionSettings;
  options: QuestionOption[];
}

export interface Form {
  id: string;
  title: string;
  description: string | null;
  status: FormStatus;
  portalToken: string | null;
  createdAt: string;
  updatedAt: string;
  questions?: Question[];
  _count?: { submissions: number; questions: number };
}

export interface QuestionInput {
  label: string;
  type: QuestionType;
  isRequired: boolean;
  settings: QuestionSettings;
  options?: { id?: string; label: string }[];
}

/** Full form definition for the builder's single Save action. */
export interface SaveFormInput {
  title: string;
  description?: string | null;
  questions: (QuestionInput & { id?: string })[];
}

const json = (body: unknown): RequestInit => ({
  body: JSON.stringify(body),
});

export const listForms = () => api<Form[]>('/forms');
export const getForm = (id: string) => api<Form>(`/forms/${id}`);

/** Create a whole form (title + questions + options) in one request. */
export const saveNewForm = (body: SaveFormInput) =>
  api<Form>('/forms', { method: 'POST', ...json(body) });
/** Replace a whole form (title + questions + options) in one request. */
export const saveForm = (id: string, body: SaveFormInput) =>
  api<Form>(`/forms/${id}`, { method: 'PUT', ...json(body) });
export const updateForm = (id: string, body: { title?: string; description?: string | null }) =>
  api<Form>(`/forms/${id}`, { method: 'PATCH', ...json(body) });
export const deleteForm = (id: string) => api<void>(`/forms/${id}`, { method: 'DELETE' });
export const publishForm = (id: string) => api<Form>(`/forms/${id}/publish`, { method: 'POST' });
export const unpublishForm = (id: string) => api<Form>(`/forms/${id}/unpublish`, { method: 'POST' });

export const addQuestion = (formId: string, body: QuestionInput) =>
  api<Question>(`/forms/${formId}/questions`, { method: 'POST', ...json(body) });
export const updateQuestion = (formId: string, qid: string, body: Partial<QuestionInput>) =>
  api<Question>(`/forms/${formId}/questions/${qid}`, { method: 'PATCH', ...json(body) });
export const deleteQuestion = (formId: string, qid: string) =>
  api<void>(`/forms/${formId}/questions/${qid}`, { method: 'DELETE' });
export const reorderQuestions = (formId: string, questionIds: string[]) =>
  api<void>(`/forms/${formId}/questions/reorder`, { method: 'PATCH', ...json({ questionIds }) });
