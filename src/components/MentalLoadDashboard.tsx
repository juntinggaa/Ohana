import { useMemo, useState } from 'react'
import type { WeeklyMentalLoadSnapshot } from '@/lib/types'
import { Avatar } from './Avatar'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/lib/store'

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
  const members = useAppStore((s) => s.familyMembers)
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
  const heaviestMember = heaviest
    ? members.find((m) => m.id === heaviest.memberId)
    : undefined

  function gentleState(percentage: number): string {
    if (percentage >= 0.45) return '牵挂得比较多'
    if (percentage >= 0.2) return '正在帮着照应'
    return '偶尔搭把手'
  }

  return (
    <div className="space-y-8">
      {!bare && heaviestMember && (
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div className="max-w-xl">
            <div className="eyebrow mb-3">这一阵子</div>
            <p className="font-serif text-lead text-ink-900 leading-snug">
              {view === 'before'
                ? `${heaviestMember.name} 心里装着比较多家里的事。`
                : `${heaviestMember.name} 已经有人一起陪着分担了。`}
            </p>
            <p className="mt-2 text-small text-ink-600 leading-relaxed">
              {view === 'before'
                ? '看见这份惦记，也许就知道该先问候谁。'
                : '不用算得很清楚，只要别让一个人一直操心。'}
            </p>
          </div>
          <div className="segmented">
            <button
              className={cn(
                'segment',
                view === 'before'
                  ? 'segment-active'
                  : 'text-ink-600 hover:text-ink-900',
              )}
              onClick={() => setView('before')}
            >
              现在
            </button>
            <button
              className={cn(
                'segment',
                view === 'after'
                  ? 'segment-active'
                  : 'text-ink-600 hover:text-ink-900',
              )}
              onClick={() => setView('after')}
            >
              一起照应后
            </button>
          </div>
        </div>
      )}

      <div className="space-y-5">
        {current.entries
          .filter((e) => e.score > 0)
          .sort((a, b) => b.score - a.score)
          .map((e, idx) => {
            const m = members.find((member) => member.id === e.memberId)
            if (!m) return null
            const width = (e.score / max) * 100
            const isHeaviest = e.memberId === heaviest?.memberId
            return (
              <div
                key={`${view}-${e.memberId}`}
                className="grid grid-cols-[92px_1fr] sm:grid-cols-[120px_1fr_100px] items-center gap-x-3 gap-y-1 sm:gap-4 animate-fade-up"
                style={{ animationDelay: `${idx * 60}ms` }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Avatar member={m} size={22} />
                  <div className="min-w-0">
                    <div className="text-small text-ink-900 truncate">{m.name}</div>
                    <div className="text-micro text-ink-500 truncate">{m.relation}</div>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-paper-200 overflow-hidden origin-left">
                  <div
                    className={cn(
                      'h-full origin-left animate-bar-fill',
                      isHeaviest ? 'bg-rouge-400' : 'bg-moss-400',
                    )}
                    style={{ width: `${width}%` }}
                  />
                </div>
                <div className="col-start-2 sm:col-start-auto text-tiny text-ink-500 sm:text-right">
                  {gentleState(e.percentage)}
                </div>
              </div>
            )
          })}
      </div>

      {!bare && (
        <div className="text-small text-ink-500 pt-6 border-t border-paper-200">
          这里不是比较谁做得多，而是提醒家人：有人可能正需要一句问候，或一次主动的帮忙。
        </div>
      )}
    </div>
  )
}
