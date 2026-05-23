import type { CareTask, TaskStatus } from '@/lib/types'
import { MemberPill } from './MemberPill'
import { cn } from '@/lib/utils'

const STATUS_STYLE: Record<TaskStatus, { label: string; cls: string }> = {
  detected: { label: '刚识别', cls: 'text-ink-500' },
  needs_owner: { label: '缺执行人', cls: 'text-rouge-500' },
  pending_acceptance: { label: '只回了"收到"', cls: 'text-rouge-500' },
  accepted: { label: '已承接', cls: 'text-moss-500' },
  in_progress: { label: '进行中', cls: 'text-moss-500' },
  needs_proof: { label: '待证明', cls: 'text-rouge-500' },
  completed: { label: '已完成', cls: 'text-ink-400' },
  fallback_risk: { label: '掉回唐宁', cls: 'text-rouge-500' },
}

const CATEGORY_LABEL: Record<CareTask['category'], string> = {
  elderly_care: '老人照护',
  medical: '医疗复诊',
  child_school: '孩子学校',
  household_admin: '家务行政',
  reimbursement: '票据报销',
  general_family: '家事',
}

export function TaskCard({
  task,
  onClick,
  active,
}: {
  task: CareTask
  onClick?: () => void
  active?: boolean
}) {
  const status = STATUS_STYLE[task.status]
  const isHighRisk = task.status === 'fallback_risk' || task.status === 'needs_owner'

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left bg-paper-50 border-l-2 transition group',
        'px-6 py-5',
        isHighRisk
          ? 'border-rouge-500'
          : active
            ? 'border-ink-900'
            : 'border-ink-200 hover:border-ink-500',
      )}
    >
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <span className="eyebrow">{CATEGORY_LABEL[task.category]}</span>
        <span className={cn('text-tiny font-medium', status.cls)}>{status.label}</span>
      </div>

      <h3 className="font-serif text-h3 text-ink-900 leading-tight">{task.title}</h3>

      {task.dueDateText && (
        <div className="text-tiny text-ink-500 mt-1.5 italic">{task.dueDateText}</div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-tiny">
        <span className="flex items-center gap-1.5 text-ink-500">
          <span className="text-ink-400">发起</span>
          <MemberPill id={task.originatorId} size="xs" />
        </span>
        <span className="flex items-center gap-1.5 text-ink-500">
          <span className="text-ink-400">建议</span>
          <MemberPill id={task.suggestedOwnerId} size="xs" />
        </span>
        {task.executorId && task.executorId !== task.suggestedOwnerId && (
          <span className="flex items-center gap-1.5 text-rouge-500">
            <span>当前却在</span>
            <MemberPill id={task.executorId} size="xs" />
          </span>
        )}
      </div>
    </button>
  )
}
