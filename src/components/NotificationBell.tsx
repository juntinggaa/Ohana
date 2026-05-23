import { useState, useRef, useEffect, useMemo } from 'react'
import { Bell, Check } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'

const KIND_LABEL: Record<string, string> = {
  assignment: '新指派',
  accepted: '被承接',
  rejected: '被拒绝',
  snoozed: '推迟回复',
  completed: '已完成',
  nudge: '催办',
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Read raw arrays / primitives only — never use selectors that filter inside
  // zustand. Filtering during render in the component body is safe.
  const allNotifications = useAppStore((s) => s.notifications)
  const currentUserId = useAppStore((s) => s.currentUserId)
  const markRead = useAppStore((s) => s.markNotificationRead)
  const markAllRead = useAppStore((s) => s.markAllNotificationsRead)

  const notifications = useMemo(
    () => allNotifications.filter((n) => n.recipientId === currentUserId),
    [allNotifications, currentUserId],
  )
  const unread = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  )

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative text-ink-500 hover:text-ink-900 p-1.5"
        aria-label="通知"
      >
        <Bell size={16} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 grid place-items-center text-[10px] font-medium bg-rouge-500 text-paper rounded-full leading-none">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-[360px] max-w-[90vw] bg-paper border border-ink-200 shadow-card z-50 animate-fade-in">
          <div className="px-4 py-3 border-b border-ink-100 flex items-center justify-between">
            <div className="eyebrow">通知</div>
            {unread > 0 && (
              <button
                className="text-tiny text-ink-500 hover:text-ink-900 inline-flex items-center gap-1"
                onClick={() => markAllRead(currentUserId)}
              >
                <Check size={10} />
                全部标记已读
              </button>
            )}
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <li className="px-4 py-10 text-center text-small text-ink-500">
                还没有通知
              </li>
            ) : (
              notifications.map((n) => (
                <li
                  key={n.id}
                  className={cn(
                    'px-4 py-3 border-b border-ink-100 transition cursor-pointer',
                    !n.read ? 'bg-paper-50 hover:bg-paper-100' : 'hover:bg-paper-50',
                  )}
                  onClick={() => markRead(n.id)}
                >
                  <div className="flex items-baseline gap-2">
                    <span
                      className={cn(
                        'eyebrow',
                        n.kind === 'rejected' && 'text-rouge-500',
                        n.kind === 'accepted' && 'text-moss-500',
                      )}
                    >
                      {KIND_LABEL[n.kind] ?? n.kind}
                    </span>
                    {!n.read && (
                      <span className="w-1.5 h-1.5 rounded-full bg-rouge-500 shrink-0" />
                    )}
                  </div>
                  <div className="text-small text-ink-800 mt-1 leading-relaxed">
                    {n.message}
                  </div>
                  <div className="text-micro text-ink-400 mt-1">
                    {formatRelative(n.at)}
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

function formatRelative(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  return `${Math.floor(diff / 86_400_000)} 天前`
}
