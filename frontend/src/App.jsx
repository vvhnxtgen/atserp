import { Navigate, Route, Routes } from 'react-router-dom';
import { useApp } from './ctx';
import Accounts from './pages/Accounts';
import Business from './pages/Business';
import Dashboard from './pages/Dashboard';
import IndentsPage from './pages/IndentsPage';
import Login from './pages/Login';
import Quality from './pages/Quality';
import Equipment from './pages/Equipment';
import Calibration from './pages/Calibration';
import Reports from './pages/Reports';
import DispatchPage from './pages/Dispatch';
import Challan from './pages/Challan';
import Settings from './pages/Settings';
import TestPage from './pages/TestPage';
import TrfDetail from './pages/TrfDetail';
import Layout from './components/Layout';

function Booting() {
  return <div className="d-flex vh-100 align-items-center justify-content-center text-secondary">Loading…</div>;
}

function RequireAuth({ children }) {
  const { user, booted } = useApp();
  if (!booted) return <Booting />;
  return user ? children : <Navigate to="/login" replace />;
}

function AdminOnly({ children }) {
  const { user } = useApp();
  return user?.role === 'admin' ? children : <Navigate to="/test" replace />;
}

function RoleHome() {
  const { user } = useApp();
  return user.role === 'admin' ? <Dashboard /> : <Navigate to="/test" replace />;
}

export default function App() {
  const { user, booted } = useApp();
  return (
    <Routes>
      <Route path="/login" element={!booted ? <Booting /> : user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index element={<RoleHome />} />
        <Route path="test" element={<TestPage />} />
        <Route path="test/:id" element={<TrfDetail />} />
        <Route path="quality" element={<Quality />} />
        <Route path="equipment" element={<Equipment />} />
        <Route path="calibration" element={<Calibration />} />
        <Route path="reports" element={<Reports />} />
        <Route path="dispatch" element={<DispatchPage />} />
        <Route path="challan" element={<Challan />} />
        <Route path="indents" element={<IndentsPage />} />
        <Route path="business" element={<AdminOnly><Business /></AdminOnly>} />
        <Route path="accounts" element={<AdminOnly><Accounts /></AdminOnly>} />
        <Route path="settings" element={<AdminOnly><Settings /></AdminOnly>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
