import { NavLink, Outlet, useLocation, Link } from 'react-router-dom'
import { Sparkles, Settings as SettingsIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { hasDeepSeekKey } from '@/lib/llm/llmClient'
import { hasMistralKey } from '@/lib/ocr/mistralOcr'
import { UserSwitcher } from './UserSwitcher'
import { NotificationBell } from './NotificationBell'
import { ModeToggle } from './ModeToggle'
import { Logo } from './Logo'
import { useUiMode } from '@/lib/useUiMode'

// 三个主视图 · 所有家人都能看到
const NAV_PRIMARY = [
  { to: '/me',       label: '事项' },
  { to: '/overview', label: '家庭总览' },
  { to: '/memory',   label: '家庭记忆' },
]

const NAV_SECONDARY = [
  { to: '/family', label: '家人' },
]

// 老人版 · 三个简单入口
const NAV_ELDER = [
  { to: '/me',     label: '今天' },
  { to: '/memory', label: '告诉 AI' },
  { to: '/family', label: '家人' },
]

export function Layout() {
  const { pathname } = useLocation()
  const isPitch = pathname.startsWith('/pitch')
  const isWelcome = pathname.startsWith('/welcome')
  const liveLLM = hasDeepSeekKey()
  const liveOcr = hasMistralKey()
  const mode = useUiMode()
  const isElder = mode === 'elder'
  const NAV = isElder ? NAV_ELDER : [...NAV_PRIMARY, ...NAV_SECONDARY]

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
    <div
      className={cn(
        'min-h-screen flex flex-col',
        // 老人版 · 整站字号放大约 1 级
        isElder && 'text-[17px] leading-relaxed',
      )}
    >
      <header className="border-b border-ink-200 bg-paper sticky top-0 z-30 backdrop-blur-sm bg-paper/95">
        <div className="max-w-6xl mx-auto px-6 lg:px-12 h-16 flex items-center justify-between gap-4">
          <Link to="/me" className="group shrink-0">
            <Logo withWordmark size={22} />
          </Link>

          <nav className="flex items-center gap-1">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  cn(
                    'px-2.5 lg:px-3 py-2 text-small transition',
                    isActive
                      ? 'text-ink-900 font-medium underline underline-offset-[10px] decoration-rouge-500 decoration-2'
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
                'inline-flex items-center gap-1.5 text-tiny',
                liveLLM ? 'text-moss-500' : 'text-ink-400',
              )}
              title={
                liveLLM && liveOcr
                  ? 'DeepSeek + Mistral OCR 都已连接'
                  : liveLLM
                    ? 'DeepSeek 已连接 · OCR 未配置'
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
            <ModeToggle />
            <UserSwitcher />

            <Link
              to="/pitch"
              className="text-tiny text-ink-500 hover:text-ink-900 inline-flex items-center gap-1.5 ml-1 px-2 py-1"
              title="演讲模式 · 给评委用"
            >
              <Sparkles size={12} />
            </Link>
            <Link to="/settings" className="text-ink-500 hover:text-ink-900 p-1" aria-label="设置">
              <SettingsIcon size={16} />
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 min-w-0">
        <Outlet />
      </main>

      <footer className="border-t border-ink-200 py-6 mt-12">
        <div className="max-w-6xl mx-auto px-8 lg:px-12 flex items-center justify-between text-tiny text-ink-500">
          <span className="inline-flex items-center gap-2">
            <Logo size={12} />
            欧哈娜 · Ohana · 黑客松原型
          </span>
          <Link to="/settings" className="hover:text-ink-900">
            重置数据 / 切换身份 / 设置
          </Link>
        </div>
      </footer>
    </div>
  )
}
