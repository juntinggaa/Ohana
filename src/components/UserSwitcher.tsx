import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { Avatar } from './Avatar'
import { cn } from '@/lib/utils'

/**
 * 用户身份切换器 · 演示用 mock-multi-user
 * 切换后，所有"为我"的视图（任务、通知、accept/reject 按钮）都跟着变。
 */
export function UserSwitcher() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const members = useAppStore((s) => s.familyMembers)
  const currentUserId = useAppStore((s) => s.currentUserId)
  const setCurrentUser = useAppStore((s) => s.setCurrentUser)
  const pushToast = useAppStore((s) => s.pushToast)

  const current = members.find((m) => m.id === currentUserId) ?? members[0]

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  if (!current) return null

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'inline-flex items-center gap-2 px-2.5 py-1.5 rounded-full border transition bg-paper-50',
          open
            ? 'border-ink-700 bg-paper-100'
            : 'border-ink-200 hover:border-ink-400',
        )}
        aria-label="切换查看身份"
      >
        <Avatar member={current} size={20} />
        <span className="text-tiny font-medium text-ink-900">{current.name}</span>
        <span className="text-tiny text-ink-400 hidden md:inline">的身份</span>
        <ChevronDown size={12} className="text-ink-400" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 min-w-[240px] bg-paper-50 rounded-2xl overflow-hidden border border-paper-200 shadow-card z-50 animate-fade-in">
          <div className="px-3 py-3 border-b border-paper-200">
            <div className="eyebrow">现在听谁的近况</div>
            <div className="text-tiny text-ink-500 mt-1 leading-snug">
              切换后，会从这位家人的视角看到需要留意的事。
            </div>
          </div>
          <ul className="max-h-72 overflow-y-auto">
            {members.map((m) => {
              const isCurrent = m.id === current.id
              return (
                <li key={m.id}>
                  <button
                    onClick={() => {
                      setCurrentUser(m.id)
                      setOpen(false)
                      if (m.id !== current.id) {
                        pushToast(`现在你是 ${m.name}`, 'info')
                      }
                    }}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 text-left transition',
                      isCurrent ? 'bg-paper-100' : 'hover:bg-paper-50',
                    )}
                  >
                    <Avatar member={m} size={28} />
                    <div className="flex-1 min-w-0">
                      <div className="text-small font-medium text-ink-900 truncate">
                        {m.name}{' '}
                        <span className="text-tiny text-ink-400 font-normal">
                          · {m.relation}
                        </span>
                      </div>
                      {m.city && (
                        <div className="text-tiny text-ink-500 truncate">{m.city}</div>
                      )}
                    </div>
                    {isCurrent && (
                      <Check size={14} className="text-rouge-500 shrink-0" />
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
