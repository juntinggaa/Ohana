import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/dashboard', label: '总览' },
  { to: '/inbox', label: '收件箱' },
  { to: '/tasks', label: '任务' },
  { to: '/mental-load', label: '心智负担' },
  { to: '/pitch', label: 'Pitch' },
]

export function Layout() {
  const { pathname } = useLocation()
  const isPitch = pathname.startsWith('/pitch')

  // Pitch mode 全屏沉浸 —— 没有外壳
  if (isPitch) {
    return (
      <div className="min-h-screen bg-ink-900 text-paper">
        <Outlet />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-ink-200 bg-paper sticky top-0 z-30 backdrop-blur-sm bg-paper/90">
        <div className="max-w-6xl mx-auto px-8 lg:px-12 h-16 flex items-center justify-between">
          {/* Wordmark */}
          <div className="flex items-baseline gap-3">
            <span className="font-serif text-h3 text-ink-900 leading-none">后台审计</span>
            <span className="eyebrow hidden md:inline">Backstage Audit</span>
          </div>
          {/* Nav */}
          <nav className="flex items-center gap-1">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  cn(
                    'px-3 py-2 text-small transition',
                    isActive
                      ? 'text-ink-900 font-medium underline underline-offset-[8px] decoration-rouge-500 decoration-2'
                      : 'text-ink-500 hover:text-ink-900',
                  )
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1 min-w-0">
        <Outlet />
      </main>

      <footer className="border-t border-ink-200 py-6">
        <div className="max-w-6xl mx-auto px-8 lg:px-12 flex items-center justify-between text-tiny text-ink-500">
          <span>故事五夜 · 第五夜 · 待办家事</span>
          <span>本地原型 · 未发送任何家庭群消息</span>
        </div>
      </footer>
    </div>
  )
}
