import { useMemo, useState } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { TaskCard } from '@/components/TaskCard'
import { TaskDetailModal } from '@/components/TaskDetailModal'
import { SAMPLE_TASKS } from '@/lib/mockData'
import type { CareTask, TaskCategory } from '@/lib/types'
import { cn } from '@/lib/utils'

const CATEGORY_TABS: { id: TaskCategory | 'all'; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'elderly_care', label: '老人' },
  { id: 'medical', label: '医疗' },
  { id: 'child_school', label: '孩子' },
  { id: 'household_admin', label: '家务' },
  { id: 'reimbursement', label: '票据' },
]

export function TasksPage() {
  const [tab, setTab] = useState<TaskCategory | 'all'>('all')
  const [active, setActive] = useState<CareTask | null>(null)
  const [accepted, setAccepted] = useState<Record<string, { ownerId: string; deadline: string }>>(
    {},
  )

  const filtered = useMemo(() => {
    if (tab === 'all') return SAMPLE_TASKS
    return SAMPLE_TASKS.filter((t) => t.category === tab)
  }, [tab])

  return (
    <>
      <PageHeader
        eyebrow="家庭任务 · Care Workflow"
        title="每条任务都不只是一行字。"
        kicker="点开看 AI 怎么把它拆成 before/during/after，并推荐执行人。"
      />

      <div className="max-w-6xl mx-auto px-8 lg:px-12 pb-20">
        <div className="flex items-center gap-6 mb-10 border-b border-ink-200 pb-4">
          {CATEGORY_TABS.map((c) => (
            <button
              key={c.id}
              onClick={() => setTab(c.id)}
              className={cn(
                'text-small transition pb-2 -mb-[18px] border-b-2',
                tab === c.id
                  ? 'text-ink-900 font-medium border-rouge-500'
                  : 'text-ink-500 hover:text-ink-900 border-transparent',
              )}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-x-8 gap-y-6">
          {filtered.map((t, idx) => (
            <div
              key={t.id}
              className="animate-fade-up"
              style={{ animationDelay: `${idx * 80}ms` }}
            >
              <TaskCard
                task={t}
                onClick={() => setActive(t)}
                active={active?.id === t.id}
              />
            </div>
          ))}
        </div>

        {Object.keys(accepted).length > 0 && (
          <div className="mt-12 border-t border-ink-200 pt-6">
            <div className="eyebrow mb-3 text-moss-500">已发送的承接卡片</div>
            <ul className="text-small text-ink-700 space-y-1">
              {Object.entries(accepted).map(([taskId, info]) => {
                const t = SAMPLE_TASKS.find((tt) => tt.id === taskId)
                return (
                  <li key={taskId} className="font-serif italic">
                    《{t?.title}》→ {info.ownerId} · 截止 {info.deadline}
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>

      <TaskDetailModal
        task={active}
        onClose={() => setActive(null)}
        onAccept={(taskId, ownerId, deadline) =>
          setAccepted((prev) => ({ ...prev, [taskId]: { ownerId, deadline } }))
        }
      />
    </>
  )
}
