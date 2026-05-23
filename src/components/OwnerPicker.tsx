import { useState, useRef, useEffect } from 'react'
import { ChevronDown, X } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { Avatar } from './Avatar'
import { cn } from '@/lib/utils'

/**
 * 小巧的执行人选择器 —— 用在子任务行内
 * 没选时显示一个虚框 + "指派"，选了显示 avatar + 名字
 */
export function OwnerPicker({
  value,
  onChange,
  suggestedId,
  size = 'sm',
}: {
  value?: string
  onChange: (id: string | undefined) => void
  /** AI / 模板推荐的人，用斜体小字表示 */
  suggestedId?: string
  size?: 'sm' | 'md'
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const members = useAppStore((s) => s.familyMembers)
  const current = members.find((m) => m.id === value)
  const suggested = members.find((m) => m.id === suggestedId)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const px = size === 'md' ? 22 : 18

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'inline-flex items-center gap-1.5 px-1.5 py-0.5 border transition text-tiny',
          current
            ? 'border-ink-200 bg-paper hover:border-ink-500'
            : 'border-dashed border-ink-300 text-ink-500 hover:border-ink-500',
        )}
      >
        {current ? (
          <>
            <Avatar member={current} size={px} />
            <span className="text-ink-700">{current.name}</span>
          </>
        ) : suggested ? (
          <>
            <Avatar member={suggested} size={px} className="opacity-50" />
            <span className="italic text-ink-400">建议 {suggested.name}</span>
          </>
        ) : (
          <span className="px-1">+ 指派</span>
        )}
        <ChevronDown size={10} className="text-ink-400" />
      </button>

      {open && (
        <div className="absolute right-0 mt-1 min-w-[180px] bg-paper border border-ink-200 shadow-card z-50 animate-fade-in">
          <ul className="max-h-64 overflow-y-auto">
            {members.map((m) => {
              const isSuggested = m.id === suggestedId
              const isCurrent = m.id === value
              return (
                <li key={m.id}>
                  <button
                    onClick={() => {
                      onChange(m.id)
                      setOpen(false)
                    }}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-2 text-left text-small transition',
                      isCurrent ? 'bg-paper-100' : 'hover:bg-paper-50',
                    )}
                  >
                    <Avatar member={m} size={20} />
                    <span className="flex-1 text-ink-900">{m.name}</span>
                    {isSuggested && (
                      <span className="text-micro text-ink-400 italic">AI 建议</span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
          {value && (
            <button
              onClick={() => {
                onChange(undefined)
                setOpen(false)
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-tiny text-ink-500 hover:bg-paper-50 border-t border-ink-100"
            >
              <X size={10} />
              清空指派
            </button>
          )}
        </div>
      )}
    </div>
  )
}
