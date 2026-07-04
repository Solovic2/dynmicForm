import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Shell } from '../components/Shell.tsx';
import { BackLink, Loading } from '../components/ui.tsx';
import { getForm, type Form } from '../api/forms.ts';
import { listSubmissions, type SubmissionSummary } from '../api/submissions.ts';

export function SubmissionsList(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const [form, setForm] = useState<Form | null>(null);
  const [subs, setSubs] = useState<SubmissionSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([getForm(id), listSubmissions(id)])
      .then(([f, s]) => {
        setForm(f);
        setSubs(s);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <Shell>
      <BackLink to="/forms">All forms</BackLink>
      <h1 className="mt-2 text-2xl font-bold text-gray-900">Submissions</h1>
      {form && (
        <p className="mt-0.5 truncate text-gray-500" title={form.title}>
          {form.title}
        </p>
      )}

      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {loading ? (
        <Loading />
      ) : subs.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-gray-300 bg-white py-12 text-center text-gray-500">
          No submissions yet.
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Submitted</th>
                <th className="px-4 py-3 font-medium">Answers</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {subs.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {s.submitterName || <span className="font-normal text-gray-400">Anonymous</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {new Date(s.submittedAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{s._count.answers}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/forms/${id}/submissions/${s.id}`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Shell>
  );
}
