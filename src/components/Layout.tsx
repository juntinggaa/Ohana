import { NavLink, Outlet, useLocation, Link } from 'react-router-dom'
import { Sparkles, Settings as SettingsIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getLLMProviderLabel, hasDeepSeekKey } from '@/lib/llm/llmClient'
import { hasMistralKey } from '@/lib/ocr/mistralOcr'
import { UserSwitcher } from './UserSwitcher'
import { NotificationBell } from './NotificationBell'
import { Logo } from './Logo'

// 同一套家庭入口 · 不因身份隐藏任务或记忆
const NAV_PRIMARY = [
  { to: '/memory',   label: '聊天与记忆' },
  { to: '/overview', label: '我们的家' },
  { to: '/me',       label: '为你留意' },
]

const NAV_SECONDARY = [
  { to: '/family', label: '家人小档案' },
]

export function Layout() {
  const { pathname } = useLocation()
  const isPitch = pathname.startsWith('/pitch')
  const isWelcome = pathname.startsWith('/welcome')
  const liveLLM = hasDeepSeekKey()
  const llmProvider = getLLMProviderLabel() ?? 'AI'
  const liveOcr = hasMistralKey()
  const NAV = [...NAV_PRIMARY, ...NAV_SECONDARY]

  if (isPitch) {
    return (
      <div className="min-h-screen bg-ink-900 text-paper">
        <Outlet />
      </div>
    )
  }

  if (isWelcome) {
    return (
      <div className="min-h-screen bg-paper">
        <Outlet />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-paper-200 sticky top-0 z-30 backdrop-blur-md bg-paper/85">
        <div className="max-w-6xl mx-auto px-5 lg:px-12 min-h-20 py-3 flex flex-wrap items-center justify-between gap-3">
          <Link to="/memory" className="group shrink-0">
            <Logo withWordmark size={36} />
          </Link>

          <nav className="order-3 w-full md:order-none md:w-auto flex items-center justify-start md:justify-center gap-0.5 md:gap-1 rounded-full bg-paper-50 border border-paper-200 p-1 overflow-x-auto">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  cn(
                    'whitespace-nowrap rounded-full px-1.5 py-2 text-[11px] sm:px-2 sm:text-tiny md:px-3 md:text-small lg:px-4 transition',
                    isActive
                      ? 'text-white font-medium bg-rouge-500 shadow-soft'
                      : 'text-ink-500 hover:text-ink-900',
                  )
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {/* AI status */}
            <span
              className={cn(
                'hidden lg:inline-flex items-center gap-1.5 text-tiny',
                liveLLM ? 'text-moss-500' : 'text-ink-400',
              )}
              title={
                liveLLM && liveOcr
                  ? `${llmProvider} + OCR.space 都已配置`
                  : liveLLM
                    ? `${llmProvider} 已配置 · OCR 未配置`
                    : '本地确定性逻辑（未连接 LLM）'
              }
            >
              <span
                className={cn(
                  'w-1.5 h-1.5 rounded-full',
                  liveLLM ? 'bg-moss-500 animate-pulse' : 'bg-ink-300',
                )}
              />
              <span className="hidden xl:inline">
                {liveLLM && liveOcr ? 'AI · OCR' : liveLLM ? 'AI' : '离线'}
              </span>
            </span>

            <NotificationBell />
            <UserSwitcher />

            <Link to="/settings" className="text-ink-500 hover:text-rouge-600 rounded-full p-2 hover:bg-paper-100" aria-label="设置">
              <SettingsIcon size={16} />
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 min-w-0">
        <Outlet />
      </main>

      <footer className="border-t border-paper-200 py-7 mt-12 bg-paper-50/60">
        <div className="max-w-6xl mx-auto px-8 lg:px-12 flex flex-wrap gap-3 items-center justify-between text-tiny text-ink-500">
          <span className="inline-flex items-center gap-2">
            <Logo size={16} />
            欧哈娜 · 把牵挂轻轻放在一起
          </span>
          <span className="flex items-center gap-4">
            <Link to="/pitch" className="hover:text-rouge-600 inline-flex items-center gap-1">
              <Sparkles size={11} />
              介绍
            </Link>
            <Link to="/settings" className="hover:text-rouge-600">
              设置
            </Link>
          </span>
        </div>
      </footer>
    </div>
  )
}
