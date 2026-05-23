import { ChevronDown, Check } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'

const OPTIONS: { id: 'auto' | 'standard' | 'elder'; label: string; hint: string }[] = [
  { id: 'auto',     label: '自动',     hint: '按当前身份自动切换 · 老人成员会自动进老人版' },
  { id: 'standard', label: '标准',     hint: '家人通用 · 完整的事项、家庭总览、记忆助手' },
  { id: 'elder',    label: '老人版',   hint: '大字 · 大按钮 · 只剩"今天要做"和"拍照上传"' },
]

export function ModeToggle() {
  const override = useAppStore((s) => s.uiModeOverride)
  const setOverride = useAppStore((s) => s.setUiModeOverride)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const current = OPTIONS.find((o) => o.id === override) ?? OPTIONS[0]

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'inline-flex items-center gap-1.5 px-2 py-1 border transition text-tiny',
          open ? 'border-ink-700 bg-paper-100' : 'border-ink-200 hover:border-ink-400',
        )}
        aria-label="切换界面模式"
        title="界面模式"
      >
        <span className="text-eyebrow uppercase tracking-widest text-ink-400 hidden lg:inline">
          模式
        </span>
        <span className="text-ink-900 font-medium">{current.label}</span>
        <ChevronDown size={12} className="text-ink-400" />
      </button>

      {open && (
        <div className="absolute right-0 mt-1 min-w-[260px] bg-paper border border-ink-200 shadow-card z-50 animate-fade-in">
          <div className="px-3 py-2 border-b border-ink-100">
            <div className="eyebrow">界面模式</div>
            <div className="text-tiny text-ink-500 mt-1 leading-snug">
              不是身份等级 · 老人版只是字大一点、选项少一点。
            </div>
          </div>
          <ul>
            {OPTIONS.map((o) => {
              const isCur = o.id === override
              return (
                <li key={o.id}>
                  <button
                    onClick={() => {
                      setOverride(o.id)
                      setOpen(false)
                    }}
                    className={cn(
                      'w-full text-left px-3 py-2.5 flex items-start gap-3 transition',
                      isCur ? 'bg-paper-100' : 'hover:bg-paper-50',
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-small font-medium text-ink-900">{o.label}</div>
                      <div className="text-tiny text-ink-500 mt-0.5 leading-snug">{o.hint}</div>
                    </div>
                    {isCur && <Check size={14} className="text-rouge-500 shrink-0 mt-0.5" />}
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
