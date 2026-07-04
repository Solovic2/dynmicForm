import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Shell } from '../components/Shell.tsx';
import { BackLink, Button, Loading, Modal, Spinner } from '../components/ui.tsx';
import {
  getFileUrl,
  getSubmission,
  type AnswerDetail,
  type AnswerFile,
  type SubmissionDetail as Detail,
} from '../api/submissions.ts';

interface Grouped {
  questionId: string;
  label: string;
  type: string;
  position: number;
  answers: AnswerDetail[];
}

function group(answers: AnswerDetail[]): Grouped[] {
  const byQuestion = new Map<string, Grouped>();
  for (const a of answers) {
    let g = byQuestion.get(a.questionId);
    if (!g) {
      g = {
        questionId: a.questionId,
        label: a.question.label,
        type: a.question.type,
        position: a.question.position,
        answers: [],
      };
      byQuestion.set(a.questionId, g);
    }
    g.answers.push(a);
  }
  return [...byQuestion.values()].sort((x, y) => x.position - y.position);
}

interface Preview {
  file: AnswerFile;
  url: string | null; // null while the inline URL is being fetched
}

export function SubmissionDetail(): JSX.Element {
  const { id, sid } = useParams<{ id: string; sid: string }>();
  const [submission, setSubmission] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);

  useEffect(() => {
    if (!id || !sid) return;
    getSubmission(id, sid)
      .then(setSubmission)
      .catch((e) => setError(String(e)));
  }, [id, sid]);

  async function openPreview(file: AnswerFile): Promise<void> {
    setPreview({ file, url: null });
    const { url } = await getFileUrl(file.id, 'inline');
    setPreview({ file, url });
  }

  async function download(fileId: string): Promise<void> {
    const { url } = await getFileUrl(fileId, 'attachment');
    window.open(url, '_blank');
  }

  return (
    <Shell>
      <BackLink to={`/forms/${id}/submissions`}>All submissions</BackLink>
      <h1 className="mt-2 text-2xl font-bold text-gray-900">Submission</h1>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {!submission ? (
        <Loading />
      ) : (
        <>
          {(() => {
            const name = submission.answers.find(
              (a) => a.question.type === 'TEXT' && /name/i.test(a.question.label) && a.textValue,
            )?.textValue;
            return name ? <p className="mt-1 text-lg font-medium text-gray-800">{name}</p> : null;
          })()}
          <p className="mt-1 text-sm text-gray-500">
            Submitted {new Date(submission.submittedAt).toLocaleString()}
          </p>
          <dl className="mt-6 flex flex-col gap-px overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            {group(submission.answers).map((g) => (
              <div key={g.questionId} className="border-b border-gray-100 p-4 last:border-b-0">
                <dt className="text-sm font-medium text-gray-500">{g.label}</dt>
                <dd className="mt-1 text-gray-900">
                  {g.type === 'TEXT' && (g.answers[0]?.textValue || <span className="text-gray-400">—</span>)}
                  {g.type === 'MULTIPLE_CHOICE' && (
                    <div className="flex flex-wrap gap-1.5">
                      {g.answers.map((a) => a.option?.label).filter(Boolean).length ? (
                        g.answers
                          .map((a) => a.option?.label)
                          .filter(Boolean)
                          .map((label, i) => (
                            <span
                              key={i}
                              className="rounded-full bg-blue-50 px-2.5 py-0.5 text-sm text-blue-700"
                            >
                              {label}
                            </span>
                          ))
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </div>
                  )}
                  {g.type === 'FILE' &&
                    (g.answers[0]?.file ? (
                      <Button variant="secondary" size="sm" onClick={() => void openPreview(g.answers[0].file!)}>
                        📄 {g.answers[0].file!.filename}
                      </Button>
                    ) : (
                      <span className="text-gray-400">—</span>
                    ))}
                </dd>
              </div>
            ))}
          </dl>
        </>
      )}

      <Modal
        open={preview !== null}
        onClose={() => setPreview(null)}
        title={preview?.file.filename ?? 'File'}
        footer={
          preview && (
            <div className="flex justify-end">
              <Button variant="secondary" size="sm" onClick={() => void download(preview.file.id)}>
                Download
              </Button>
            </div>
          )
        }
      >
        {preview && <FilePreview file={preview.file} url={preview.url} />}
      </Modal>
    </Shell>
  );
}

function FilePreview({ file, url }: { file: AnswerFile; url: string | null }): JSX.Element {
  if (!url) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Spinner size={28} />
      </div>
    );
  }
  if (file.mimeType === 'application/pdf') {
    return <iframe src={url} title={file.filename} className="h-[75vh] w-full border-0" />;
  }
  if (file.mimeType.startsWith('image/')) {
    return (
      <div className="flex items-center justify-center p-4">
        <img src={url} alt={file.filename} className="max-h-[75vh] max-w-full rounded" />
      </div>
    );
  }
  return (
    <div className="p-10 text-center text-gray-600">
      <p className="text-4xl">📄</p>
      <p className="mt-2">Preview isn’t available for this file type ({file.mimeType}).</p>
      <p className="mt-1 text-sm text-gray-500">Use the Download button below to open it.</p>
    </div>
  );
}
