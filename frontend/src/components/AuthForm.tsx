import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext.tsx';
import { ApiError } from '../api/client.ts';
import { Button, inputClass, labelClass } from './ui.tsx';

type Mode = 'login' | 'register';

/** Combined login / register form (no router needed — toggles between modes). */
export function AuthForm(): JSX.Element {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(email, password, name || undefined);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold text-gray-900">
        {mode === 'login' ? 'Sign in' : 'Create your account'}
      </h2>

      {mode === 'register' && (
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Name (optional)</label>
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label className={labelClass}>Email</label>
        <input
          className={inputClass}
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className={labelClass}>Password</label>
        <input
          className={inputClass}
          type="password"
          required
          minLength={mode === 'register' ? 8 : undefined}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
        />
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      <Button type="submit" variant="primary" disabled={submitting} className="w-full">
        {submitting ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
      </Button>

      <button
        type="button"
        onClick={() => {
          setMode(mode === 'login' ? 'register' : 'login');
          setError(null);
        }}
        className="text-sm text-blue-600 hover:underline"
      >
        {mode === 'login' ? 'Need an account? Register' : 'Have an account? Sign in'}
      </button>
    </form>
  );
}
