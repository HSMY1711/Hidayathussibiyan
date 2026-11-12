import { Routes, Route, Navigate } from 'react-router';
import Public from './pages/Public';
import Login from './pages/Login';
import AdminLayout from './pages/admin/AdminLayout';
import Dashboard from './pages/admin/Dashboard';
import Teams from './pages/admin/Teams';
import Participants from './pages/admin/Participants';
import Programs from './pages/admin/Programs';
import Publishing from './pages/admin/Publishing';
import Results from './pages/admin/Results';
import Scores from './pages/admin/Scores';
import JudgeMarks from './pages/admin/JudgeMarks';
import PdfGen from './pages/admin/PdfGen';
import Documents from './pages/admin/Documents';
import Settings from './pages/admin/Settings';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Public />} />
      <Route path="/admin/login" element={<Login />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="teams" element={<Teams />} />
        <Route path="participants" element={<Participants />} />
        <Route path="programs" element={<Programs />} />
        <Route path="publishing" element={<Publishing />} />
        <Route path="results" element={<Results />} />
        <Route path="scores" element={<Scores />} />
        <Route path="judge-marks" element={<JudgeMarks />} />
        <Route path="pdf-generation" element={<PdfGen />} />
        <Route path="documents" element={<Documents />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
