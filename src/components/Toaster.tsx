import { useAppStore } from '@/lib/store'
import { CheckCircle2, X, Info, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Toaster() {
  const toasts = useAppStore((s) => s.toasts)
  const removeToast = useAppStore((s) => s.removeToast)

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            'bg-ink-900 text-paper border-l-2 px-4 py-3 shadow-modal flex items-start gap-3 animate-fade-up',
            t.tone === 'success' && 'border-moss-400',
            t.tone === 'warn' && 'border-rouge-500',
            t.tone === 'info' && 'border-paper/30',
          )}
        >
          <span className="mt-0.5">
            {t.tone === 'success' && <CheckCircle2 size={14} className="text-moss-400" />}
            {t.tone === 'warn' && <AlertTriangle size={14} className="text-rouge-500" />}
            {t.tone === 'info' && <Info size={14} className="text-paper/70" />}
          </span>
          <div className="flex-1 text-small leading-snug">{t.message}</div>
          <button
            onClick={() => removeToast(t.id)}
            className="text-paper/60 hover:text-paper -mt-0.5"
            aria-label="关闭"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
