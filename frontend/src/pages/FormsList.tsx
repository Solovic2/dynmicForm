import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Shell } from '../components/Shell.tsx';
import { Badge, Button, ConfirmDialog, Loading, Modal, inputClass } from '../components/ui.tsx';
import {
  deleteForm,
  listForms,
  publishForm,
  unpublishForm,
  updateForm,
  type Form,
} from '../api/forms.ts';

export function FormsList(): JSX.Element {
  const [forms, setForms] = useState<Form[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<Form | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleting, setDeleting] = useState<Form | null>(null);

  async function refresh(): Promise<void> {
    setForms(await listForms());
    setLoading(false);
  }

  useEffect(() => {
    refresh().catch((e) => {
      setError(String(e));
      setLoading(false);
    });
  }, []);

  function openRename(form: Form): void {
    setRenaming(form);
    setRenameValue(form.title);
  }

  async function submitRename(): Promise<void> {
    if (!renaming) return;
    const next = renameValue.trim();
    if (next && next !== renaming.title) {
      await updateForm(renaming.id, { title: next });
      await refresh();
    }
    setRenaming(null);
  }

  async function confirmDelete(): Promise<void> {
    if (!deleting) return;
    await deleteForm(deleting.id);
    setDeleting(null);
    await refresh();
  }

  async function togglePublish(form: Form): Promise<void> {
    if (form.status === 'PUBLISHED') await unpublishForm(form.id);
    else await publishForm(form.id);
    await refresh();
  }

  return (
    <Shell>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Your forms</h1>
        <Link
          to="/forms/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          + New form
        </Link>
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {loading ? (
        <Loading />
      ) : forms.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-gray-300 bg-white py-12 text-center text-gray-500">
          No forms yet — create your first one.
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {forms.map((form) => (
            <li
              key={form.id}
              className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-semibold text-gray-900" title={form.title}>
                    {form.title}
                  </span>
                  <span className="shrink-0">
                    <Badge tone={form.status === 'PUBLISHED' ? 'blue' : 'gray'}>{form.status}</Badge>
                  </span>
                </div>
                <div className="mt-1 text-sm text-gray-500">
                  {form._count?.questions ?? 0} questions · {form._count?.submissions ?? 0} submissions
                  {form.status === 'PUBLISHED' && form.portalToken && (
                    <>
                      {' · '}
                      <a
                        href={`/f/${form.portalToken}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-blue-600 hover:text-blue-700 hover:underline"
                      >
                        Public link
                      </a>
                    </>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Link
                  to={`/forms/${form.id}/edit`}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Edit
                </Link>
                <Link
                  to={`/forms/${form.id}/submissions`}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Submissions
                </Link>
                <Button variant={form.status === 'PUBLISHED' ? 'secondary' : 'primary'} size="sm" onClick={() => void togglePublish(form)}>
                  {form.status === 'PUBLISHED' ? 'Unpublish' : 'Publish'}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => openRename(form)}>
                  Rename
                </Button>
                <Button variant="danger" size="sm" onClick={() => setDeleting(form)}>
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={renaming !== null}
        onClose={() => setRenaming(null)}
        title="Rename form"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setRenaming(null)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={() => void submitRename()}>
              Save
            </Button>
          </div>
        }
      >
        <div className="p-4">
          <label className="mb-1 block text-sm font-medium text-gray-700">Title</label>
          <input
            autoFocus
            className={inputClass}
            maxLength={200}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void submitRename()}
          />
        </div>
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title="Delete form"
        message={
          <>
            Delete <strong>{deleting?.title}</strong>? This permanently removes the form and all its
            submissions.
          </>
        }
        confirmLabel="Delete"
        danger
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleting(null)}
      />
    </Shell>
  );
}
