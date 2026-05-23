import { cn } from '@/lib/utils'

export function Stat({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string
  value: string | number
  hint?: string
  tone?: 'default' | 'rouge' | 'moss'
}) {
  return (
    <div>
      <div className="eyebrow mb-2">{label}</div>
      <div
        className={cn(
          'num text-h1 leading-none',
          tone === 'rouge' && 'text-rouge-500',
          tone === 'moss' && 'text-moss-500',
          tone === 'default' && 'text-ink-900',
        )}
      >
        {value}
      </div>
      {hint && <div className="text-tiny text-ink-500 mt-2 leading-snug">{hint}</div>}
    </div>
  )
}
