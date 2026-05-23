import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

export function PageHeader({
  eyebrow,
  title,
  kicker,
  actions,
  className,
}: {
  eyebrow?: string
  title: string
  /** 一行极短的副标题。比 description 短得多 —— 通常 ≤ 24 个汉字 */
  kicker?: string
  actions?: ReactNode
  className?: string
}) {
  return (
    <header
      className={cn(
        'max-w-6xl mx-auto px-8 lg:px-12 pt-16 pb-10',
        className,
      )}
    >
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
        <div className="max-w-3xl">
          {eyebrow && <div className="eyebrow mb-4">{eyebrow}</div>}
          <h1 className="display-serif text-h1 md:text-h1 leading-tight animate-fade-up">
            {title}
          </h1>
          {kicker && (
            <p className="mt-4 text-lead text-ink-600 font-serif italic max-w-2xl">{kicker}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </header>
  )
}
