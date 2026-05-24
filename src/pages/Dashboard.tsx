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
import { ArrowRight, Inbox as InboxIcon, Heart, MessageCircle, Sun } from 'lucide-react'
import { useMemo, useState } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { MentalLoadDashboard } from '@/components/MentalLoadDashboard'
import { CareBalancePanel } from '@/components/CareBalancePanel'
import { TaskCard } from '@/components/TaskCard'
import { TaskDetailModal } from '@/components/TaskDetailModal'
import { OriginatorLabel } from '@/components/OriginatorLabel'
import { useAppStore } from '@/lib/store'
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
        title="我们的家"
        description="把近况和牵挂放在一起，每个人都可以看看、说说、搭把手。"
        actions={
          mode !== 'elder' ? (
            <Link to="/memory?mode=paste" className="btn-primary">
              <InboxIcon size={14} />
              带入一段家人消息
            </Link>
          ) : undefined
        }
      />

      <ConnectionStarters />

      {/* 家里这周的重要事项 · 一行一条，按日期排序 */}
      {importantSoon.length > 0 && (
        <section className="max-w-6xl mx-auto px-6 lg:px-12 pb-12">
          <div className="flex items-baseline justify-between mb-5">
            <h2 className="font-serif text-h3 text-ink-900">这周一起记挂的事</h2>
            <Link
              to="/me?view=all"
              className="text-tiny text-ink-500 hover:text-ink-900 inline-flex items-center gap-1"
            >
              看全部牵挂
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
        <section className="max-w-6xl mx-auto px-6 lg:px-12 pb-12">
          <div className="flex items-baseline justify-between mb-5">
            <h2 className="font-serif text-h3 text-ink-900 inline-flex items-center gap-2">
              <Heart size={17} className="text-rouge-500" />
              这些事还在等一声回应
            </h2>
            <span className="text-tiny text-ink-500">{unassigned.length} 件</span>
          </div>
          <ul className="space-y-3">
            {unassigned.map((t) => (
              <li
                key={t.id}
                className="rounded-2xl border border-rouge-100 bg-paper-50 px-5 py-4 shadow-soft flex items-start justify-between gap-4 flex-wrap"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-serif text-body text-ink-900">{t.title}</div>
                  <div className="text-tiny text-ink-500 mt-1 flex items-center gap-2 flex-wrap">
                    <OriginatorLabel
                      id={t.originatorId}
                      label={t.originatorLabel}
                      size="xs"
                    />
                    {t.dueDateText && <span>· 想在 {t.dueDateText} 安心下来</span>}
                  </div>
                </div>
                <button
                  onClick={() => setActive(t)}
                  className="btn-outline text-tiny shrink-0"
                >
                  看看怎么帮
                  <ArrowRight size={11} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="border-y border-paper-200 bg-paper-100/60">
        <div className="max-w-6xl mx-auto px-6 lg:px-12 py-12 space-y-12">
          <div>
            <div className="flex items-end justify-between gap-6 mb-6 flex-wrap">
              <div>
                <h2 className="font-serif text-h2 text-ink-900 leading-tight">谁最近需要多一点拥抱</h2>
                <p className="mt-2 text-small text-ink-600 max-w-xl leading-relaxed">
                  有些牵挂很容易默默留在一个人心里。看见彼此，才更容易主动分担一点。
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

          <div className="border-t border-paper-200 pt-10">
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
      <PageHeader title="我们的家" description="现在还很安静，正适合留下一句温暖的话。" />
      <ConnectionStarters />
      <section className="max-w-6xl mx-auto px-6 lg:px-12 pb-20">
        <div className="petal-card p-10 text-center max-w-xl mx-auto">
          <p className="font-serif text-lead text-ink-700 mb-8">
            当群聊里出现需要记住的小事，欧哈娜也会帮你轻轻接住，不让谁一个人操心。
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link to="/memory?mode=paste" className="btn-primary">
              <InboxIcon size={14} />
              带入家人消息
            </Link>
            <button className="btn-outline" onClick={openSampleInbox}>
              看一个家庭示例
            </button>
          </div>
        </div>
      </section>
    </>
  )
}

function ConnectionStarters() {
  const chatMessages = useAppStore((s) => s.familyChatMessages)
  const recentMessages = useMemo(() => chatMessages.slice(-2).reverse(), [chatMessages])
  const memories = useAppStore((s) => s.householdMemories)
  const members = useAppStore((s) => s.familyMembers)
  const moments = [
    {
      icon: Sun,
      title: '分享今天的小开心',
      text: '我今天想和大家分享一件开心的小事：',
    },
    {
      icon: Heart,
      title: '问问家人好吗',
      text: '想问问大家今天怎么样，有没有需要我陪一陪的？',
    },
    {
      icon: MessageCircle,
      title: '问家中的记忆',
      text: '医药卡在哪里？',
      assistant: true,
    },
  ]

  return (
    <section className="max-w-6xl mx-auto px-6 lg:px-12 pb-10">
      <div className="petal-card p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-6">
          <div>
            <h2 className="font-serif text-h3 text-ink-900">家里的聊天室</h2>
            <p className="text-small text-ink-500 mt-2">分享近况，或从 {memories.length} 条家庭记忆里找答案。</p>
          </div>
          <Link to="/memory" className="text-small text-rouge-600 hover:text-rouge-700 inline-flex items-center gap-1">
            进去聊聊
            <ArrowRight size={12} />
          </Link>
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          {moments.map((moment) => {
            const Icon = moment.icon
            return (
              <Link
                key={moment.title}
                to={`/memory?${moment.assistant ? 'ask' : 'say'}=${encodeURIComponent(moment.text)}`}
                className="rounded-2xl bg-paper border border-paper-200 p-4 transition hover:border-rouge-200 hover:bg-rouge-50"
              >
                <Icon size={18} className="text-rouge-500 mb-3" />
                <div className="text-body font-medium text-ink-800">{moment.title}</div>
                <div className="text-tiny text-ink-500 mt-1">
                  {moment.assistant ? '问欧哈娜' : '发给家人'}
                </div>
              </Link>
            )
          })}
        </div>
        {recentMessages.length > 0 && (
          <div className="mt-6 pt-5 border-t border-paper-200">
            <div className="eyebrow mb-3">最近留言</div>
            <div className="space-y-2">
              {recentMessages.map((message) => {
                const speaker = members.find((member) => member.id === message.speakerId)
                return (
                  <div key={message.id} className="flex items-baseline gap-3 text-small">
                    <span className="text-rouge-600 shrink-0">
                      {message.role === 'assistant' ? '欧哈娜' : speaker?.name ?? '家人'}
                    </span>
                    <span className="text-ink-600 truncate">{message.body}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
