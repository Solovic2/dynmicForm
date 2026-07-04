import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import {
  getPublicForm,
  submitPublicForm,
  type PublicForm as PublicFormType,
} from '../api/public.ts';
import { ApiError } from '../api/client.ts';
import { Button, Spinner, inputClass } from '../components/ui.tsx';

export function PublicForm(): JSX.Element {
  const { token } = useParams<{ token: string }>();
  const [form, setForm] = useState<PublicFormType | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [choices, setChoices] = useState<Record<string, string[]>>({});
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) return;
    getPublicForm(token)
      .then(setForm)
      .catch((e) => setLoadError(e instanceof ApiError ? e.message : String(e)));
  }, [token]);

  function toggleChoice(qid: string, optionId: string, multiple: boolean): void {
    setChoices((prev) => {
      const current = prev[qid] ?? [];
      if (multiple) {
        return {
          ...prev,
          [qid]: current.includes(optionId)
            ? current.filter((o) => o !== optionId)
            : [...current, optionId],
        };
      }
      return { ...prev, [qid]: [optionId] };
    });
  }

  function clientValidate(f: PublicFormType): string | null {
    for (const q of f.questions) {
      if (!q.isRequired) continue;
      if (q.type === 'TEXT' && !(texts[q.id] ?? '').trim()) return `"${q.label}" is required`;
      if (q.type === 'MULTIPLE_CHOICE' && (choices[q.id] ?? []).length === 0)
        return `"${q.label}" is required`;
      if (q.type === 'FILE' && !files[q.id]) return `"${q.label}" is required`;
    }
    return null;
  }

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (!form || !token) return;
    const validationError = clientValidate(form);
    if (validationError) {
      setSubmitError(validationError);
      return;
    }
    setSubmitError(null);
    setSubmitting(true);
    try {
      const fd = new FormData();
      for (const q of form.questions) {
        const field = `q_${q.id}`;
        if (q.type === 'TEXT') {
          const v = (texts[q.id] ?? '').trim();
          if (v) fd.append(field, v);
        } else if (q.type === 'MULTIPLE_CHOICE') {
          for (const optionId of choices[q.id] ?? []) fd.append(field, optionId);
        } else if (q.type === 'FILE') {
          const file = files[q.id];
          if (file) fd.append(field, file, file.name);
        }
      }
      await submitPublicForm(token, fd);
      setDone(true);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  }

  const page = 'min-h-screen bg-gray-50 px-4 py-10';
  const shell = 'mx-auto max-w-xl';

  if (loadError)
    return (
      <div className={page}>
        <div className={`${shell} rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm`}>
          <h1 className="text-xl font-semibold text-gray-900">Form unavailable</h1>
          <p className="mt-2 text-gray-500">{loadError}</p>
        </div>
      </div>
    );
  if (!form)
    return (
      <div className={page}>
        <div className={`${shell} flex justify-center`}>
          <Spinner size={28} />
        </div>
      </div>
    );
  if (done)
    return (
      <div className={page}>
        <div className={`${shell} rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm`}>
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-blue-100 text-2xl">
            🎉
          </div>
          <h1 className="text-xl font-semibold text-gray-900">Thank you!</h1>
          <p className="mt-2 text-gray-500">Your response to “{form.title}” has been recorded.</p>
        </div>
      </div>
    );

  return (
    <div className={page}>
      <div className={shell}>
        <div className="rounded-t-xl border-x border-t border-gray-200 border-t-4 border-t-blue-600 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">{form.title}</h1>
          {form.description && <p className="mt-1 text-gray-500">{form.description}</p>}
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-5 rounded-b-xl border-x border-b border-gray-200 bg-white p-6 shadow-sm"
        >
          {form.questions.map((q) => (
            <div key={q.id} className="flex flex-col gap-2">
              <label className="font-medium text-gray-800">
                {q.label}
                {q.isRequired && <span className="text-red-500"> *</span>}
              </label>

              {q.type === 'TEXT' &&
                (q.settings.multiline ? (
                  <textarea
                    className={inputClass}
                    rows={4}
                    maxLength={q.settings.maxLength}
                    value={texts[q.id] ?? ''}
                    onChange={(e) => setTexts({ ...texts, [q.id]: e.target.value })}
                  />
                ) : (
                  <input
                    className={inputClass}
                    type={q.settings.format === 'email' ? 'email' : 'text'}
                    maxLength={q.settings.maxLength}
                    placeholder={q.settings.placeholder}
                    value={texts[q.id] ?? ''}
                    onChange={(e) => setTexts({ ...texts, [q.id]: e.target.value })}
                  />
                ))}

              {q.type === 'MULTIPLE_CHOICE' &&
                q.options.map((o) => {
                  const multiple = q.settings.allowMultiple ?? false;
                  const selected = (choices[q.id] ?? []).includes(o.id);
                  return (
                    <label
                      key={o.id}
                      className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                        selected ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type={multiple ? 'checkbox' : 'radio'}
                        name={`q_${q.id}`}
                        className="accent-blue-600"
                        checked={selected}
                        onChange={() => toggleChoice(q.id, o.id, multiple)}
                      />
                      {o.label}
                    </label>
                  );
                })}

              {q.type === 'FILE' && (
                <input
                  type="file"
                  accept={q.settings.acceptedMimeTypes?.join(',')}
                  onChange={(e) => setFiles({ ...files, [q.id]: e.target.files?.[0] ?? null })}
                  className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-blue-700"
                />
              )}
            </div>
          ))}

          {submitError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{submitError}</p>
          )}
          <Button type="submit" variant="primary" disabled={submitting} className="self-start">
            {submitting ? 'Submitting…' : 'Submit'}
          </Button>
        </form>
      </div>
    </div>
  );
}
