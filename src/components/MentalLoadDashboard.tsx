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

export function MentalLoadDashboard({ before, after, initialView = 'before', bare }: Props) {
  const [view, setView] = useState<'before' | 'after'>(initialView)
  const current = view === 'before' ? before : after
  const max = useMemo(
    () => Math.max(...current.entries.map((e) => e.score), 1),
    [current],
  )
  const tangning = current.entries.find((e) => e.memberId === 'tangning')!

  return (
    <div className="space-y-8">
      {!bare && (
        <div className="flex items-end justify-between gap-6">
          <div>
            <div className="eyebrow mb-3">本周心智负担分布</div>
            <div className="flex items-baseline gap-3">
              <span className="num text-display text-rouge-500 leading-none">
                {Math.round(tangning.percentage * 100)}
              </span>
              <span className="font-serif text-h3 text-ink-500">%</span>
            </div>
            <div className="mt-2 text-small text-ink-600 italic font-serif">
              {view === 'before'
                ? '唐宁一个人，扛着家里 84% 的"想到与安排"。'
                : '同样的一周，重新分配责任后，她的份额回到 30%。'}
            </div>
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
              使用前
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
              使用后
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
            const isTangning = e.memberId === 'tangning'
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
                      isTangning ? 'bg-rouge-500' : 'bg-ink-700',
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
          公式 · 心智负担 = 想到 × 3 + 追问 × 2 + 核对 × 2 + 兜底 × 4 + 执行 × 1。
          兜底权重最高，因为它是隐形劳动里最磨人的一种。
        </div>
      )}
    </div>
  )
}
