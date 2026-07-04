import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Shell } from '../components/Shell.tsx';
import { BackLink, Button, Dropdown, Loading, inputClass, labelClass } from '../components/ui.tsx';
import { ApiError } from '../api/client.ts';
import {
  getForm,
  publishForm,
  saveForm,
  saveNewForm,
  unpublishForm,
  type Form,
  type QuestionType,
  type SaveFormInput,
} from '../api/forms.ts';
import {
  SETTINGS_FIELDS,
  draftToSettings,
  settingsToDraft,
  type DraftSettings,
  type SettingField,
} from '../forms/settingsSchema.ts';

interface DraftOption {
  key: string;
  id?: string;
  label: string;
}
interface DraftQuestion {
  key: string;
  id?: string;
  label: string;
  type: QuestionType;
  isRequired: boolean;
  settings: DraftSettings; // generic per-type config (see settingsSchema)
  options: DraftOption[];
}

const typeLabels: Record<QuestionType, string> = {
  TEXT: 'Text',
  MULTIPLE_CHOICE: 'Multiple choice',
  FILE: 'File upload',
};

export function FormBuilder(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const isNew = !id;
  const navigate = useNavigate();

  const keyCounter = useRef(0);
  const nextKey = () => `k${keyCounter.current++}`;

  const makeQuestion = (
    partial: Partial<DraftQuestion> & Pick<DraftQuestion, 'label' | 'type'>,
  ): DraftQuestion => ({
    key: nextKey(),
    isRequired: false,
    settings: settingsToDraft(partial.type, {}),
    options: partial.type === 'MULTIPLE_CHOICE' ? [{ key: nextKey(), label: 'Option 1' }] : [],
    ...partial,
  });

  // New forms start with a sensible pair: a required Name and an optional Email.
  const defaultQuestions = (): DraftQuestion[] => [
    makeQuestion({ label: 'Name', type: 'TEXT', isRequired: true }),
    makeQuestion({ label: 'Email', type: 'TEXT', settings: settingsToDraft('TEXT', { format: 'email' }) }),
  ];

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<DraftQuestion[]>(() =>
    isNew ? defaultQuestions() : [],
  );
  const [status, setStatus] = useState<Form['status']>('DRAFT');
  const [portalToken, setPortalToken] = useState<string | null>(null);

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function loadDraft(form: Form): void {
    setTitle(form.title);
    setDescription(form.description ?? '');
    setStatus(form.status);
    setPortalToken(form.portalToken);
    setQuestions(
      (form.questions ?? []).map((q) => ({
        key: nextKey(),
        id: q.id,
        label: q.label,
        type: q.type,
        isRequired: q.isRequired,
        settings: settingsToDraft(q.type, q.settings as Record<string, unknown>),
        options: q.options.map((o) => ({ key: nextKey(), id: o.id, label: o.label })),
      })),
    );
  }

  useEffect(() => {
    if (!id) return;
    getForm(id)
      .then(loadDraft)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [id]);

  // ---- Draft mutators (all local) ----
  const patchQuestion = (key: string, patch: Partial<DraftQuestion>) =>
    setQuestions((qs) => qs.map((q) => (q.key === key ? { ...q, ...patch } : q)));

  const patchSetting = (key: string, settingKey: string, value: string | boolean) =>
    setQuestions((qs) =>
      qs.map((q) =>
        q.key === key ? { ...q, settings: { ...q.settings, [settingKey]: value } } : q,
      ),
    );

  function changeType(key: string, type: QuestionType): void {
    setQuestions((qs) =>
      qs.map((q) =>
        q.key === key
          ? {
              ...q,
              type,
              // reset settings to the new type's defaults
              settings: settingsToDraft(type, {}),
              options:
                type === 'MULTIPLE_CHOICE' && q.options.length === 0
                  ? [{ key: nextKey(), label: 'Option 1' }]
                  : q.options,
            }
          : q,
      ),
    );
  }

  function addQuestion(type: QuestionType): void {
    setQuestions((qs) => [...qs, makeQuestion({ label: '', type })]);
  }

  const removeQuestion = (key: string) => setQuestions((qs) => qs.filter((q) => q.key !== key));

  function moveQuestion(key: string, dir: -1 | 1): void {
    setQuestions((qs) => {
      const i = qs.findIndex((q) => q.key === key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= qs.length) return qs;
      const next = [...qs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function patchOption(qKey: string, oKey: string, label: string): void {
    setQuestions((qs) =>
      qs.map((q) =>
        q.key === qKey
          ? { ...q, options: q.options.map((o) => (o.key === oKey ? { ...o, label } : o)) }
          : q,
      ),
    );
  }
  const addOption = (qKey: string) =>
    setQuestions((qs) =>
      qs.map((q) =>
        q.key === qKey
          ? { ...q, options: [...q.options, { key: nextKey(), label: `Option ${q.options.length + 1}` }] }
          : q,
      ),
    );
  const removeOption = (qKey: string, oKey: string) =>
    setQuestions((qs) =>
      qs.map((q) => (q.key === qKey ? { ...q, options: q.options.filter((o) => o.key !== oKey) } : q)),
    );

  // ---- Persistence ----
  function validate(): string | null {
    if (!title.trim()) return 'Form title is required';
    for (const q of questions) {
      if (!q.label.trim()) return 'Every question needs a label';
      if (q.type === 'MULTIPLE_CHOICE' && q.options.filter((o) => o.label.trim()).length === 0)
        return `"${q.label || 'A choice question'}" needs at least one option`;
    }
    return null;
  }

  function buildPayload(): SaveFormInput {
    return {
      title: title.trim(),
      description: description.trim() || null,
      questions: questions.map((q) => ({
        id: q.id,
        label: q.label.trim(),
        type: q.type,
        isRequired: q.isRequired,
        settings: draftToSettings(q.type, q.settings),
        options:
          q.type === 'MULTIPLE_CHOICE'
            ? q.options.filter((o) => o.label.trim()).map((o) => ({ id: o.id, label: o.label.trim() }))
            : undefined,
      })),
    };
  }

  async function save(): Promise<Form | null> {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return null;
    }
    setError(null);
    setSaving(true);
    try {
      const payload = buildPayload();
      if (isNew) {
        const created = await saveNewForm(payload);
        navigate(`/forms/${created.id}/edit`, { replace: true });
        return created;
      }
      const updated = await saveForm(id!, payload);
      loadDraft(updated);
      setNotice('Saved');
      setTimeout(() => setNotice(null), 1500);
      return updated;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Save failed');
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish(): Promise<void> {
    if (isNew) return;
    const saved = await save();
    if (!saved) return;
    const next = saved.status === 'PUBLISHED' ? await unpublishForm(id!) : await publishForm(id!);
    setStatus(next.status);
    setPortalToken(next.portalToken);
  }

  async function copyLink(url: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — ignore */
    }
  }

  if (loading) return <Shell><Loading /></Shell>;

  const publicUrl =
    status === 'PUBLISHED' && portalToken ? `${window.location.origin}/f/${portalToken}` : null;

  return (
    <Shell>
      <BackLink to="/forms">All forms</BackLink>
      <h1 className="mt-2 text-2xl font-bold text-gray-900">{isNew ? 'New form' : 'Edit form'}</h1>

      {/* Form meta */}
      <div className="mt-4 flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Title</label>
          <input className={inputClass} value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} placeholder="Untitled form" />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Description (optional)</label>
          <textarea
            className={`${inputClass} resize-none`}
            rows={3}
            maxLength={500}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
      </div>

      {/* Questions */}
      <h2 className="mt-8 text-lg font-semibold text-gray-900">Questions</h2>
      {questions.length === 0 && (
        <p className="mt-2 text-sm text-gray-500">No questions yet — add one below.</p>
      )}
      <div className="mt-3 flex flex-col gap-3">
        {questions.map((q, i) => {
          const inlineFields = SETTINGS_FIELDS[q.type].filter((f) => f.inline);
          const gridFields = SETTINGS_FIELDS[q.type].filter((f) => !f.inline);
          return (
            <div key={q.key} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-gray-100 text-xs font-medium text-gray-500">
                  {i + 1}
                </span>
                <input
                  className={inputClass}
                  placeholder="Question label"
                  maxLength={500}
                  value={q.label}
                  onChange={(e) => patchQuestion(q.key, { label: e.target.value })}
                />
                <Dropdown<QuestionType>
                  className="w-44 shrink-0"
                  value={q.type}
                  options={(Object.keys(typeLabels) as QuestionType[]).map((t) => ({
                    value: t,
                    label: typeLabels[t],
                  }))}
                  onChange={(type) => changeType(q.key, type)}
                />
              </div>

              {/* Required + inline (boolean) settings */}
              <div className="mt-3 flex flex-wrap gap-4 text-sm text-gray-600">
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    className="accent-blue-600"
                    checked={q.isRequired}
                    onChange={(e) => patchQuestion(q.key, { isRequired: e.target.checked })}
                  />
                  Required
                </label>
                {inlineFields.map((f) => (
                  <label key={f.key} className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      className="accent-blue-600"
                      checked={Boolean(q.settings[f.key])}
                      onChange={(e) => patchSetting(q.key, f.key, e.target.checked)}
                    />
                    {f.label}
                  </label>
                ))}
              </div>

              {/* Non-inline settings, rendered from config */}
              {gridFields.length > 0 && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {gridFields.map((f) => (
                    <SettingInput
                      key={f.key}
                      field={f}
                      value={q.settings[f.key]}
                      onChange={(v) => patchSetting(q.key, f.key, v)}
                    />
                  ))}
                </div>
              )}

              {q.type === 'MULTIPLE_CHOICE' && (
                <div className="mt-3 flex flex-col gap-2 border-l-2 border-gray-100 pl-3">
                  {q.options.map((o) => (
                    <div key={o.key} className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full border border-gray-300" />
                      <input
                        className={inputClass}
                        maxLength={200}
                        value={o.label}
                        onChange={(e) => patchOption(q.key, o.key, e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => removeOption(q.key, o.key)}
                        className="rounded-md px-2 py-1 text-gray-400 hover:bg-gray-100 hover:text-red-600"
                        aria-label="Remove option"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addOption(q.key)}
                    className="self-start text-sm font-medium text-blue-600 hover:underline"
                  >
                    + Add option
                  </button>
                </div>
              )}

              <div className="mt-3 flex gap-2 border-t border-gray-100 pt-3">
                <Button variant="secondary" size="sm" onClick={() => moveQuestion(q.key, -1)} disabled={i === 0}>
                  ↑
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => moveQuestion(q.key, 1)}
                  disabled={i === questions.length - 1}
                >
                  ↓
                </Button>
                <Button variant="danger" size="sm" onClick={() => removeQuestion(q.key)}>
                  Delete
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={() => addQuestion('TEXT')}>
          + Text
        </Button>
        <Button variant="secondary" size="sm" onClick={() => addQuestion('MULTIPLE_CHOICE')}>
          + Multiple choice
        </Button>
        <Button variant="secondary" size="sm" onClick={() => addQuestion('FILE')}>
          + File upload
        </Button>
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      {notice && <p className="mt-4 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">{notice}</p>}

      {/* Sticky action bar — white with a blue top accent border */}
      <div className="sticky bottom-0 -mx-6 mt-8 border-t-2 border-blue-500 bg-white px-6 py-4 shadow-[0_-6px_20px_-8px_rgba(15,23,42,0.18)]">
        <div className="flex items-center gap-3">
          <Button variant="primary" onClick={() => void save()} disabled={saving}>
            {saving ? 'Saving…' : isNew ? 'Create form' : 'Save changes'}
          </Button>
          {!isNew && (
            <Button variant="secondary" onClick={() => void togglePublish()} disabled={saving}>
              {status === 'PUBLISHED' ? 'Unpublish' : 'Save & Publish'}
            </Button>
          )}
          {publicUrl && (
            <div className="ml-auto flex items-center gap-2">
              <a
                href={publicUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium text-blue-700 hover:text-blue-800 hover:underline"
                title={publicUrl}
              >
                Public link
              </a>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void copyLink(publicUrl)}
                title={copied ? 'Copied!' : 'Copy link'}
                aria-label="Copy public link"
                className="!px-2"
              >
                {copied ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-600">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}

/** Renders a single settings field based on its config `kind`. */
function SettingInput({
  field,
  value,
  onChange,
}: {
  field: SettingField;
  value: string | boolean;
  onChange: (value: string) => void;
}): JSX.Element {
  return (
    <label className="flex flex-col gap-1 text-sm text-gray-600">
      {field.label}
      {field.kind === 'select' ? (
        <Dropdown
          value={String(value ?? '')}
          options={field.options ?? []}
          onChange={onChange}
        />
      ) : (
        <input
          className={inputClass}
          type={field.kind === 'number' ? 'number' : 'text'}
          min={field.kind === 'number' ? 1 : undefined}
          placeholder={field.placeholder}
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );
}
