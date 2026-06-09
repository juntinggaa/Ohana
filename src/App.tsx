import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { Layout } from './components/Layout'
import { Toaster } from './components/Toaster'
import { ErrorBoundary } from './components/ErrorBoundary'
import { DashboardPage } from './pages/Dashboard'
import { MentalLoadPage } from './pages/MentalLoad'
import { FamilyPage } from './pages/Family'
import { SettingsPage } from './pages/Settings'
import { PitchModePage } from './pages/PitchMode'
import { WelcomePage } from './pages/Welcome'
import { TodayPage } from './pages/Today'
import { MemoryPage } from './pages/Memory'
import { useAppStore } from './lib/store'

// `useAppStore` retained for WelcomeGate

/**
 * Effect-based welcome gate · 防止 <Navigate /> in-render loop
 * 只有当真的需要跳转时才调用 navigate，避免任何递归 setState 风险
 */
function WelcomeGate() {
  const hasSeenWelcome = useAppStore((s) => s.hasSeenWelcome)
  const { pathname } = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (hasSeenWelcome) return
    if (pathname.startsWith('/welcome') || pathname.startsWith('/pitch')) return
    navigate('/welcome', { replace: true })
  }, [hasSeenWelcome, pathname, navigate])

  return null
}

export default function App() {
  return (
    <ErrorBoundary>
      <WelcomeGate />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/memory" replace />} />
          <Route path="/welcome" element={<WelcomePage />} />
          {/* 三个主视图 · 所有家人通用 */}
          <Route path="/me" element={<TodayPage />} />
          <Route path="/overview" element={<DashboardPage />} />
          <Route path="/memory" element={<MemoryPage />} />
          {/* 旧路径兼容 */}
          <Route path="/today" element={<Navigate to="/me" replace />} />
          <Route path="/dashboard" element={<Navigate to="/overview" replace />} />
          {/* 旧收件箱入口并入问欧哈娜，安排会在对话中自动整理。 */}
          <Route path="/inbox" element={<Navigate to="/memory?view=assistant" replace />} />
          {/* 全部任务已并入 /me · 全部事项 tab */}
          <Route path="/tasks" element={<Navigate to="/me?view=all" replace />} />
          {/* 次要 / 协调者高级 */}
          <Route path="/mental-load" element={<MentalLoadPage />} />
          <Route path="/family" element={<FamilyPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/pitch" element={<PitchModePage />} />
          <Route path="*" element={<Navigate to="/memory" replace />} />
        </Route>
      </Routes>
      <Toaster />
    </ErrorBoundary>
  )
}
