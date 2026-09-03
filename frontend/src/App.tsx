import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import Layout from './components/Layout';
import AuthPage from './pages/AuthPage';
import MeetingsPage from './pages/MeetingsPage';
import MeetingDetailPage from './pages/MeetingDetailPage';
import ActionItemsPage from './pages/ActionItemsPage';
import RemindersPage from './pages/RemindersPage';
import { Spinner } from './components/ui';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex justify-center items-center min-h-screen"><Spinner size="lg" /></div>;
  return user ? <>{children}</> : <Navigate to="/auth" replace />;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex justify-center items-center min-h-screen"><Spinner size="lg" /></div>;

  return (
    <Routes>
      <Route
        path="/auth"
        element={user ? <Navigate to="/meetings" replace /> : <AuthPage />}
      />
      <Route
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route path="/meetings" element={<MeetingsPage />} />
        <Route path="/meetings/:id" element={<MeetingDetailPage />} />
        <Route path="/action-items" element={<ActionItemsPage />} />
        <Route path="/reminders" element={<RemindersPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/meetings" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
