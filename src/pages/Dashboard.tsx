/**
 * /overview · 家庭总览
 *
 * 所有家人都看得到的一页。
 * 不强调"协调者"，也不把谁的心智负担当成头条数字。
 * 重点放在：
 *   - 家里这周的重要事项
 *   - 哪些事情还没人接住
 *   - 心力分布（温和，不是排行）
 *   - 下周可以怎么分担（来自 CareBalancePanel）
 */

import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Inbox as InboxIcon, AlertTriangle } from 'lucide-react'
import { useMemo, useState } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { MentalLoadDashboard } from '@/components/MentalLoadDashboard'
import { CareBalancePanel } from '@/components/CareBalancePanel'
import { TaskCard } from '@/components/TaskCard'
import { TaskDetailModal } from '@/components/TaskDetailModal'
import { OriginatorLabel } from '@/components/OriginatorLabel'
import { useAppStore } from '@/lib/store'
import { Stat } from '@/components/Stat'
import { useUiMode } from '@/lib/useUiMode'
import type { CareTask } from '@/lib/types'
import { dueDateRank } from '@/lib/utils'

/**
 * "还没人接住" · 任何尚未被某人正式承接的事
 *   - detected: AI 刚识别还没分配
 *   - needs_owner: 没人被指派
 *   - fallback_risk: 又回到同一个人（保留以防万一）
 *   - pending_acceptance: 已被指派但还没人点"我接手"
 */
function isUnassigned(t: CareTask): boolean {
  return (
    t.status === 'detected' ||
    t.status === 'needs_owner' ||
    t.status === 'fallback_risk' ||
    t.status === 'pending_acceptance'
  )
}

/**
 * "家里这周的重要事项" · 已经在做、临近截止的事
 *   只挑已承接 / 进行中 / 等证明 —— 跟"还没人接住"完全不重合
 */
function isImportantThisWeek(t: CareTask): boolean {
  if (
    t.status !== 'accepted' &&
    t.status !== 'in_progress' &&
    t.status !== 'needs_proof'
  ) {
    return false
  }
  return /(今天|明天|周一|本周|今晚)/.test(t.dueDateText ?? '')
}

