/**
 * /me · 事项
 *
 * 两个子视图：
 *   - 我的事项 (mine) —— 我今天要做 / 别人在等我确认 / 我可以帮忙的事
 *   - 全部事项 (all) —— 全家任务，按分类筛
 *
 * 通过 ?view=mine|all 切换，刷新不丢。
 */

import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowRight, Heart, HelpingHand, Users, Inbox as InboxIcon,
} from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { TaskCard } from '@/components/TaskCard'
import { TaskDetailModal } from '@/components/TaskDetailModal'
import { useAppStore } from '@/lib/store'
import {
  isTaskAcceptedByUser,
  isTaskAssignedToUser,
  isTaskAwaitingUserConfirmation,
  isTaskDraft,
} from '@/lib/status'
import { useIsSimpleMode, useUiMode } from '@/lib/useUiMode'
import type { CareTask, TaskCategory } from '@/lib/types'
import { cn, dueDateRank, formatDueDate } from '@/lib/utils'

type View = 'mine' | 'all'

/* -------------------------------------------------------------------------- */
/* 谁与谁有关 / 任务关系判定                                                    */
/* -------------------------------------------------------------------------- */

function isDueSoon(t: CareTask): boolean {
  const txt = t.dueDateText ?? ''
  return /(今天|明天|周一|本周|今晚)/.test(txt)
}

function isDueToday(t: CareTask): boolean {
  if (!t.dueDate) {
    return /^今天|今晚/.test(t.dueDateText ?? '')
  }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(t.dueDate + 'T00:00:00')
  return due.getTime() === today.getTime()
}

function isDueLater(t: CareTask): boolean {
  if (!t.dueDate) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(t.dueDate + 'T00:00:00')
  return due.getTime() > today.getTime()
}

function isAwaitingMyConfirm(t: CareTask, userId: string): boolean {
  return isTaskAwaitingUserConfirmation(t, userId)
}

/** 待我分配 · 我是发起人且任务还在 draft 状态 */
function isWaitingForMyAllocation(t: CareTask, userId: string): boolean {
  return t.originatorId === userId && isTaskDraft(t)
}

function isRelatedToUser(t: CareTask, userId: string): boolean {
  if (t.originatorId === userId) return true
  if (isTaskAssignedToUser(t, userId)) return true
  if (isTaskAcceptedByUser(t, userId)) return true
  if (t.verifierId === userId) return true
  if (t.subtasks.some((s) => s.ownerId === userId || s.suggestedOwnerId === userId)) return true
  return false
}

function couldHelp(t: CareTask, userTraits: string[], userId: string): boolean {
  if (t.status === 'accepted' || t.status === 'completed' || t.status === 'in_progress') return false
  if (isTaskDraft(t)) return false                          // 还没分配 · 不出现在别人视图
  if (isTaskAssignedToUser(t, userId)) return false
  const traitsHints: Record<CareTask['category'], string[]> = {
    elderly_care: ['同城父母', '同城老人', '和父母同城', '和长辈同城', '可跑腿', '方便帮忙跑一趟', '会陪诊', '愿意陪诊', '能买药', '方便买药'],
    medical: ['同城父母', '同城老人', '和父母同城', '和长辈同城', '会陪诊', '愿意陪诊', '可跑腿', '方便帮忙跑一趟'],
    child_school: ['同城孩子', '和孩子同城', '同城学校', '能拍照上传', '会分享照片', '家务行政', '会打理家中安排'],
    household_admin: ['家务行政', '会打理家中安排', '日历可靠', '会记住重要日子', '可对接师傅', '方便接待师傅', '同城家中', '方便到家里'],
    reimbursement: ['票据整理', '会整理票据', '统筹', '善于统筹'],
    general_family: ['能拍照上传', '会分享照片'],
  }
  const hints = traitsHints[t.category] ?? []
  return userTraits.some((tr) => hints.includes(tr))
}

