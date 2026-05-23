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
  ArrowRight, Bell, HelpingHand, Users, Inbox as InboxIcon,
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
    elderly_care: ['同城父母', '同城老人', '可跑腿', '会陪诊', '能买药'],
    medical: ['同城父母', '同城老人', '会陪诊', '可跑腿'],
    child_school: ['同城孩子', '同城学校', '能拍照上传', '家务行政'],
    household_admin: ['家务行政', '日历可靠', '可对接师傅', '同城家中'],
    reimbursement: ['票据整理', '统筹'],
    general_family: ['能拍照上传'],
  }
  const hints = traitsHints[t.category] ?? []
  return userTraits.some((tr) => hints.includes(tr))
}

const CATEGORY_TABS: { id: TaskCategory | 'all'; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'elderly_care', label: '老人' },
  { id: 'medical', label: '医疗' },
  { id: 'child_school', label: '孩子' },
  { id: 'household_admin', label: '家务' },
  { id: 'reimbursement', label: '票据' },
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
          title={isSimple ? '事项' : '事项'}
          description="还没有任务，去家庭记忆粘一段聊天试试。"
        />
        <div className="max-w-6xl mx-auto px-8 lg:px-12 pb-20">
          <div className="border-t border-ink-200 pt-16 text-center">
            <Link to="/memory?mode=paste" className="btn-primary">
              <InboxIcon size={14} />
              粘段群聊给 AI
            </Link>
          </div>
        </div>
      </>
    )
  }

  const title = mode === 'elder' ? `${me?.name ?? ''}，今天要做这几件事` : '事项'
  const myRelatedCount = tasks.filter((t) => isRelatedToUser(t, currentUserId)).length
  const description =
    mode === 'elder'
      ? '不急，一件一件来。完成后拍张照片就好。'
      : view === 'mine'
        ? `以 ${me?.name ?? '?'} 的视角 · 与你有关的 ${myRelatedCount} 条`
        : `家里所有 ${tasks.length} 条任务`

  return (
    <>
      <PageHeader title={title} description={description} />

      {/* View tab · 老人版不显示 */}
      {mode !== 'elder' && (
        <div className="max-w-6xl mx-auto px-8 lg:px-12 pt-2 pb-6">
          <div className="inline-flex border border-ink-300">
            <button
              onClick={() => setView('mine')}
              className={cn(
                'inline-flex items-center gap-1.5 px-4 py-2 text-tiny transition',
                view === 'mine'
                  ? 'bg-ink-900 text-paper'
                  : 'text-ink-600 hover:text-ink-900',
              )}
            >
              <HelpingHand size={12} />
              我的事项
            </button>
            <button
              onClick={() => setView('all')}
              className={cn(
                'inline-flex items-center gap-1.5 px-4 py-2 text-tiny transition border-l border-ink-300',
                view === 'all'
                  ? 'bg-ink-900 text-paper'
                  : 'text-ink-600 hover:text-ink-900',
              )}
            >
              <Users size={12} />
              全部事项
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
      <div className="max-w-3xl mx-auto px-8 lg:px-12 pb-24">
        {allToday.length === 0 ? (
          <div className="border-t border-ink-200 pt-16 text-center">
            <p className="font-serif text-h3 text-ink-700">今天没什么要紧的事。</p>
            <p className="text-lead text-ink-500 mt-3">不急 · 可以喘口气。</p>
          </div>
        ) : (
          <div className="border-t border-ink-200 pt-10 space-y-6">
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
    <div className="max-w-5xl mx-auto px-8 lg:px-12 pb-20 space-y-14">
      {/* 今天要做 */}
      <section className="border-t border-ink-200 pt-8">
        <div className="flex items-baseline justify-between mb-5">
          <h2 className="font-serif text-h3 text-ink-900">今天要做的事</h2>
          <span className="text-tiny text-ink-500">{myToday.length} 件</span>
        </div>
        {myToday.length === 0 ? (
          <p className="text-small text-ink-500 italic">今天没有临近截止的事。</p>
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
        <section>
          <div className="flex items-baseline justify-between mb-5">
            <h2 className="font-serif text-h3 text-ink-900">接下来要做</h2>
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
        <section>
          <div className="flex items-baseline justify-between mb-5">
            <h2 className="font-serif text-h3 text-ink-900 inline-flex items-center gap-2">
              <Bell size={16} className="text-rouge-500" />
              待分配
            </h2>
            <span className="text-tiny text-ink-500">{myDrafts.length} 件</span>
          </div>
          <p className="text-tiny text-ink-500 mb-4">
            你发起、还没派给别人的事。打开 → 点「全部按 AI 推荐指派」就好。其他家人现在还看不到。
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
        <section>
          <div className="flex items-baseline justify-between mb-5">
            <h2 className="font-serif text-h3 text-ink-900 inline-flex items-center gap-2">
              <Bell size={16} className="text-rouge-500" />
              待确认
            </h2>
            <span className="text-tiny text-ink-500">{waitingOnMe.length} 件</span>
          </div>
          <p className="text-tiny text-ink-500 mb-4">
            别人派给你的事，等你点「我接手」。
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
        <div className="border-t border-ink-200 pt-12 text-center text-small text-ink-500">
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
        'block w-full text-left bg-paper-50 border-l-4 px-8 py-7 hover:bg-paper-100 transition',
        task.status === 'fallback_risk' || task.status === 'needs_owner'
          ? 'border-rouge-500'
          : 'border-ink-700',
      )}
    >
      <h3 className="font-serif text-h2 text-ink-900 leading-tight">{task.title}</h3>
      {(task.dueDate || task.dueDateText) && (
        <div className="text-lead text-rouge-500 mt-3">
          {formatDueDate(task.dueDate) ?? task.dueDateText}
        </div>
      )}
      <div className="mt-4 text-lead text-ink-700">
        点开 → 看要做的步骤，完成后拍张照片
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
    <div className="max-w-6xl mx-auto px-8 lg:px-12 pb-20">
      <div className="flex items-center gap-6 mb-10 border-b border-ink-200">
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
                'text-small transition pb-3 -mb-px border-b-2 inline-flex items-center gap-2',
                tab === c.id
                  ? 'text-ink-900 font-medium border-rouge-500'
                  : 'text-ink-500 hover:text-ink-900 border-transparent',
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
          这个分类下没有任务
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