export function DashboardPage() {
  const tasks = useAppStore((s) => s.tasks)
  const accepted = useAppStore((s) => s.accepted)
  const mentalLoadBefore = useAppStore((s) => s.mentalLoadBefore)
  const mentalLoadAfter = useAppStore((s) => s.mentalLoadAfter)
  const mode = useUiMode()
  const [active, setActive] = useState<CareTask | null>(null)

  const acceptedCount = Object.keys(accepted).length

  // ── 数据切片 · 按截止日期排序，最近的在最上 ──────────────
  const importantThisWeek = useMemo(
    () =>
      tasks
        .filter(isImportantThisWeek)
        .slice()
        .sort((a, b) => dueDateRank(a.dueDate) - dueDateRank(b.dueDate)),
    [tasks],
  )
  const unassignedAll = useMemo(
    () =>
      tasks
        .filter(isUnassigned)
        .slice()
        .sort((a, b) => dueDateRank(a.dueDate) - dueDateRank(b.dueDate)),
    [tasks],
  )
  // 与「全部事项」保持一致 · 不再截断
  const importantSoon = importantThisWeek
  const unassigned = unassignedAll

  const activeFromStore = active ? tasks.find((t) => t.id === active.id) ?? null : null

  if (tasks.length === 0) {
    return <EmptyOverview />
  }

  return (
    <>
      <PageHeader
        title="家庭总览"
        description="家里这周的状态 · 所有家人都看得到"
        actions={
          mode !== 'elder' ? (
            <Link to="/memory?mode=paste" className="btn-primary">
              <InboxIcon size={14} />
              粘新聊天分析
            </Link>
          ) : undefined
        }
      />

      {/* 头条数字 · 与下面 section 数量一致 */}
      <section className="max-w-6xl mx-auto px-8 lg:px-12 pb-12">
        <div className="border-t border-ink-200 pt-8 grid grid-cols-2 gap-6 md:gap-10 max-w-md">
          <Stat label="家里重要事项" value={importantThisWeek.length} />
          <Stat
            label="还没人接住"
            value={unassignedAll.length}
            tone={unassignedAll.length > 0 ? 'rouge' : 'default'}
          />
        </div>
      </section>

      {/* 家里这周的重要事项 · 一行一条，按日期排序 */}
      {importantSoon.length > 0 && (
        <section className="max-w-6xl mx-auto px-8 lg:px-12 pb-12">
          <div className="flex items-baseline justify-between mb-5">
            <h2 className="font-serif text-h3 text-ink-900">家里这周的重要事项</h2>
            <Link
              to="/me?view=all"
              className="text-tiny text-ink-500 hover:text-ink-900 inline-flex items-center gap-1"
            >
              打开全部任务
              <ArrowRight size={11} />
            </Link>
          </div>
          <div className="space-y-3">
            {importantSoon.map((t) => (
              <TaskCard key={t.id} task={t} onClick={() => setActive(t)} />
            ))}
          </div>
        </section>
      )}

      {/* 哪些事情还没人接住 */}
      {unassigned.length > 0 && (
        <section className="max-w-6xl mx-auto px-8 lg:px-12 pb-12">
          <div className="flex items-baseline justify-between mb-5">
            <h2 className="font-serif text-h3 text-ink-900 inline-flex items-center gap-2">
              <AlertTriangle size={16} className="text-rouge-500" />
              哪些事情还没人接住
            </h2>
            <span className="text-tiny text-ink-500">{unassigned.length} 件</span>
          </div>
          <ul className="space-y-3">
            {unassigned.map((t) => (
              <li
                key={t.id}
                className="border-l-2 border-rouge-200 bg-paper-50 px-5 py-4 flex items-start justify-between gap-4 flex-wrap"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-serif text-body text-ink-900">{t.title}</div>
                  <div className="text-tiny text-ink-500 mt-1 flex items-center gap-2 flex-wrap">
                    <OriginatorLabel
                      id={t.originatorId}
                      label={t.originatorLabel}
                      size="xs"
                    />
                    {t.dueDateText && <span>· 截止 {t.dueDateText}</span>}
                  </div>
                </div>
                <button
                  onClick={() => setActive(t)}
                  className="btn-outline text-tiny shrink-0"
                >
                  看看怎么分
                  <ArrowRight size={11} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 心力分布 + 下周可以怎么分担 */}
      <section className="border-t border-ink-200 bg-paper-100">
        <div className="max-w-6xl mx-auto px-8 lg:px-12 py-12 space-y-12">
          <div>
            <div className="flex items-end justify-between gap-6 mb-6 flex-wrap">
              <div>
                <h2 className="font-serif text-h2 text-ink-900 leading-tight">心力分布</h2>
                <p className="mt-2 text-small text-ink-600 max-w-xl leading-relaxed">
                  谁这一阵在"想到、追问、核对、兜底"。不是排行 —— 是给家里看，方便商量下周怎么分担。
                </p>
              </div>
            </div>
            <MentalLoadDashboard
              before={{ label: '本周', entries: mentalLoadBefore }}
              after={{
                label: acceptedCount > 0 ? `已分担 ${acceptedCount} 条后` : '若按建议分担',
                entries: mentalLoadAfter,
              }}
              initialView={acceptedCount > 0 ? 'after' : 'before'}
            />
          </div>

          <div className="border-t border-ink-200 pt-10">
            <CareBalancePanel />
          </div>
        </div>
      </section>

      <TaskDetailModal task={activeFromStore} onClose={() => setActive(null)} />
    </>
  )
}

function EmptyOverview() {
  const resetToSampleData = useAppStore((s) => s.resetToSampleData)
  const navigate = useNavigate()

  function openSampleInbox() {
    resetToSampleData()
    navigate('/memory?mode=paste')
  }

  return (
    <>
      <PageHeader title="家庭总览" description="家里这周还很安静。" />
      <section className="max-w-6xl mx-auto px-8 lg:px-12 pb-20">
        <div className="border-t border-ink-200 pt-16 text-center max-w-md mx-auto">
          <p className="font-serif text-lead text-ink-500 mb-8">
            现在还没有任务。先把聊天交给 AI，任务会从消息里识别出来。
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link to="/memory?mode=paste" className="btn-primary">
              <InboxIcon size={14} />
              粘段群聊给 AI
            </Link>
            <button className="btn-outline" onClick={openSampleInbox}>
              唐宁家示例消息
            </button>
          </div>
        </div>
      </section>
    </>
  )
}