const CATEGORY_TABS: { id: TaskCategory | 'all'; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'elderly_care', label: '长辈' },
  { id: 'medical', label: '健康' },
  { id: 'child_school', label: '孩子' },
  { id: 'household_admin', label: '家中' },
  { id: 'reimbursement', label: '留存' },
]

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export function TodayPage() {
  const tasks = useAppStore((s) => s.tasks)
  const currentUserId = useAppStore((s) => s.currentUserId)
  const members = useAppStore((s) => s.familyMembers)
  const isSimple = useIsSimpleMode()
  const mode = useUiMode()
  const me = members.find((m) => m.id === currentUserId)

  const [params, setParams] = useSearchParams()
  const view: View = params.get('view') === 'all' ? 'all' : 'mine'
  function setView(next: View) {
    if (next === 'mine') params.delete('view')
    else params.set('view', 'all')
    setParams(params, { replace: true })
  }

  const [active, setActive] = useState<CareTask | null>(null)
  const activeFromStore = active ? tasks.find((t) => t.id === active.id) ?? null : null

  // 空状态
  if (tasks.length === 0) {
    return (
      <>
        <PageHeader
          title="为你留意"
          description="这里还没有需要操心的事。可以先和家人说一句近况。"
        />
        <div className="max-w-6xl mx-auto px-6 lg:px-12 pb-20">
          <div className="petal-card p-10 text-center max-w-xl">
            <p className="font-serif text-lead text-ink-700 mb-6">
              今天没有要赶着处理的事，留点时间问候一下彼此吧。
            </p>
            <Link to="/memory" className="btn-primary mr-3">
              <InboxIcon size={14} />
              说一句近况
            </Link>
            <Link to="/memory?mode=paste" className="btn-outline">
              带入消息
            </Link>
          </div>
        </div>
      </>
    )
  }

  const title = mode === 'elder' ? `${me?.name ?? ''}，今天好吗？` : '为你留意'
  const myRelatedCount = tasks.filter((t) => isRelatedToUser(t, currentUserId)).length
  const description =
    mode === 'elder'
      ? '不急，一件一件来。完成后拍张照片就好。'
      : view === 'mine'
        ? `给 ${me?.name ?? '?'} 的温柔提醒 · 有 ${myRelatedCount} 件事与你有关`
        : `全家一起记挂的 ${tasks.length} 件事`

  return (
    <>
      <PageHeader title={title} description={description} />

      {/* View tab · 老人版不显示 */}
      {mode !== 'elder' && (
        <div className="max-w-6xl mx-auto px-6 lg:px-12 pt-2 pb-7">
          <div className="segmented">
            <button
              onClick={() => setView('mine')}
              className={cn(
                'segment',
                view === 'mine'
                  ? 'segment-active'
                  : 'text-ink-600 hover:text-ink-900',
              )}
            >
              <HelpingHand size={12} />
              与我有关
            </button>
            <button
              onClick={() => setView('all')}
              className={cn(
                'segment',
                view === 'all'
                  ? 'segment-active'
                  : 'text-ink-600 hover:text-ink-900',
              )}
            >
              <Users size={12} />
              全家牵挂
            </button>
          </div>
        </div>
      )}

      {view === 'mine' || mode === 'elder' ? (
        <MineView
          tasks={tasks}
          currentUserId={currentUserId}
          mode={mode}
          isSimple={isSimple}
          activeId={active?.id}
          onOpen={setActive}
        />
      ) : (
        <AllView
          tasks={tasks}
          isSimple={isSimple}
          activeId={active?.id}
          onOpen={setActive}
        />
      )}

      <TaskDetailModal task={activeFromStore} onClose={() => setActive(null)} />
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* View · 我的事项                                                              */
/* -------------------------------------------------------------------------- */

function MineView({
  tasks,
  currentUserId,
  mode,
  isSimple,
  activeId,
  onOpen,
}: {
  tasks: CareTask[]
  currentUserId: string
  mode: ReturnType<typeof useUiMode>
  isSimple: boolean
  activeId?: string
  onOpen: (t: CareTask) => void
}) {
  // 今天要做 · 我已经确认承接的事 + 今天截止
  const myToday = useMemo(
    () =>
      tasks
        .filter(
          (t) =>
            t.status !== 'completed' &&
            isTaskAcceptedByUser(t, currentUserId) &&
            isDueToday(t),
        )
        .slice()
        .sort((a, b) => dueDateRank(a.dueDate) - dueDateRank(b.dueDate)),
    [tasks, currentUserId],
  )

  // 接下来要做 · 我已经确认承接的事 + 未来日期
  const myUpcoming = useMemo(
    () =>
      tasks
        .filter(
          (t) =>
            t.status !== 'completed' &&
            isTaskAcceptedByUser(t, currentUserId) &&
            isDueLater(t),
        )
        .slice()
        .sort((a, b) => dueDateRank(a.dueDate) - dueDateRank(b.dueDate)),
    [tasks, currentUserId],
  )

  // 待确认 · 别人派给我，等我点"我接手"
  const waitingOnMe = useMemo(
    () =>
      tasks
        .filter((t) => isAwaitingMyConfirm(t, currentUserId))
        .slice()
        .sort((a, b) => dueDateRank(a.dueDate) - dueDateRank(b.dueDate)),
    [tasks, currentUserId],
  )

  // 待分配 · 我发起的、还没派出去的事
  const myDrafts = useMemo(
    () =>
      tasks
        .filter((t) => isWaitingForMyAllocation(t, currentUserId))
        .slice()
        .sort((a, b) => dueDateRank(a.dueDate) - dueDateRank(b.dueDate)),
    [tasks, currentUserId],
  )

  // 老人版 · 极简 · 一栏一张大卡片，其他什么都不显示
  if (mode === 'elder') {
    const allToday = [...myToday, ...waitingOnMe]
    return (
      <div className="max-w-3xl mx-auto px-6 lg:px-12 pb-24">
        {allToday.length === 0 ? (
          <div className="petal-card px-6 py-14 text-center">
            <p className="font-serif text-h3 text-ink-700">今天没什么要紧的事。</p>
            <p className="text-lead text-ink-500 mt-3">不急 · 可以喘口气。</p>
          </div>
        ) : (
          <div className="space-y-6">
            {allToday.map((t) => (
              <ElderTaskCard
                key={t.id}
                task={t}
                onClick={() => onOpen(t)}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  // 标准模式 · 四段：今天要做 / 接下来要做 / 待分配 / 待确认
  const isEmpty =
    myToday.length === 0 &&
    myUpcoming.length === 0 &&
    waitingOnMe.length === 0 &&
    myDrafts.length === 0

  return (
    <div className="max-w-5xl mx-auto px-6 lg:px-12 pb-20 space-y-12">
      {/* 今天要做 */}
      <section className="petal-card p-6 md:p-8">
        <div className="flex items-baseline justify-between mb-5">
          <h2 className="font-serif text-h3 text-ink-900">今天先照顾好这些</h2>
          <span className="text-tiny text-ink-500">{myToday.length} 件</span>
        </div>
        {myToday.length === 0 ? (
          <p className="text-small text-ink-500">今天没有赶时间的牵挂，可以轻松一点。</p>
        ) : (
          <div className="space-y-3">
            {myToday.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                simpleMode={isSimple}
                onClick={() => onOpen(t)}
                active={activeId === t.id}
              />
            ))}
          </div>
        )}
      </section>

      {/* 接下来要做 */}
      {myUpcoming.length > 0 && (
        <section className="petal-card p-6 md:p-8">
          <div className="flex items-baseline justify-between mb-5">
            <h2 className="font-serif text-h3 text-ink-900">接下来可以陪着完成</h2>
            <span className="text-tiny text-ink-500">{myUpcoming.length} 件</span>
          </div>
          <div className="space-y-3">
            {myUpcoming.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                simpleMode={isSimple}
                onClick={() => onOpen(t)}
                active={activeId === t.id}
              />
            ))}
          </div>
        </section>
      )}

      {/* 待分配 · 我发起的、还没派出去的事 */}
      {myDrafts.length > 0 && (
        <section className="petal-card p-6 md:p-8">
          <div className="flex items-baseline justify-between mb-5">
            <h2 className="font-serif text-h3 text-ink-900 inline-flex items-center gap-2">
              <Heart size={16} className="text-rouge-500" />
              还想请家人搭把手
            </h2>
            <span className="text-tiny text-ink-500">{myDrafts.length} 件</span>
          </div>
          <p className="text-tiny text-ink-500 mb-4">
            这些是你先记下的牵挂。打开后，可以温柔地请一位方便的家人一起照看。
          </p>
          <div className="space-y-3">
            {myDrafts.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                simpleMode={isSimple}
                onClick={() => onOpen(t)}
              />
            ))}
          </div>
        </section>
      )}

      {/* 待确认 · 别人派给我，等我点"我接手" */}
      {waitingOnMe.length > 0 && (
        <section className="petal-card p-6 md:p-8">
          <div className="flex items-baseline justify-between mb-5">
            <h2 className="font-serif text-h3 text-ink-900 inline-flex items-center gap-2">
              <Heart size={16} className="text-rouge-500" />
              家人正在等你的回应
            </h2>
            <span className="text-tiny text-ink-500">{waitingOnMe.length} 件</span>
          </div>
          <p className="text-tiny text-ink-500 mb-4">
            有人想到你可能方便帮忙。你可以答应，也可以坦白说最近不方便。
          </p>
          <div className="space-y-3">
            {waitingOnMe.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                simpleMode={isSimple}
                onClick={() => onOpen(t)}
              />
            ))}
          </div>
        </section>
      )}

      {isEmpty && (
        <div className="petal-card p-10 text-center text-small text-ink-500">
          你这边今天没什么要紧的事。
          <div className="mt-2">
            <Link to="/overview" className="text-rouge-500 hover:text-rouge-700">
              看看家里这周怎么样 →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

/* 老人版 · 真大字 · 真大按钮 · 一屏一件事的感觉 */
function ElderTaskCard({
  task,
  onClick,
}: {
  task: CareTask
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'block w-full text-left bg-paper-50 rounded-3xl border px-8 py-7 hover:bg-paper-100 transition shadow-soft',
        task.status === 'fallback_risk' || task.status === 'needs_owner'
          ? 'border-rouge-200'
          : 'border-paper-200',
      )}
    >
      <h3 className="font-serif text-h2 text-ink-900 leading-tight">{task.title}</h3>
      {(task.dueDate || task.dueDateText) && (
        <div className="text-lead text-rouge-500 mt-3">
          {formatDueDate(task.dueDate) ?? task.dueDateText}
        </div>
      )}
      <div className="mt-4 text-lead text-ink-700">
        点开看看怎么照应，完成后可以留张照片
      </div>
    </button>
  )
}

/* -------------------------------------------------------------------------- */
/* View · 全部事项                                                              */
/* -------------------------------------------------------------------------- */

function AllView({
  tasks,
  isSimple,
  activeId,
  onOpen,
}: {
  tasks: CareTask[]
  isSimple: boolean
  activeId?: string
  onOpen: (t: CareTask) => void
}) {
  const [tab, setTab] = useState<TaskCategory | 'all'>('all')

  const filtered = useMemo(() => {
    const list = tab === 'all' ? tasks : tasks.filter((t) => t.category === tab)
    return list.slice().sort((a, b) => dueDateRank(a.dueDate) - dueDateRank(b.dueDate))
  }, [tasks, tab])

  return (
    <div className="max-w-6xl mx-auto px-6 lg:px-12 pb-20">
      <div className="flex flex-wrap items-center gap-2 mb-8">
        {CATEGORY_TABS.map((c) => {
          const count =
            c.id === 'all'
              ? tasks.length
              : tasks.filter((t) => t.category === c.id).length
          if (c.id !== 'all' && count === 0) return null
          return (
            <button
              key={c.id}
              onClick={() => setTab(c.id)}
              className={cn(
                'text-small transition px-4 py-2 rounded-full inline-flex items-center gap-2',
                tab === c.id
                  ? 'text-white font-medium bg-rouge-500 shadow-soft'
                  : 'text-ink-500 bg-paper-50 border border-paper-200 hover:text-ink-900',
              )}
            >
              {c.label}
              <span className="text-tiny text-ink-400">{count}</span>
            </button>
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-small text-ink-500">
          这里暂时没有需要留意的事
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((t, idx) => (
            <div
              key={t.id}
              className="animate-fade-up"
              style={{ animationDelay: `${idx * 60}ms` }}
            >
              <TaskCard
                task={t}
                simpleMode={isSimple}
                onClick={() => onOpen(t)}
                active={activeId === t.id}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
