import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

/**
 * 产品风的页头 —— 标题 + 一句话功能描述 + 主要 action。
 * 不再有 italic 衬线 kicker，那种调子留给 Pitch Mode。
 */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string
  description?: string
  actions?: ReactNode
  className?: string
}) {
  return (
    <header
      className={cn(
        'max-w-6xl mx-auto px-8 lg:px-12 pt-10 pb-6',
        className,
      )}
    >
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="font-serif text-h2 text-ink-900 leading-tight">{title}</h1>
          {description && (
            <p className="mt-2 text-small text-ink-500 leading-relaxed">{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </header>
  )
}
