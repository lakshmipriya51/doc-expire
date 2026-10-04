import { Route, Routes } from 'react-router-dom';
import { isNativePlatform } from './services/storage';
import ProtectedRoute from './components/ProtectedRoute';
import PublicOnlyRoute from './components/PublicOnlyRoute';
import AppLayout from './components/AppLayout';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Documents from './pages/Documents';
import DocumentForm from './pages/DocumentForm';
import DocumentDetails from './pages/DocumentDetails';
import Notifications from './pages/Notifications';
import Profile from './pages/Profile';
import NotFound from './pages/NotFound';
import ServerSetup from './pages/ServerSetup';

export default function App() {
  /*
   * The Android app is a single-user, no-sign-in experience: it opens on the
   * dashboard and has no login or registration routes at all. The web build
   * keeps its normal account screens, because a shared public URL does need to
   * know who is asking.
   */
  if (isNativePlatform) {
    return (
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/documents/new" element={<DocumentForm />} />
          <Route path="/documents/:id" element={<DocumentDetails />} />
          <Route path="/documents/:id/edit" element={<DocumentForm />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/server" element={<ServerSetup />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Home />} />

      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <Login />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicOnlyRoute>
            <Register />
          </PublicOnlyRoute>
        }
      />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/documents/new" element={<DocumentForm />} />
        <Route path="/documents/:id" element={<DocumentDetails />} />
        <Route path="/documents/:id/edit" element={<DocumentForm />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/profile" element={<Profile />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}