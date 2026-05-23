import { cn } from '@/lib/utils'

/**
 * Editorial-style mini stat. 没有大边框，没有图标，没有阴影。
 * 只是：眉头 · 大数字 · 一行细字。像新闻稿里数据小框。
 */
export function StatCard({
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
    <div className="py-2">
      <div className="eyebrow">{label}</div>
      <div
        className={cn(
          'num text-h2 mt-2 leading-none',
          tone === 'rouge' && 'text-rouge-500',
          tone === 'moss' && 'text-moss-500',
          tone === 'default' && 'text-ink-900',
        )}
      >
        {value}
      </div>
      {hint && <div className="text-tiny text-ink-500 mt-1.5 leading-snug">{hint}</div>}
    </div>
  )
}
