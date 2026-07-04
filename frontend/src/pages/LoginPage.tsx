import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.tsx';
import { AuthForm } from '../components/AuthForm.tsx';
import { Card } from '../components/ui.tsx';

/** Login/register page. Redirects to /forms once authenticated. */
export function LoginPage(): JSX.Element {
  const { user, loading } = useAuth();
  if (!loading && user) return <Navigate to="/forms" replace />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2 text-2xl font-bold text-gray-900">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-600 text-lg text-white">
            F
          </span>
          Dynamic Form
        </div>
        <Card className="p-6">
          <AuthForm />
        </Card>
      </div>
    </div>
  );
}
