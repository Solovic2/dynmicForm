import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext.tsx';
import { Spinner } from '../components/ui.tsx';

/** Gate for protected routes: redirects to /login when there's no session. */
export function RequireAuth({ children }: { children: ReactNode }): JSX.Element {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size={28} label="Loading session…" />
      </div>
    );
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return <>{children}</>;
}
