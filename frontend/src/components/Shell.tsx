import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.tsx';
import { Button } from './ui.tsx';

/** Shared layout for authenticated pages: header with nav + logout. */
export function Shell({ children }: { children: ReactNode }): JSX.Element {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link to="/forms" className="flex shrink-0 items-center gap-2 text-lg font-bold text-gray-900">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-blue-600 text-sm text-white">
              F
            </span>
            Dynamic Form
          </Link>
          <div className="flex min-w-0 items-center gap-3 text-sm">
            <span className="hidden truncate text-gray-500 sm:inline">{user?.email}</span>
            <Button variant="secondary" size="sm" onClick={() => void logout()}>
              Log out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
