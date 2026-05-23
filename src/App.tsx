import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/Layout'
import { DashboardPage } from './pages/Dashboard'
import { InboxPage } from './pages/Inbox'
import { TasksPage } from './pages/Tasks'
import { MentalLoadPage } from './pages/MentalLoad'
import { PitchModePage } from './pages/PitchMode'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/inbox" element={<InboxPage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/mental-load" element={<MentalLoadPage />} />
        <Route path="/pitch" element={<PitchModePage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  )
}
