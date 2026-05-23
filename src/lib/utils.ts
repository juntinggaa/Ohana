import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPercent(n: number, digits = 0) {
  return `${(n * 100).toFixed(digits)}%`
}

const WEEKDAY_ZH = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

/**
 * "5月25日 · 周一" / "今天 · 5月23日 周六" / "已逾期 2 天 · 5月21日 周四"
 */
export function formatDueDate(iso?: string): string | null {
  if (!iso) return null
  const date = new Date(iso + 'T00:00:00')
  if (Number.isNaN(date.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dayMs = 86400_000
  const diffDays = Math.round((date.getTime() - today.getTime()) / dayMs)

  const md = `${date.getMonth() + 1}月${date.getDate()}日`
  const wd = WEEKDAY_ZH[date.getDay()]
  const tail = `${md} · ${wd}`

  if (diffDays < 0) return `已逾期 ${Math.abs(diffDays)} 天 · ${tail}`
  if (diffDays === 0) return `今天 · ${tail}`
  if (diffDays === 1) return `明天 · ${tail}`
  if (diffDays === 2) return `后天 · ${tail}`
  if (diffDays < 7) return `${diffDays} 天后 · ${tail}`
  return tail
}

/** 用来排序：把 ISO 日期转成 number；没有 dueDate 的排到最后 */
export function dueDateRank(iso?: string): number {
  if (!iso) return Number.POSITIVE_INFINITY
  const t = new Date(iso + 'T00:00:00').getTime()
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t
}
