import type { QuestionType } from '../api/forms.ts';

/**
 * Declarative, config-driven definition of the per-type question settings.
 * The builder renders settings UI from this list, and the values are stored in
 * the question's `settings` JSON. Add a new configurable option by adding an
 * entry here (and the matching key to the backend `questionSettingsSchema`).
 */
export type SettingKind = 'boolean' | 'number' | 'text' | 'tags' | 'select';

export interface SettingField {
  key: string;
  label: string;
  kind: SettingKind;
  inline?: boolean; // booleans rendered inline next to "Required"
  placeholder?: string;
  options?: { value: string; label: string }[]; // for select
}

export const SETTINGS_FIELDS: Record<QuestionType, SettingField[]> = {
  TEXT: [
    { key: 'multiline', label: 'Multi-line', kind: 'boolean', inline: true },
    {
      key: 'format',
      label: 'Format',
      kind: 'select',
      options: [
        { value: '', label: 'Plain text' },
        { value: 'email', label: 'Email' },
      ],
    },
    { key: 'minLength', label: 'Min length', kind: 'number', placeholder: 'No min' },
    { key: 'maxLength', label: 'Max length', kind: 'number', placeholder: 'No max' },
    { key: 'placeholder', label: 'Placeholder', kind: 'text' },
  ],
  MULTIPLE_CHOICE: [
    { key: 'allowMultiple', label: 'Allow multiple', kind: 'boolean', inline: true },
  ],
  FILE: [
    { key: 'acceptedMimeTypes', label: 'Accepted types', kind: 'tags', placeholder: 'application/pdf, image/*' },
    { key: 'maxSizeBytes', label: 'Max size (bytes)', kind: 'number', placeholder: 'No limit' },
  ],
};

/** Input-friendly value map. Numbers/tags are held as strings while editing. */
export type DraftSettings = Record<string, string | boolean>;

/** API settings JSON → editable draft values. */
export function settingsToDraft(
  type: QuestionType,
  settings: Record<string, unknown> | undefined,
): DraftSettings {
  const out: DraftSettings = {};
  for (const f of SETTINGS_FIELDS[type]) {
    const v = settings?.[f.key];
    if (f.kind === 'boolean') out[f.key] = Boolean(v);
    else if (f.kind === 'tags') out[f.key] = Array.isArray(v) ? v.join(', ') : '';
    else out[f.key] = v == null ? '' : String(v);
  }
  return out;
}

/** Editable draft values → cleaned API settings JSON (empty values dropped). */
export function draftToSettings(type: QuestionType, s: DraftSettings): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of SETTINGS_FIELDS[type]) {
    const v = s[f.key];
    if (f.kind === 'boolean') {
      if (v) out[f.key] = true;
    } else if (f.kind === 'number') {
      const n = Number(v);
      if (v !== '' && v != null && !Number.isNaN(n) && n > 0) out[f.key] = n;
    } else if (f.kind === 'tags') {
      const arr = String(v ?? '')
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);
      if (arr.length) out[f.key] = arr;
    } else if (f.kind === 'select') {
      if (v) out[f.key] = v;
    } else {
      const t = String(v ?? '').trim();
      if (t) out[f.key] = t;
    }
  }
  return out;
}
