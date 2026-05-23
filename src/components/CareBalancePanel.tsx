/**
 * Care Balance Panel
 *
 * 家庭总览里温和的一段：
 *   - 本周谁最近比较辛苦（不是排行 / 不是评分）
 *   - 下周可以怎么分担
 *
 * 完全从现有数据派生（tasks + mentalLoadBefore + traits），不需要额外字段。
 */

import { useMemo } from 'react'
import { Sparkles } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { Avatar } from './Avatar'
import { MemberPill } from './MemberPill'
import { recommendOwner } from '@/lib/agents/assignmentAgent'
import { cn } from '@/lib/utils'

/** 把一个人的"心力"用一句温和的话描述出来，而不是百分比 */
function describeLoad(percentage: number): { label: string; tone: 'busy' | 'ok' | 'rest' } {
  if (percentage >= 0.45) return { label: '最近比较辛苦', tone: 'busy' }
  if (percentage >= 0.2) return { label: '在帮忙一些事', tone: 'ok' }
  return { label: '本周比较空', tone: 'rest' }
}

export function CareBalancePanel() {
  const tasks = useAppStore((s) => s.tasks)
  const members = useAppStore((s) => s.familyMembers)
  const load = useAppStore((s) => s.mentalLoadBefore)
  const pushToast = useAppStore((s) => s.pushToast)

  // 找出本周最辛苦的人
  const sortedLoad = useMemo(
    () => [...load].sort((a, b) => b.percentage - a.percentage),
    [load],
  )
  const heaviestId = sortedLoad[0]?.memberId

  // 还没人接住的任务 → 给"下周可以试着分担"用
  const unassigned = useMemo(
    () =>
      tasks.filter(
        (t) =>
          t.status !== 'completed' &&
          t.status !== 'accepted' &&
          (t.status === 'needs_owner' ||
            t.status === 'fallback_risk' ||
            t.status === 'pending_acceptance'),
      ),
    [tasks],
  )

  // 给每条未接住的任务生成一个温和的转交建议：
  //   "下周可以试着把 X 交给 Y"
  const suggestions = useMemo(() => {
    return unassigned
      .map((t) => {
        const reco = recommendOwner({ category: t.category, title: t.title }, members)
        if (!reco) return null
        const ownerNow = members.find(
          (m) => m.id === (t.executorId ?? t.suggestedOwnerId ?? heaviestId),
        )
        const recoMember = members.find((m) => m.id === reco.ownerId)
        if (!recoMember) return null
        // 已经匹配到推荐人 → 跳过
        if (recoMember.id === ownerNow?.id) return null
        return {
          taskId: t.id,
          taskTitle: t.title,
          fromName: ownerNow?.name,
          toMemberId: recoMember.id,
          toName: recoMember.name,
          reason: reco.reason,
        }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .slice(0, 3)
  }, [unassigned, members, heaviestId])

  function handleAccept(s: NonNullable<(typeof suggestions)[number]>) {
    pushToast(`已记下：下周把「${s.taskTitle}」试着交给 ${s.toName}`, 'success')
  }

  return (
    <div className="space-y-8">
      {/* 谁最近比较辛苦 */}
      <div>
        <div className="eyebrow mb-4 inline-flex items-center gap-1.5">
          <Sparkles size={11} />
          谁最近比较辛苦
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedLoad
            .filter((e) => e.score > 0)
            .slice(0, 6)
            .map((e) => {
              const m = members.find((mm) => mm.id === e.memberId)
              if (!m) return null
              const d = describeLoad(e.percentage)
              return (
                <div
                  key={e.memberId}
                  className={cn(
                    'border-l-2 bg-paper-50 px-4 py-3',
                    d.tone === 'busy'
                      ? 'border-rouge-500'
                      : d.tone === 'ok'
                        ? 'border-ink-300'
                        : 'border-moss-500',
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Avatar member={m} size={22} />
                    <div className="text-small font-medium text-ink-900">
                      {m.name}
                      <span className="text-tiny text-ink-400 font-normal ml-1.5">
                        · {m.relation}
                      </span>
                    </div>
                  </div>
                  <div className="text-tiny text-ink-600">{d.label}</div>
                  {d.tone === 'busy' && (
                    <div className="text-tiny text-ink-500 mt-1 leading-snug">
                      处理了较多提醒和跟进。
                    </div>
                  )}
                </div>
              )
            })}
        </div>
      </div>

      {/* 下周可以怎么分担 */}
      {suggestions.length > 0 && (
        <div>
          <div className="eyebrow mb-4">下周可以怎么分担</div>
          <ul className="space-y-3">
            {suggestions.map((s) => (
              <li
                key={s.taskId}
                className="border border-ink-200 bg-paper px-4 py-3 flex items-start gap-3 flex-wrap"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-body text-ink-800 leading-relaxed">
                    下周可以试着把
                    <span className="font-medium text-ink-900"> {s.taskTitle} </span>
                    交给
                    <span className="inline-flex items-center gap-1.5 mx-1 align-middle">
                      <MemberPill id={s.toMemberId} size="xs" />
                    </span>
                    。
                  </p>
                  <p className="text-tiny text-ink-500 mt-1.5 leading-snug">{s.reason}</p>
                </div>
                <button
                  onClick={() => handleAccept(s)}
                  className="btn-outline text-tiny shrink-0"
                >
                  记下来
                </button>
              </li>
            ))}
          </ul>
          <p className="text-tiny text-ink-500 mt-3">
            这些是温和的建议 · 没有强制的指派，谁不方便都可以换。
          </p>
        </div>
      )}
    </div>
  )
}
