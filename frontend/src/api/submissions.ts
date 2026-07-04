import { api } from './client.ts';
import type { Question, QuestionOption } from './forms.ts';

export interface SubmissionSummary {
  id: string;
  submittedAt: string;
  submitterName: string | null;
  _count: { answers: number };
}

export interface AnswerFile {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

export interface AnswerDetail {
  id: string;
  questionId: string;
  textValue: string | null;
  optionId: string | null;
  fileId: string | null;
  question: Question;
  option: QuestionOption | null;
  file: AnswerFile | null;
}

export interface SubmissionDetail {
  id: string;
  formId: string;
  submittedAt: string;
  answers: AnswerDetail[];
}

export const listSubmissions = (formId: string) =>
  api<SubmissionSummary[]>(`/forms/${formId}/submissions`);
export const getSubmission = (formId: string, sid: string) =>
  api<SubmissionDetail>(`/forms/${formId}/submissions/${sid}`);
export const getFileUrl = (fileId: string, disposition?: 'inline' | 'attachment') =>
  api<{ url: string }>(
    `/files/${fileId}${disposition ? `?disposition=${disposition}` : ''}`,
  );
