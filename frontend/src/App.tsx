import { Navigate, Route, Routes } from 'react-router-dom';
import { RequireAuth } from './auth/RequireAuth.tsx';
import { LoginPage } from './pages/LoginPage.tsx';
import { FormsList } from './pages/FormsList.tsx';
import { FormBuilder } from './pages/FormBuilder.tsx';
import { SubmissionsList } from './pages/SubmissionsList.tsx';
import { SubmissionDetail } from './pages/SubmissionDetail.tsx';
import { PublicForm } from './pages/PublicForm.tsx';

function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/f/:token" element={<PublicForm />} />

      {/* Protected */}
      <Route
        path="/forms"
        element={
          <RequireAuth>
            <FormsList />
          </RequireAuth>
        }
      />
      <Route
        path="/forms/new"
        element={
          <RequireAuth>
            <FormBuilder />
          </RequireAuth>
        }
      />
      <Route
        path="/forms/:id/edit"
        element={
          <RequireAuth>
            <FormBuilder />
          </RequireAuth>
        }
      />
      <Route
        path="/forms/:id/submissions"
        element={
          <RequireAuth>
            <SubmissionsList />
          </RequireAuth>
        }
      />
      <Route
        path="/forms/:id/submissions/:sid"
        element={
          <RequireAuth>
            <SubmissionDetail />
          </RequireAuth>
        }
      />

      <Route path="*" element={<Navigate to="/forms" replace />} />
    </Routes>
  );
}

export default App;
