import { useMemo, useState } from 'react'
import type { WeeklyMentalLoadSnapshot } from '@/lib/types'
import { getMember } from '@/lib/mockData'
import { Avatar } from './Avatar'
import { cn, formatPercent } from '@/lib/utils'

interface Props {
  before: WeeklyMentalLoadSnapshot
  after: WeeklyMentalLoadSnapshot
  initialView?: 'before' | 'after'
  /** 隐藏标题/切换，作为嵌入式只显示条形图时用 */
  bare?: boolean
}

/**
 * Mental load · 心力分布
 *
 * 不做排行 / 不做评分。
 * 只是把家里这阵子"谁在想到、追问、核对、兜底"摊开来给大家看。
 */
export function MentalLoadDashboard({ before, after, initialView = 'before', bare }: Props) {
  const [view, setView] = useState<'before' | 'after'>(initialView)
  const current = view === 'before' ? before : after
  const max = useMemo(
    () => Math.max(...current.entries.map((e) => e.score), 1),
    [current],
  )

  // 找出最辛苦的人（百分比最高），用一句温和的话描述
  const heaviest = useMemo(() => {
    const sorted = [...current.entries]
      .filter((e) => e.score > 0)
      .sort((a, b) => b.percentage - a.percentage)
    return sorted[0]
  }, [current])
  const heaviestMember = heaviest ? getMember(heaviest.memberId) : undefined

  return (
    <div className="space-y-8">
      {!bare && heaviestMember && (
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div className="max-w-xl">
            <div className="eyebrow mb-3">这一段时间</div>
            <p className="font-serif text-lead text-ink-900 leading-snug">
              {view === 'before'
                ? `${heaviestMember.name} 处理了较多提醒和跟进事项。`
                : `${heaviestMember.name} 的事项已经被分担一部分到其他家人。`}
            </p>
            <p className="mt-2 text-small text-ink-600 leading-relaxed">
              {view === 'before'
                ? '看看下面的分布，方便商量谁可以多接一些。'
                : '剩下的部分，可以继续在家里轻轻商量。'}
            </p>
          </div>
          <div className="inline-flex border border-ink-300">
            <button
              className={cn(
                'px-4 py-2 text-tiny transition',
                view === 'before'
                  ? 'bg-ink-900 text-paper'
                  : 'text-ink-600 hover:text-ink-900',
              )}
              onClick={() => setView('before')}
            >
              本周
            </button>
            <button
              className={cn(
                'px-4 py-2 text-tiny transition',
                view === 'after'
                  ? 'bg-ink-900 text-paper'
                  : 'text-ink-600 hover:text-ink-900',
              )}
              onClick={() => setView('after')}
            >
              分担之后
            </button>
          </div>
        </div>
      )}

      <div className="space-y-5">
        {current.entries
          .filter((e) => e.score > 0)
          .sort((a, b) => b.score - a.score)
          .map((e, idx) => {
            const m = getMember(e.memberId)
            if (!m) return null
            const width = (e.score / max) * 100
            const isHeaviest = e.memberId === heaviest?.memberId
            return (
              <div
                key={`${view}-${e.memberId}`}
                className="grid grid-cols-[120px_1fr_56px] items-center gap-4 animate-fade-up"
                style={{ animationDelay: `${idx * 60}ms` }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Avatar member={m} size={22} />
                  <div className="min-w-0">
                    <div className="text-small text-ink-900 truncate">{m.name}</div>
                    <div className="text-micro text-ink-500 truncate">{m.relation}</div>
                  </div>
                </div>
                <div className="h-[3px] bg-ink-100 overflow-hidden origin-left">
                  <div
                    className={cn(
                      'h-full origin-left animate-bar-fill',
                      isHeaviest ? 'bg-rouge-500' : 'bg-ink-700',
                    )}
                    style={{ width: `${width}%` }}
                  />
                </div>
                <div className="num text-small text-ink-900 text-right">
                  {formatPercent(e.percentage)}
                </div>
              </div>
            )
          })}
      </div>

      {!bare && (
        <div className="text-tiny text-ink-500 leading-relaxed pt-6 border-t border-ink-200 max-w-2xl">
          心力 = 想到 × 3 + 追问 × 2 + 核对 × 2 + 兜底 × 4 + 执行 × 1。
          兜底的权重最高，因为它是最容易看不到、却最磨人的那部分。
        </div>
      )}
    </div>
  )
}
