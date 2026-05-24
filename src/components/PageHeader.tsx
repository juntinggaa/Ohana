import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

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
        'max-w-6xl mx-auto px-6 lg:px-12 pt-10 md:pt-12 pb-7',
        className,
      )}
    >
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="font-serif text-h2 md:text-h1 text-ink-900 leading-tight">{title}</h1>
          {description && (
            <p className="mt-3 text-body text-ink-600 leading-relaxed">{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </header>
  )
}
