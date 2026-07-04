import { ApiError } from './client.ts';
import type { QuestionType, QuestionSettings } from './forms.ts';

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';

export interface PublicOption {
  id: string;
  label: string;
  position: number;
}

export interface PublicQuestion {
  id: string;
  label: string;
  type: QuestionType;
  isRequired: boolean;
  position: number;
  settings: QuestionSettings;
  options: PublicOption[];
}

export interface PublicForm {
  id: string;
  title: string;
  description: string | null;
  questions: PublicQuestion[];
}

async function toError(res: Response): Promise<ApiError> {
  let message = res.statusText;
  try {
    message = (await res.json()).message ?? message;
  } catch {
    /* ignore */
  }
  return new ApiError(res.status, message);
}

/** Fetch a published form definition (no auth). */
export async function getPublicForm(token: string): Promise<PublicForm> {
  const res = await fetch(`${API_URL}/public/forms/${token}`);
  if (!res.ok) throw await toError(res);
  return res.json();
}

/** Submit a public form as multipart/form-data (no auth). */
export async function submitPublicForm(token: string, formData: FormData): Promise<{ id: string }> {
  // Do NOT set Content-Type — the browser adds the multipart boundary.
  const res = await fetch(`${API_URL}/public/forms/${token}/submit`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw await toError(res);
  return res.json();
}
